import { useEffect, useRef, useState } from 'react';
import { onSnapshot, collection, query, where } from 'firebase/firestore';
import { db } from '@/firebase/config';
import { setRelayState, setRelayTimer, setRelayAutomation } from '@/firebase/realtimeDb';
import { useDeviceStore } from '@/store/deviceStore';
import { Automation } from '@/types';

// ─── useAutomations (Firestore fallback) ──────────────────────────────────────

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

// ─── useScheduleRunner (Flat Schema Watchdog) ───────────────────────────────

/**
 * Watchdog runner for simplified flat schema timers and automations.
 * Runs client-side every 10 seconds:
 *   1. Countdown Timer: Turns the relay OFF and disables timer when current time matches auto_off and timer is 1.
 *   2. Scheduled Automation: Turns the relay ON at auto_on, and OFF at auto_off.
 */
export const useScheduleRunner = (automations: any) => {
  const { rtdbData } = useDeviceStore();
  const lastProcessedMinuteRef = useRef<string>('');

  useEffect(() => {
    const check = async () => {
      const now = new Date();
      const currentHHMM = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

      const deviceIds = Object.keys(rtdbData);
      for (const deviceId of deviceIds) {
        const data = rtdbData[deviceId];
        if (!data) continue;

        const {
          auto, timer, auto_on, auto_off, auto_channel,
          ch1, ch2,
        } = data;

        const relayIndex = auto_channel || 1;
        const currentRelayState = relayIndex === 1 ? (ch1 === 1) : (ch2 === 1);

        // Avoid double processing in the same minute
        const currentMinuteKey = `${deviceId}_${currentHHMM}`;

        // ── 1. Countdown Timer check ─────────────────────────────────────
        if (timer === 1 && auto_off && currentRelayState) {
          if (currentHHMM === auto_off && lastProcessedMinuteRef.current !== currentMinuteKey + '_timer') {
            console.log(`[Watchdog] Timer expired (auto_off matches) for device ${deviceId} relay ${relayIndex}. Turning OFF.`);
            await setRelayTimer(deviceId, relayIndex, 0, false).catch(console.error);
            lastProcessedMinuteRef.current = currentMinuteKey + '_timer';
          }
        }

        // ── 2. Scheduled Automation check ─────────────────────────────────────
        if (auto === 1 && auto_on && auto_off) {
          if (lastProcessedMinuteRef.current !== currentMinuteKey + '_auto') {
            // Trigger ON
            if (currentHHMM === auto_on && !currentRelayState) {
              console.log(`[Watchdog] Automation ON triggered for device ${deviceId} relay ${relayIndex}`);
              await setRelayState(deviceId, relayIndex as any, true).catch(console.error);
              lastProcessedMinuteRef.current = currentMinuteKey + '_auto';
            }
            // Trigger OFF
            if (currentHHMM === auto_off && currentRelayState) {
              console.log(`[Watchdog] Automation OFF triggered for device ${deviceId} relay ${relayIndex}`);
              await setRelayAutomation(deviceId, relayIndex, auto_on, auto_off, false).catch(console.error);
              lastProcessedMinuteRef.current = currentMinuteKey + '_auto';
            }
          }
        }
      }
    };

    const interval = setInterval(check, 10000); // Check every 10 seconds
    check(); // Run immediately

    return () => clearInterval(interval);
  }, [rtdbData]);
};
