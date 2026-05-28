import {
  ref,
  set,
  get,
  update,
  onValue,
  off,
  runTransaction,
  DataSnapshot,
} from 'firebase/database';
import { rtdb } from './config';
import { Channel, ChannelKey, DeviceInfo, DeviceRTDB } from '@/types';

// ─── Device Info ──────────────────────────────────────────────────────────────

export const getDeviceRTDB = async (deviceId: string): Promise<DeviceRTDB | null> => {
  const snap = await get(ref(rtdb, `deviceData/${deviceId}`));
  return snap.exists() ? (snap.val() as DeviceRTDB) : null;
};

export const getDeviceInfo = async (deviceId: string): Promise<DeviceInfo | null> => {
  const snap = await get(ref(rtdb, `deviceData/${deviceId}/info`));
  return snap.exists() ? (snap.val() as DeviceInfo) : null;
};

export const claimDevice = async (deviceId: string, ownerId: string) => {
  await update(ref(rtdb, `deviceData/${deviceId}/info`), { ownerId });
};

export const releaseDevice = async (deviceId: string) => {
  await update(ref(rtdb, `deviceData/${deviceId}/info`), { ownerId: '' });
};

export const initDeviceRTDB = async (deviceId: string, info: DeviceInfo) => {
  await set(ref(rtdb, `deviceData/${deviceId}/info`), info);
};

// ─── Channels (one-shot fetch) ────────────────────────────────────────────────

/**
 * One-shot read of all channels for a device.
 * Called only when pendingBits signals there is something to read.
 */
export const fetchChannels = async (
  deviceId: string
): Promise<Record<ChannelKey, Channel> | null> => {
  const snap = await get(ref(rtdb, `deviceData/${deviceId}/channels`));
  return snap.exists() ? (snap.val() as Record<ChannelKey, Channel>) : null;
};

export const updateChannel = async (deviceId: string, chKey: ChannelKey, data: Partial<Channel>) => {
  await update(ref(rtdb, `deviceData/${deviceId}/channels/${chKey}`), data);
};

export const renameChannel = async (deviceId: string, chKey: ChannelKey, name: string) => {
  await set(ref(rtdb, `deviceData/${deviceId}/channels/${chKey}/name`), name);
};

// ─── Channel State + Bit Flag ─────────────────────────────────────────────────

/**
 * Toggle a relay AND set its wake bit in pendingBits atomically.
 * chIndex: 0-based index (ch1 → 0, ch2 → 1, …)
 */
export const setChannelState = async (
  deviceId: string,
  chKey: ChannelKey,
  state: boolean,
  chIndex: number
) => {
  // Write relay state
  await set(ref(rtdb, `deviceData/${deviceId}/channels/${chKey}/state`), state);
  // Set the wake bit (OR with existing bits via transaction)
  await runTransaction(ref(rtdb, `deviceData/${deviceId}/pendingBits`), (current) => {
    const bits = typeof current === 'number' ? current : 0;
    return bits | (1 << chIndex);
  });
};

// ─── PendingBits ──────────────────────────────────────────────────────────────

/**
 * Subscribe to the pendingBits integer only.
 * When bits !== 0, the caller should do a one-shot fetchChannels() and then
 * clear the bits it has processed.
 */
export const subscribeToPendingBits = (
  deviceId: string,
  callback: (bits: number) => void
): (() => void) => {
  const r = ref(rtdb, `deviceData/${deviceId}/pendingBits`);
  onValue(r, (snap: DataSnapshot) => {
    callback(snap.exists() ? (snap.val() as number) : 0);
  });
  return () => off(r);
};

/**
 * Clear specific bits (called after the app has processed them).
 * Uses a transaction to avoid races with the ESP8266.
 */
export const clearPendingBits = async (deviceId: string, mask: number) => {
  await runTransaction(ref(rtdb, `deviceData/${deviceId}/pendingBits`), (current) => {
    const bits = typeof current === 'number' ? current : 0;
    return bits & ~mask;
  });
};

// ─── Heartbeat ────────────────────────────────────────────────────────────────

export const subscribeToHeartbeat = (
  deviceId: string,
  callback: (heartbeat: number | null) => void
): (() => void) => {
  const r = ref(rtdb, `deviceData/${deviceId}/heartbeat`);
  onValue(r, (snap: DataSnapshot) => {
    callback(snap.exists() ? (snap.val() as number) : null);
  });
  return () => off(r);
};

// ─── Timer ────────────────────────────────────────────────────────────────────

export const setChannelTimer = async (
  deviceId: string,
  chKey: ChannelKey,
  duration: number,
  enabled: boolean,
  chIndex: number
) => {
  await update(ref(rtdb, `deviceData/${deviceId}/channels/${chKey}/timer`), {
    enabled,
    duration,
    startTime: enabled ? Date.now() : 0,
  });
  // Wake the device to pick up the timer change
  if (enabled) {
    await runTransaction(ref(rtdb, `deviceData/${deviceId}/pendingBits`), (current) => {
      const bits = typeof current === 'number' ? current : 0;
      return bits | (1 << chIndex);
    });
  }
};

// ─── Schedule ─────────────────────────────────────────────────────────────────

export const setChannelSchedule = async (
  deviceId: string,
  chKey: ChannelKey,
  schedule: { enabled: boolean; onTime: string; offTime: string; days: number[] },
  chIndex: number
) => {
  await update(ref(rtdb, `deviceData/${deviceId}/channels/${chKey}/schedule`), schedule);
  // Wake the device to reload schedule config
  if (schedule.enabled) {
    await runTransaction(ref(rtdb, `deviceData/${deviceId}/pendingBits`), (current) => {
      const bits = typeof current === 'number' ? current : 0;
      return bits | (1 << chIndex);
    });
  }
};
