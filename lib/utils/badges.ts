import type { User, Book, ReadingLog, Review } from '@/types';
import { Timestamp } from 'firebase/firestore';

/**
 * 뱃지 타입 정의
 */
export interface BadgeDefinition {
  id: string;
  name: string;
  description: string;
  icon: string;
  expReward: number;
  condition: {
    type: 'first_book' | 'streak_days' | 'books_completed' | 'pages_month' | 'reviews_written' | 'level_reached';
    value: number;
  };
  order: number;
}

/**
 * 기본 뱃지 정의
 */
export const BADGE_DEFINITIONS: BadgeDefinition[] = [
  {
    id: 'first_book',
    name: '첫 걸음',
    description: '첫 책을 등록하세요',
    icon: '📖',
    expReward: 20,
    condition: { type: 'first_book', value: 1 },
    order: 1,
  },
  {
    id: 'reading_habit_7',
    name: '독서 습관',
    description: '7일 연속 독서하기',
    icon: '🔥',
    expReward: 50,
    condition: { type: 'streak_days', value: 7 },
    order: 2,
  },
  {
    id: 'reading_habit_30',
    name: '독서 마니아',
    description: '30일 연속 독서하기',
    icon: '⭐',
    expReward: 100,
    condition: { type: 'streak_days', value: 30 },
    order: 3,
  },
  {
    id: 'reading_habit_100',
    name: '지속가',
    description: '100일 연속 독서하기',
    icon: '💎',
    expReward: 200,
    condition: { type: 'streak_days', value: 100 },
    order: 4,
  },
  {
    id: 'first_completed',
    name: '완독가',
    description: '첫 책 완독하기',
    icon: '✅',
    expReward: 50,
    condition: { type: 'books_completed', value: 1 },
    order: 5,
  },
  {
    id: 'many_books_10',
    name: '다독가',
    description: '10권 완독하기',
    icon: '📚',
    expReward: 150,
    condition: { type: 'books_completed', value: 10 },
    order: 6,
  },
  {
    id: 'first_review',
    name: '감상가',
    description: '첫 감상문 작성하기',
    icon: '✍️',
    expReward: 30,
    condition: { type: 'reviews_written', value: 1 },
    order: 7,
  },
  {
    id: 'pages_month_500',
    name: '열정가',
    description: '한 달에 500페이지 읽기',
    icon: '🔥',
    expReward: 100,
    condition: { type: 'pages_month', value: 500 },
    order: 8,
  },
  {
    id: 'pages_month_1000',
    name: '마라토너',
    description: '한 달에 1000페이지 읽기',
    icon: '🏃',
    expReward: 200,
    condition: { type: 'pages_month', value: 1000 },
    order: 9,
  },
  {
    id: 'level_10',
    name: '마스터',
    description: '레벨 10 달성하기',
    icon: '👑',
    expReward: 300,
    condition: { type: 'level_reached', value: 10 },
    order: 10,
  },
];

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

