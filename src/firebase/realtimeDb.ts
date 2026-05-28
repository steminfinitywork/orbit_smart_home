import {
  ref,
  set,
  get,
  update,
  onValue,
  off,
  DataSnapshot,
} from 'firebase/database';
import { rtdb } from './config';
import { DeviceInfo, DeviceRTDB } from '@/types';

// ─── Device Fetching ──────────────────────────────────────────────────────────

export const getDeviceRTDB = async (deviceId: string): Promise<DeviceRTDB | null> => {
  const snap = await get(ref(rtdb, `deviceData/${deviceId}`));
  return snap.exists() ? (snap.val() as DeviceRTDB) : null;
};

export const getDeviceInfo = async (deviceId: string): Promise<DeviceInfo | null> => {
  const snap = await get(ref(rtdb, `deviceData/${deviceId}`));
  if (!snap.exists()) return null;
  const val = snap.val();
  return {
    relayCount: val.relay_count || 2,
    firmwareVersion: val.firmwareVersion || '1.0.0',
    deviceType: 'relay',
    ownerId: val.owner_id || '',
    password: val.device_password || '',
  };
};

export const claimDevice = async (deviceId: string, ownerId: string) => {
  await update(ref(rtdb, `deviceData/${deviceId}`), { owner_id: ownerId });
};

export const releaseDevice = async (deviceId: string) => {
  await update(ref(rtdb, `deviceData/${deviceId}`), { owner_id: '' });
};

export const initDeviceRTDB = async (deviceId: string, data: any) => {
  await set(ref(rtdb, `deviceData/${deviceId}`), data);
};

// ─── Realtime Subscriptions ──────────────────────────────────────────────────

export const subscribeToDevice = (
  deviceId: string,
  callback: (data: DeviceRTDB | null) => void
): (() => void) => {
  const r = ref(rtdb, `deviceData/${deviceId}`);
  onValue(r, (snap: DataSnapshot) => {
    callback(snap.exists() ? (snap.val() as DeviceRTDB) : null);
  });
  return () => off(r);
};

// ─── Direct Relay State Controls ─────────────────────────────────────────────

export const setRelayState = async (deviceId: string, relayIndex: 1 | 2, state: boolean) => {
  const chKey = `ch${relayIndex}`;
  await set(ref(rtdb, `deviceData/${deviceId}/${chKey}`), state ? 1 : 0);
};

// ─── Timer Controls ──────────────────────────────────────────────────────────

export const setRelayTimer = async (
  deviceId: string,
  relayIndex: number,
  durationMinutes: number,
  enabled: boolean
) => {
  const chKey = `ch${relayIndex}`;
  const updates: any = {
    auto_channel: relayIndex,
    timer: enabled ? 1 : 0,
  };

  if (enabled) {
    // 1. Turn relay ON immediately
    updates[chKey] = 1;
    // 2. Add duration minutes to current time to calculate auto_off
    const targetDate = new Date(Date.now() + durationMinutes * 60 * 1000);
    updates.auto_off = `${targetDate.getHours().toString().padStart(2, '0')}:${targetDate.getMinutes().toString().padStart(2, '0')}`;
  } else {
    updates[chKey] = 0;
    updates.auto_off = '';
  }

  await update(ref(rtdb, `deviceData/${deviceId}`), updates);
};

// ─── Automation Controls ─────────────────────────────────────────────────────

export const setRelayAutomation = async (
  deviceId: string,
  relayIndex: number,
  autoOn: string,
  autoOff: string,
  enabled: boolean
) => {
  const updates: any = {
    auto_channel: relayIndex,
    auto_on: enabled ? autoOn : '',
    auto_off: enabled ? autoOff : '',
    auto: enabled ? 1 : 0,
    timer: 0, // disable timer when daily automation is set
  };

  await update(ref(rtdb, `deviceData/${deviceId}`), updates);
};
