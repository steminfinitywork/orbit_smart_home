import { useEffect } from 'react';
import { onAuthChange } from '@/firebase/auth';
import { getUserProfile, updateLastLogin, createUserProfile } from '@/firebase/firestore';
import { useAuthStore } from '@/store/authStore';

export const useAuth = () => {
  const { user, profile, loading, setUser, setProfile, setLoading, clear } = useAuthStore();

  useEffect(() => {
    const unsub = onAuthChange(async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
        try {
          let prof = await getUserProfile(firebaseUser.uid);
          if (!prof) {
            // First-time Google sign-in — auto-create profile from Google account data
            await createUserProfile(
              firebaseUser.uid,
              firebaseUser.displayName || 'Orbit User',
              firebaseUser.email || '',
              firebaseUser.photoURL || undefined
            );
            prof = await getUserProfile(firebaseUser.uid);
          } else {
            await updateLastLogin(firebaseUser.uid);
          }
          setProfile(prof);
        } catch (e) {
          console.error('Profile fetch error:', e);
        }
      } else {
        clear();
      }
      setLoading(false);
    });
    return unsub;
  }, []);

  return { user, profile, loading, isAuthenticated: !!user };
};
