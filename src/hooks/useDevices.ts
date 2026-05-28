import React from 'react';
import { useEffect } from 'react';
import { onSnapshot, collection, query, where } from 'firebase/firestore';
import { db } from '@/firebase/config';
import { useDeviceStore } from '@/store/deviceStore';
import { DeviceDoc } from '@/types';
import { useRelayPolling } from './useRelayPolling';

/**
 * useDevices
 *
 * Provides a real-time Firestore listener for device metadata.
 * Relay state polling (pendingBits + heartbeat) is handled by RelayPollBridge
 * rendered per-device in AppRoutes, so hooks are not called conditionally.
 */
export const useDevices = (ownerUid: string | undefined) => {
  const { devices, setDevices } = useDeviceStore();

  useEffect(() => {
    if (!ownerUid) return;
    const q = query(collection(db, 'devices'), where('ownerUid', '==', ownerUid));
    const unsub = onSnapshot(q, (snap) => {
      const devs: DeviceDoc[] = snap.docs.map((d) => ({ id: d.id, ...d.data() } as DeviceDoc));
      setDevices(devs);
    });
    return unsub;
  }, [ownerUid]);

  return { devices };
};

/**
 * RelayPollBridge
 *
 * Renders nothing — just activates useRelayPolling for one device.
 * Rendered in a list inside AppRoutes so each device gets its own
 * polling lifecycle without violating Rules of Hooks.
 */
export const RelayPollBridge: React.FC<{ deviceId: string }> = ({ deviceId }) => {
  useRelayPolling(deviceId);
  return null;
};
