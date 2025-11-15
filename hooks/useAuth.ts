import { useEffect, useState } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase/config';
import { isAdmin } from '@/lib/firebase/firestore';

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdminUser, setIsAdminUser] = useState(false);
  const [adminLoading, setAdminLoading] = useState(true);

  useEffect(() => {
    if (!auth) {
      setLoading(false);
      setAdminLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      setLoading(false);
      
      // 관리자 확인
      if (user) {
        try {
          const adminStatus = await isAdmin(user.uid);
          setIsAdminUser(adminStatus);
        } catch (error) {
          console.error('관리자 확인 실패:', error);
          setIsAdminUser(false);
        }
      } else {
        setIsAdminUser(false);
      }
      setAdminLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return { user, loading, isAdmin: isAdminUser, adminLoading };
};

