import {
  doc,
  setDoc,
  getDoc,
  updateDoc,
  deleteDoc,
  collection,
  query,
  where,
  getDocs,
  serverTimestamp,
  Timestamp,
  addDoc,
} from 'firebase/firestore';
import { db } from './config';
import { DeviceDoc, Room, UserProfile, Automation } from '@/types';

// ─── Users ───────────────────────────────────────────────────────────────────

export const createUserProfile = async (uid: string, name: string, email: string, photoURL?: string) => {
  await setDoc(doc(db, 'users', uid), {
    uid,
    name,
    email,
    photoURL: photoURL ?? null,
    createdAt: serverTimestamp(),
    lastLogin: serverTimestamp(),
    role: 'owner',
  });
};

export const getUserProfile = async (uid: string): Promise<UserProfile | null> => {
  const snap = await getDoc(doc(db, 'users', uid));
  return snap.exists() ? (snap.data() as UserProfile) : null;
};

export const updateLastLogin = async (uid: string) => {
  await updateDoc(doc(db, 'users', uid), { lastLogin: serverTimestamp() });
};

export const updateUserName = async (uid: string, name: string) => {
  await updateDoc(doc(db, 'users', uid), { name });
};

// ─── Rooms ───────────────────────────────────────────────────────────────────

export const createRoom = async (ownerUid: string, name: string, icon: string): Promise<string> => {
  const ref = await addDoc(collection(db, 'rooms'), {
    name,
    ownerUid,
    icon,
    createdAt: serverTimestamp(),
  });
  return ref.id;
};

export const getRooms = async (ownerUid: string): Promise<Room[]> => {
  const q = query(collection(db, 'rooms'), where('ownerUid', '==', ownerUid));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Room));
};

export const updateRoom = async (roomId: string, data: Partial<Room>) => {
  await updateDoc(doc(db, 'rooms', roomId), data as Record<string, unknown>);
};

export const deleteRoom = async (roomId: string) => {
  await deleteDoc(doc(db, 'rooms', roomId));
};

// ─── Devices ─────────────────────────────────────────────────────────────────

export const createDevice = async (deviceId: string, data: Omit<DeviceDoc, 'id'>) => {
  await setDoc(doc(db, 'devices', deviceId), {
    ...data,
    createdAt: serverTimestamp(),
    lastHeartbeat: null,
    onlineStatus: false,
  });
};

export const getDevices = async (ownerUid: string): Promise<DeviceDoc[]> => {
  const q = query(collection(db, 'devices'), where('ownerUid', '==', ownerUid));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as DeviceDoc));
};

export const getDevice = async (deviceId: string): Promise<DeviceDoc | null> => {
  const snap = await getDoc(doc(db, 'devices', deviceId));
  return snap.exists() ? ({ id: snap.id, ...snap.data() } as DeviceDoc) : null;
};

export const updateDevice = async (deviceId: string, data: Partial<DeviceDoc>) => {
  await updateDoc(doc(db, 'devices', deviceId), data as Record<string, unknown>);
};

export const deleteDeviceDoc = async (deviceId: string) => {
  await deleteDoc(doc(db, 'devices', deviceId));
};

export const updateDeviceHeartbeat = async (deviceId: string, online: boolean) => {
  await updateDoc(doc(db, 'devices', deviceId), {
    onlineStatus: online,
    lastHeartbeat: Timestamp.now(),
  });
};

// ─── Automations ─────────────────────────────────────────────────────────────

export const createAutomation = async (ownerUid: string, data: Omit<Automation, 'id' | 'createdAt'>): Promise<string> => {
  const ref = await addDoc(collection(db, 'automations'), {
    ...data,
    ownerUid,
    createdAt: serverTimestamp(),
  });
  return ref.id;
};

export const getAutomations = async (ownerUid: string): Promise<Automation[]> => {
  const q = query(collection(db, 'automations'), where('ownerUid', '==', ownerUid));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Automation));
};

export const updateAutomation = async (id: string, data: Partial<Automation>) => {
  await updateDoc(doc(db, 'automations', id), data as Record<string, unknown>);
};

export const deleteAutomation = async (id: string) => {
  await deleteDoc(doc(db, 'automations', id));
};
