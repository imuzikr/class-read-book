import type { User, Book, ReadingLog, Review } from '@/types';
import { Timestamp } from 'firebase/firestore';
import { BADGE_DEFINITIONS, type BadgeDefinition } from './badgeDefinitions';

// 뱃지 정의는 badgeDefinitions.ts로 분리됨 (서버/클라이언트 공용)
export { BADGE_DEFINITIONS };
export type { BadgeDefinition };

/**
 * 뱃지 획득 조건 체크
 */
export const checkBadgeCondition = (
  badge: BadgeDefinition,
  userData: User,
  books: Book[],
  reviews: Review[],
  readingLogs: ReadingLog[]
): boolean => {
  const { type, value } = badge.condition;

  switch (type) {
    case 'first_book':
      return books.length >= value;

    case 'streak_days':
      return userData.currentStreak >= value;

    case 'books_completed':
      const completedBooks = books.filter(b => b.status === 'completed').length;
      return completedBooks >= value;

    case 'reviews_written':
      return reviews.length >= value;

    case 'level_reached':
      return userData.level >= value;

    case 'pages_month':
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      
      const logsThisMonth = readingLogs.filter(log => {
        const logDate = log.date;
        return logDate >= startOfMonth && logDate <= endOfMonth;
      });
      
      const pagesThisMonth = logsThisMonth.reduce((sum, log) => sum + log.pagesRead, 0);
      return pagesThisMonth >= value;

    default:
      return false;
  }
};

/**
 * 사용자가 획득 가능한 새로운 뱃지 찾기
 */
export const findNewBadges = async (
  userData: User,
  userId: string,
  existingBadgeIds: string[]
): Promise<BadgeDefinition[]> => {
  const { getBooks, getReviews, getReadingLogs } = await import('@/lib/firebase/firestore');
  
  const [books, reviews, readingLogs] = await Promise.all([
    getBooks(userId),
    getReviews(userId),
    getReadingLogs(userId),
  ]);

  const newBadges: BadgeDefinition[] = [];

  for (const badge of BADGE_DEFINITIONS) {
    // 이미 획득한 뱃지는 제외
    if (existingBadgeIds.includes(badge.id)) {
      continue;
    }

    // 조건 체크
    if (checkBadgeCondition(badge, userData, books, reviews, readingLogs)) {
      newBadges.push(badge);
    }
  }

  return newBadges;
};

/**
 * 뱃지 획득 처리
 */
export const awardBadge = async (
  userId: string,
  badgeId: string,
  expReward: number
): Promise<void> => {
  const { getUserData, updateUserData } = await import('@/lib/firebase/firestore');
  const { addDoc, collection } = await import('firebase/firestore');
  const { db } = await import('@/lib/firebase/config');

  if (!db) {
    throw new Error('Firebase가 설정되지 않았습니다.');
  }

  // 사용자 뱃지 추가
  await addDoc(collection(db, 'userBadges'), {
    userId,
    badgeId,
    earnedAt: Timestamp.now(),
  });

  // 경험치 추가 및 레벨 업데이트
  const userData = await getUserData(userId);
  if (userData) {
    const { getLevelFromExp } = await import('./game');
    const newExp = userData.exp + expReward;
    const newLevel = getLevelFromExp(newExp);
    
    await updateUserData(userId, {
      exp: newExp,
      level: newLevel,
    });
  }
};

