import { create } from 'zustand';
import { DeviceDoc, DeviceRTDB, Room } from '@/types';

interface DeviceState {
  devices: DeviceDoc[];
  rtdbData: Record<string, DeviceRTDB>;
  rooms: Room[];
  setDevices: (devices: DeviceDoc[]) => void;
  addDevice: (device: DeviceDoc) => void;
  updateDevice: (id: string, data: Partial<DeviceDoc>) => void;
  removeDevice: (id: string) => void;
  setRtdbData: (deviceId: string, data: DeviceRTDB | null) => void;
  setRooms: (rooms: Room[]) => void;
  addRoom: (room: Room) => void;
  updateRoom: (id: string, data: Partial<Room>) => void;
  removeRoom: (id: string) => void;
}

export const useDeviceStore = create<DeviceState>((set) => ({
  devices: [],
  rtdbData: {},
  rooms: [],

  setDevices: (devices) => set({ devices }),
  addDevice: (device) => set((s) => ({ devices: [...s.devices, device] })),
  updateDevice: (id, data) =>
    set((s) => ({ devices: s.devices.map((d) => (d.id === id ? { ...d, ...data } : d)) })),
  removeDevice: (id) =>
    set((s) => ({ devices: s.devices.filter((d) => d.id !== id) })),

  setRtdbData: (deviceId, data) =>
    set((s) => ({
      rtdbData: data
        ? { ...s.rtdbData, [deviceId]: data }
        : Object.fromEntries(Object.entries(s.rtdbData).filter(([k]) => k !== deviceId)),
    })),

  setRooms: (rooms) => set({ rooms }),
  addRoom: (room) => set((s) => ({ rooms: [...s.rooms, room] })),
  updateRoom: (id, data) =>
    set((s) => ({ rooms: s.rooms.map((r) => (r.id === id ? { ...r, ...data } : r)) })),
  removeRoom: (id) =>
    set((s) => ({ rooms: s.rooms.filter((r) => r.id !== id) })),
}));
