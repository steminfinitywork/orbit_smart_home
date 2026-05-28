import { useEffect, useRef } from 'react';
import { useDeviceStore } from '@/store/deviceStore';
import { useUIStore } from '@/store/uiStore';

const HEARTBEAT_THRESHOLD_MS = 25000; // 25s threshold (device beats every 15s)

export const useHeartbeat = () => {
  const { devices, rtdbData, updateDevice } = useDeviceStore();
  const addNotification = useUIStore((s) => s.addNotification);
  const prevOnlineRef = useRef<Record<string, boolean>>({});

  useEffect(() => {
    const interval = setInterval(() => {
      devices.forEach((device) => {
        const rtdb = rtdbData[device.id];
        const heartbeat = rtdb?.heartbeat ?? 0;
        const isOnline = heartbeat > 0 && Date.now() - heartbeat < HEARTBEAT_THRESHOLD_MS;
        const wasOnline = prevOnlineRef.current[device.id];

        if (wasOnline !== undefined && wasOnline !== isOnline) {
          updateDevice(device.id, { onlineStatus: isOnline });
          addNotification(
            `${device.deviceName} went ${isOnline ? 'Online 🟢' : 'Offline 🔴'}`,
            isOnline ? 'success' : 'error'
          );
        }
        prevOnlineRef.current[device.id] = isOnline;
      });
    }, 1000); // Check every second for responsive UI

    return () => clearInterval(interval);
  }, [devices, rtdbData]);
};

export const isDeviceOnline = (heartbeat: number | undefined): boolean => {
  if (!heartbeat) return false;
  return Date.now() - heartbeat < HEARTBEAT_THRESHOLD_MS;
};

export const getLastSeenText = (heartbeat: number | undefined): string => {
  if (!heartbeat) return 'Never';
  const diff = Date.now() - heartbeat;
  if (diff < 60000) return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  return `${Math.floor(diff / 3600000)}h ago`;
};
