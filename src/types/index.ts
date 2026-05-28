import { Timestamp } from 'firebase/firestore';

// ─── User ────────────────────────────────────────────────────────────────────

export interface UserProfile {
  uid: string;
  name: string;
  email: string;
  photoURL?: string;
  createdAt: Timestamp;
  lastLogin: Timestamp;
  role: 'owner' | 'admin' | 'member';
}

// ─── Room ────────────────────────────────────────────────────────────────────

export interface Room {
  id: string;
  name: string;
  ownerUid: string;
  createdAt: Timestamp;
  icon: string;
}

// ─── Device ──────────────────────────────────────────────────────────────────

export type DeviceType = 'relay' | 'sensor' | 'plug' | 'energy' | 'irrigation' | 'unknown';

export interface DeviceDoc {
  id: string;
  ownerUid: string;
  deviceName: string;
  roomId: string | null;
  relayCount: number;
  deviceType: DeviceType;
  firmwareVersion: string;
  onlineStatus: boolean;
  createdAt: Timestamp;
  lastHeartbeat: Timestamp | null;
}

// ─── RTDB Channel ────────────────────────────────────────────────────────────

export interface ChannelTimer {
  enabled: boolean;
  duration: number;   // seconds
  startTime: number;  // epoch ms
}

export interface ChannelSchedule {
  enabled: boolean;
  onTime: string;     // "HH:mm"
  offTime: string;    // "HH:mm"
  days: number[];     // 0=Sun … 6=Sat
}

export interface Channel {
  name: string;
  state: boolean;
  gpio: number;
  timer: ChannelTimer;
  schedule: ChannelSchedule;
}

export type ChannelKey = `ch${number}`;

export interface DeviceInfo {
  relayCount: number;
  firmwareVersion: string;
  deviceType: DeviceType;
  ownerId: string;
  password: string;   // SHA-256 hex stored in RTDB
}

export interface DeviceRTDB {
  info: DeviceInfo;
  channels: Record<ChannelKey, Channel>;
  heartbeat: number;  // epoch ms
  status: 'online' | 'offline';
}

// ─── Automation ──────────────────────────────────────────────────────────────

export type AutomationType = 'countdown' | 'schedule' | 'weekly';

export interface Automation {
  id: string;
  deviceId: string;
  channelKey: ChannelKey;
  channelName: string;
  deviceName: string;
  type: AutomationType;
  enabled: boolean;
  label: string;
  // Countdown
  duration?: number;         // seconds
  // Schedule / Weekly
  onTime?: string;           // "HH:mm"
  offTime?: string;          // "HH:mm"
  days?: number[];           // weekly only
  createdAt: Timestamp;
}

// ─── Notification ────────────────────────────────────────────────────────────

export type NotifType = 'success' | 'error' | 'warning' | 'info';

export interface AppNotification {
  id: string;
  message: string;
  type: NotifType;
  timestamp: number;
  read: boolean;
}

// ─── Utility ─────────────────────────────────────────────────────────────────

export interface PairDevicePayload {
  deviceId: string;
  password: string;
  deviceName: string;
  roomId: string | null;
}
