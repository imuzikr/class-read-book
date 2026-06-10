/**
 * 뱃지 정의 (순수 데이터 모듈)
 * 클라이언트와 서버 양쪽에서 사용하므로 Firebase 의존성을 두지 않는다.
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
