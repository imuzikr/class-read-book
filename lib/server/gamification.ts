/**
 * 서버 측 게임화(경험치/스트릭) 계산 유틸리티
 *
 * 날짜 계산은 모두 한국 시간(KST, UTC+9) 기준이다.
 * 서버(Vercel)는 UTC로 동작하므로 로컬 시간 함수를 쓰면 안 된다.
 */

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

// 연속 독서 보너스: 기록 1건당 (연속 일수 × 15) EXP
export const STREAK_BONUS_PER_DAY = 15;

// 감상문 작성 보너스 EXP
export const REVIEW_EXP_REWARD = 70;

/** KST 기준 달력상 날짜 번호 (1970-01-01 KST = 0). 일 단위 비교에 사용 */
export const kstDayNumber = (date: Date): number =>
  Math.floor((date.getTime() + KST_OFFSET_MS) / DAY_MS);

/** 'YYYY-MM-DD' 문자열 → KST 자정에 해당하는 Date. 형식이 틀리면 null */
export const parseKstDate = (value: unknown): Date | null => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }
  const date = new Date(`${value}T00:00:00+09:00`);
  return Number.isNaN(date.getTime()) ? null : date;
};

/** KST 기준 이번 달 1일 0시에 해당하는 시각 */
export const kstMonthStart = (now: Date = new Date()): Date => {
  const kst = new Date(now.getTime() + KST_OFFSET_MS);
  return new Date(Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), 1) - KST_OFFSET_MS);
};

export type RankingPeriod = 'daily' | 'weekly' | 'monthly' | 'all-time';

/** KST 기준 오늘 0시 */
export const kstDayStart = (now: Date = new Date()): Date =>
  new Date(kstDayNumber(now) * DAY_MS - KST_OFFSET_MS);

/** KST 기준 이번 주 월요일 0시 */
export const kstWeekStart = (now: Date = new Date()): Date => {
  const dayNum = kstDayNumber(now);
  const dayOfWeek = (dayNum + 4) % 7; // 0=일요일 (KST 날짜 번호 0인 1970-01-01은 목요일)
  const diffToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  return new Date((dayNum - diffToMonday) * DAY_MS - KST_OFFSET_MS);
};

/** 기간별 시작 시각 (all-time은 null) */
export const kstPeriodStart = (period: RankingPeriod, now: Date = new Date()): Date | null => {
  switch (period) {
    case 'daily':
      return kstDayStart(now);
    case 'weekly':
      return kstWeekStart(now);
    case 'monthly':
      return kstMonthStart(now);
    default:
      return null;
  }
};

export interface StreakResult {
  currentStreak: number;
  longestStreak: number;
  lastReadingDate: Date;
}

/**
 * 새 독서 기록 날짜를 반영한 연속 독서 일수 계산.
 * 과거 날짜를 소급 기록하는 경우 스트릭과 마지막 독서일은 그대로 유지한다.
 */
export const applyLogToStreak = (
  logDate: Date,
  prev: { currentStreak: number; longestStreak: number; lastReadingDate?: Date }
): StreakResult => {
  let currentStreak: number;
  let lastReadingDate = logDate;

  if (!prev.lastReadingDate) {
    currentStreak = 1;
  } else {
    const dayDiff = kstDayNumber(logDate) - kstDayNumber(prev.lastReadingDate);
    if (dayDiff === 0) {
      currentStreak = Math.max(prev.currentStreak, 1);
    } else if (dayDiff === 1) {
      currentStreak = prev.currentStreak + 1;
    } else if (dayDiff > 1) {
      currentStreak = 1;
    } else {
      currentStreak = prev.currentStreak;
      lastReadingDate = prev.lastReadingDate;
    }
  }

  return {
    currentStreak,
    longestStreak: Math.max(prev.longestStreak, currentStreak),
    lastReadingDate,
  };
};

/** 독서 기록 1건의 경험치 = 읽은 페이지 + 연속 독서 보너스 (보너스 포함 값을 로그에 저장한다) */
export const calculateLogExp = (pagesRead: number, currentStreak: number): number =>
  pagesRead + currentStreak * STREAK_BONUS_PER_DAY;
