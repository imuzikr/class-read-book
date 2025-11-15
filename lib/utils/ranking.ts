import { Timestamp } from 'firebase/firestore';
import type { UserData } from '@/lib/firebase/firestore';
import { getUserDisplayNameForRanking } from './userDisplay';

/**
 * 랭킹 기간 타입
 */
export type RankingPeriod = 'daily' | 'weekly' | 'monthly' | 'all-time';

/**
 * 랭킹 항목
 */
export interface RankingItem {
  userId: string;
  userName: string;
  userEmail: string;
  totalExp: number;
  rank: number;
  isAnonymous: boolean;
}

/**
 * 기간별 시작 날짜 계산
 */
export const getPeriodStartDate = (period: RankingPeriod): Date | null => {
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  switch (period) {
    case 'daily':
      return now;

    case 'weekly':
      const weekStart = new Date(now);
      const dayOfWeek = weekStart.getDay();
      const diff = weekStart.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1); // 월요일 기준
      weekStart.setDate(diff);
      return weekStart;

    case 'monthly':
      const monthStart = new Date(now);
      monthStart.setDate(1);
      return monthStart;

    case 'all-time':
      return null; // 전체 기간

    default:
      return null;
  }
};

/**
 * 기간별 경험치 계산
 */
export const calculatePeriodExp = async (
  userId: string,
  period: RankingPeriod,
  userData: UserData
): Promise<number> => {
  if (period === 'all-time') {
    return userData.exp;
  }

  const startDate = getPeriodStartDate(period);
  if (!startDate) {
    return userData.exp;
  }

  const { getReadingLogs, getReviews } = await import('@/lib/firebase/firestore');
  
  // 해당 기간의 독서 기록 가져오기
  const readingLogs = await getReadingLogs(userId);
  const periodLogs = readingLogs.filter(log => {
    const logDate = log.date.toDate();
    return logDate >= startDate;
  });

  // 해당 기간의 감상문 가져오기
  const reviews = await getReviews(userId);
  const periodReviews = reviews.filter(review => {
    const reviewDate = review.createdAt.toDate();
    return reviewDate >= startDate;
  });

  // 경험치 계산
  let exp = 0;
  
  // 독서 기록 경험치
  periodLogs.forEach(log => {
    exp += log.expGained;
  });

  // 감상문 경험치 (50 EXP per review)
  exp += periodReviews.length * 50;

  // 뱃지 경험치는 전체 기간으로 계산 (복잡하므로 제외)

  return exp;
};

/**
 * 랭킹 업데이트
 */
export const updateRanking = async (
  userId: string,
  period: RankingPeriod,
  totalExp: number
): Promise<void> => {
  const { db } = await import('@/lib/firebase/config');
  const { doc, setDoc } = await import('firebase/firestore');

  if (!db) {
    throw new Error('Firebase가 설정되지 않았습니다.');
  }

  const docId = `${userId}_${period}`;
  const docRef = doc(db, 'rankings', docId);

  await setDoc(docRef, {
    userId,
    period,
    totalExp,
    updatedAt: Timestamp.now(),
  }, { merge: true });
};

/**
 * 랭킹 조회
 */
export const getRankings = async (
  period: RankingPeriod,
  limitCount: number = 100
): Promise<RankingItem[]> => {
  const { db } = await import('@/lib/firebase/config');
  const { collection, query, where, orderBy, limit, getDocs } = await import('firebase/firestore');
  const { getUserData } = await import('@/lib/firebase/firestore');

  if (!db) {
    throw new Error('Firebase가 설정되지 않았습니다.');
  }

  const q = query(
    collection(db, 'rankings'),
    where('period', '==', period),
    orderBy('totalExp', 'desc'),
    limit(limitCount)
  );

  const querySnapshot = await getDocs(q);
  const rankings: RankingItem[] = [];

  let rank = 1;
  for (let i = 0; i < querySnapshot.docs.length; i++) {
    const doc = querySnapshot.docs[i];
    const data = doc.data();
    const userData = await getUserData(data.userId);

    if (userData) {
      // 관리자 계정은 랭킹에서 제외
      const { isAdmin } = await import('@/lib/firebase/firestore');
      const userIsAdmin = await isAdmin(data.userId);
      if (userIsAdmin) {
        continue; // 관리자는 건너뛰기
      }

      rankings.push({
        userId: data.userId,
        userName: getUserDisplayNameForRanking(userData),
        userEmail: userData.email,
        totalExp: data.totalExp,
        rank: rank++,
        isAnonymous: userData.isAnonymous || false,
      });
    }
  }

  return rankings;
};

/**
 * 사용자의 랭킹 조회
 */
export const getUserRanking = async (
  userId: string,
  period: RankingPeriod
): Promise<RankingItem | null> => {
  const rankings = await getRankings(period, 1000); // 충분히 큰 수
  const userRanking = rankings.find(r => r.userId === userId);
  return userRanking || null;
};

