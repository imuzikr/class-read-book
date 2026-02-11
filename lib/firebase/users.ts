import { collection, query, getDocs, limit, orderBy, where } from 'firebase/firestore';
import { db } from './config';
import { User } from '@/types';

/**
 * 모든 사용자 데이터 가져오기 (공개 정보만)
 * 주의: 익명화 옵션이 켜진 사용자는 제외됩니다.
 */
export const getAllUsers = async (limitCount: number = 100): Promise<Array<User & { id: string }>> => {
  if (!db) {
    throw new Error('Firebase가 설정되지 않았습니다.');
  }

  // 익명화되지 않은 사용자만 가져오기 (또는 모든 사용자)
  // 실제로는 보안 규칙에서 제한되므로, 여기서는 모든 사용자를 가져옴
  const q = query(
    collection(db, 'users'),
    orderBy('exp', 'desc'),
    limit(limitCount)
  );

  const querySnapshot = await getDocs(q);
  
  return querySnapshot.docs
    .filter(doc => {
      const data = doc.data() as User;
      // 익명화 옵션이 켜진 사용자는 제외 (선택사항)
      return !data.isAnonymous;
    })
    .map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as Array<User & { id: string }>;
};

/**
 * 특정 사용자들의 데이터 가져오기
 */
export const getUsersByIds = async (userIds: string[]): Promise<User[]> => {
  if (!db) {
    throw new Error('Firebase가 설정되지 않았습니다.');
  }

  // Firestore의 'in' 쿼리는 최대 10개까지만 가능
  const chunks: string[][] = [];
  for (let i = 0; i < userIds.length; i += 10) {
    chunks.push(userIds.slice(i, i + 10));
  }

  const { where, getDocs: getDocsQuery } = await import('firebase/firestore');
  const allUsers: User[] = [];

  for (const chunk of chunks) {
    const q = query(
      collection(db, 'users'),
      where('__name__', 'in', chunk)
    );
    const querySnapshot = await getDocsQuery(q);
    allUsers.push(...(querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as unknown as User[]));
  }

  return allUsers;
};

