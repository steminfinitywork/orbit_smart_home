import { useEffect, useRef } from 'react';
import { subscribeToDevice } from '@/firebase/realtimeDb';
import { useDeviceStore } from '@/store/deviceStore';
import { useUIStore } from '@/store/uiStore';
import { DeviceRTDB } from '@/types';

const HEARTBEAT_THRESHOLD_MS = 45_000; // 15 s heartbeat × 3

export const useRelayPolling = (deviceId: string | undefined) => {
  const { setRtdbData, updateDevice } = useDeviceStore();
  const addNotification = useUIStore((s) => s.addNotification);
  const prevOnlineRef = useRef<boolean | undefined>(undefined);

  useEffect(() => {
    if (!deviceId) return;

    // Subscribe directly to the flat device data
    const unsub = subscribeToDevice(deviceId, (data) => {
      if (!data) return;

      const hb = data.heartbeat;
      const isOnline = hb !== undefined && hb !== null && (Date.now() - hb < HEARTBEAT_THRESHOLD_MS);

      // Construct DeviceRTDB object with offline/online status mapping
      const updatedData: DeviceRTDB = {
        ...data,
        status: isOnline ? 'online' : 'offline',
      };

      setRtdbData(deviceId, updatedData);

      // Handle online status state changes & notifications
      const dev = useDeviceStore.getState().devices.find((d) => d.id === deviceId);
      if (dev) {
        if (prevOnlineRef.current !== undefined && prevOnlineRef.current !== isOnline) {
          updateDevice(deviceId, { onlineStatus: isOnline });
          addNotification(
            `${dev.deviceName} is now ${isOnline ? 'Online 🟢' : 'Offline 🔴'}`,
            isOnline ? 'success' : 'warning'
          );
        } else {
          updateDevice(deviceId, { onlineStatus: isOnline });
        }
      }
      prevOnlineRef.current = isOnline;
    });

    return () => unsub();
  }, [deviceId]);
};
