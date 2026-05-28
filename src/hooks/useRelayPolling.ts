import { useEffect, useRef } from 'react';
import {
  subscribeToPendingBits,
  subscribeToHeartbeat,
  fetchChannels,
  clearPendingBits,
} from '@/firebase/realtimeDb';
import { useDeviceStore } from '@/store/deviceStore';
import { useUIStore } from '@/store/uiStore';
import { Channel, ChannelKey } from '@/types';

const HEARTBEAT_THRESHOLD_MS = 45_000; // 15 s heartbeat × 3

/**
 * useRelayPolling
 *
 * Per-device smart polling:
 *   • Subscribes to `pendingBits` (a single integer in RTDB).
 *     When bits ≠ 0, does a one-shot `fetchChannels()` to refresh state.
 *   • Subscribes to `heartbeat` to derive online/offline status.
 *
 * This replaces an always-on `subscribeToDevice` full-tree listener.
 */
export const useRelayPolling = (deviceId: string | undefined) => {
  const { rtdbData, setRtdbData, updateDevice, devices } = useDeviceStore();
  const addNotification = useUIStore((s) => s.addNotification);
  const prevOnlineRef   = useRef<boolean | undefined>(undefined);
  // Track bits we are currently processing to avoid duplicate fetches
  const processingRef   = useRef(false);

  useEffect(() => {
    if (!deviceId) return;

    // ── 1. Heartbeat listener ──────────────────────────────────────────────
    const unsubHb = subscribeToHeartbeat(deviceId, (hb) => {
      const isOnline = hb !== null && Date.now() - hb < HEARTBEAT_THRESHOLD_MS;

      // Update cached RTDB data with latest heartbeat
      setRtdbData(deviceId, {
        ...((useDeviceStore.getState().rtdbData[deviceId]) ?? {
          info: {} as any,
          channels: {} as any,
          heartbeat: 0,
          status: 'offline',
        }),
        heartbeat: hb ?? 0,
        status: isOnline ? 'online' : 'offline',
      });

      // Notify on status change
      const dev = useDeviceStore.getState().devices.find(d => d.id === deviceId);
      if (dev && prevOnlineRef.current !== undefined && prevOnlineRef.current !== isOnline) {
        updateDevice(deviceId, { onlineStatus: isOnline });
        addNotification(
          `${dev.deviceName} is now ${isOnline ? 'Online 🟢' : 'Offline 🔴'}`,
          isOnline ? 'success' : 'warning'
        );
      }
      if (dev) updateDevice(deviceId, { onlineStatus: isOnline });
      prevOnlineRef.current = isOnline;
    });

    // ── 2. PendingBits listener ────────────────────────────────────────────
    const unsubBits = subscribeToPendingBits(deviceId, async (bits) => {
      if (bits === 0 || processingRef.current) return;
      processingRef.current = true;
      try {
        // One-shot read of channels
        const channels = await fetchChannels(deviceId);
        if (channels) {
          const current = useDeviceStore.getState().rtdbData[deviceId];
          setRtdbData(deviceId, {
            ...(current ?? { info: {} as any, heartbeat: 0, status: 'offline' }),
            channels: channels as Record<ChannelKey, Channel>,
          });
        }
        // Clear the bits we just processed
        await clearPendingBits(deviceId, bits);
      } catch (err) {
        console.error(`[useRelayPolling] fetchChannels error for ${deviceId}:`, err);
      } finally {
        processingRef.current = false;
      }
    });

    return () => {
      unsubHb();
      unsubBits();
    };
  }, [deviceId]);
};
