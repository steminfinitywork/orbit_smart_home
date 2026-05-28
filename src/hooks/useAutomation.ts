import { useEffect, useRef } from 'react';
import { onSnapshot, collection, query, where } from 'firebase/firestore';
import { db } from '@/firebase/config';
import { Automation } from '@/types';
import { setChannelState } from '@/firebase/realtimeDb';
import { useState } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

const channelIndexFromKey = (key: string): number => {
  const match = key.match(/ch(\d+)/);
  return match ? parseInt(match[1], 10) - 1 : 0;
};

const parseHHMM = (hhmm: string): { h: number; m: number } => {
  const [h, m] = hhmm.split(':').map(Number);
  return { h, m };
};

// ─── useAutomations ──────────────────────────────────────────────────────────

export const useAutomations = (ownerUid: string | undefined) => {
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!ownerUid) return;
    const q = query(collection(db, 'automations'), where('ownerUid', '==', ownerUid));
    const unsub = onSnapshot(q, (snap) => {
      setAutomations(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Automation)));
      setLoading(false);
    });
    return unsub;
  }, [ownerUid]);

  return { automations, loading };
};

// ─── useScheduleRunner ───────────────────────────────────────────────────────

/**
 * Client-side schedule runner.
 *
 * Checks all enabled automations every 60 seconds (on the minute).
 * When a schedule fires:
 *   1. Writes `channels/chN/state` to RTDB via setChannelState
 *   2. setChannelState also sets the pendingBits wake bit (no FCM needed)
 *
 * Note: this only runs while the app is open in the browser.
 */
export const useScheduleRunner = (automations: Automation[]) => {
  const firedRef = useRef<Record<string, number>>({}); // automationId → last fired minute

  useEffect(() => {
    const check = async () => {
      const now  = new Date();
      const day  = now.getDay();              // 0=Sun…6=Sat
      const h    = now.getHours();
      const m    = now.getMinutes();
      const minuteKey = h * 60 + m;

      for (const auto of automations) {
        if (!auto.enabled) continue;

        // ── Countdown timer ──────────────────────────────────────────────
        if (auto.type === 'countdown' && auto.duration) {
          // Countdown is purely device-side (firmware handles it via timer field).
          // No client-side action needed.
          continue;
        }

        // ── Schedule / Weekly ────────────────────────────────────────────
        if ((auto.type === 'schedule' || auto.type === 'weekly') && auto.onTime && auto.offTime) {
          const { h: onH, m: onM }  = parseHHMM(auto.onTime);
          const { h: offH, m: offM } = parseHHMM(auto.offTime);
          const onMinute  = onH  * 60 + onM;
          const offMinute = offH * 60 + offM;

          // For weekly, check day-of-week
          const dayMatch = auto.type === 'weekly'
            ? (auto.days ?? []).includes(day)
            : true;

          if (!dayMatch) continue;

          const fireKey = `${auto.id}`;

          // Fire ON
          if (minuteKey === onMinute && firedRef.current[fireKey + '_on'] !== onMinute) {
            firedRef.current[fireKey + '_on'] = onMinute;
            const chIndex = channelIndexFromKey(auto.channelKey);
            await setChannelState(auto.deviceId, auto.channelKey, true, chIndex).catch(console.error);
          }

          // Fire OFF
          if (minuteKey === offMinute && firedRef.current[fireKey + '_off'] !== offMinute) {
            firedRef.current[fireKey + '_off'] = offMinute;
            const chIndex = channelIndexFromKey(auto.channelKey);
            await setChannelState(auto.deviceId, auto.channelKey, false, chIndex).catch(console.error);
          }
        }
      }
    };

    // Align to the next whole minute, then tick every 60 s
    const msToNextMinute = (60 - new Date().getSeconds()) * 1000;
    let intervalId: ReturnType<typeof setInterval>;
    const timeoutId = setTimeout(() => {
      check(); // fire immediately on the minute
      intervalId = setInterval(check, 60_000);
    }, msToNextMinute);

    return () => {
      clearTimeout(timeoutId);
      if (intervalId) clearInterval(intervalId);
    };
  }, [automations]);
};
