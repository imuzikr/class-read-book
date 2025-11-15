import { Timestamp } from 'firebase/firestore';

// 사용자 타입
export interface User {
  id: string;
  email: string;
  name: string;
  displayName?: string;
  photoURL?: string;
  level: number;
  exp: number;
  totalPagesRead: number;
  totalBooksRead: number;
  currentStreak: number;
  longestStreak: number;
  lastReadingDate?: Date;
  createdAt: Date;
  updatedAt: Date;
  isAnonymous: boolean;
}

// 책 타입
export interface Book {
  id: string;
  userId: string;
  title: string;
  author: string;
  totalPages: number;
  currentPage: number;
  startDate: Date;
  finishDate?: Date;
  status: 'reading' | 'completed' | 'paused';
  coverImage?: string;
  createdAt: Date;
  updatedAt: Date;
}

// 독서 기록 타입
export interface ReadingLog {
  id: string;
  userId: string;
  bookId: string;
  date: Date;
  pagesRead: number;
  notes?: string;
  expGained: number;
  createdAt: Date;
}

// 감상문 타입
export interface Review {
  id: string;
  userId: string;
  bookId: string;
  content: string;
  rating: number;
  createdAt: Date;
  updatedAt: Date;
}

// 뱃지 타입
export interface Badge {
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
  createdAt: Date;
}

// 사용자 뱃지 타입
export interface UserBadge {
  id: string;
  userId: string;
  badgeId: string;
  earnedAt: Date;
}

// 랭킹 타입
export interface Ranking {
  userId: string;
  period: 'daily' | 'weekly' | 'monthly' | 'all-time';
  totalExp: number;
  rank: number;
  updatedAt: Date;
}

