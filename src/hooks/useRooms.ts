import { useEffect } from 'react';
import { onSnapshot, collection, query, where } from 'firebase/firestore';
import { db } from '@/firebase/config';
import { useDeviceStore } from '@/store/deviceStore';
import { Room } from '@/types';

export const useRooms = (ownerUid: string | undefined) => {
  const { rooms, setRooms, addRoom, updateRoom, removeRoom } = useDeviceStore();

  useEffect(() => {
    if (!ownerUid) return;
    const q = query(collection(db, 'rooms'), where('ownerUid', '==', ownerUid));
    const unsub = onSnapshot(q, (snap) => {
      const r: Room[] = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Room));
      setRooms(r);
    });
    return unsub;
  }, [ownerUid]);

  return { rooms, addRoom, updateRoom, removeRoom };
};
