import { Timestamp } from 'firebase/firestore';
import { isSameDate, getDaysDifference, getYesterday } from './date';

/**
 * 연속 독서 일수 계산 유틸리티
 */

export interface StreakData {
  currentStreak: number;
  longestStreak: number;
  lastReadingDate?: Date;
}

/**
 * 독서 기록 날짜 배열로부터 연속 독서 일수 계산
 */
export const calculateStreak = (
  readingDates: Date[],
  currentStreak: number = 0,
  lastReadingDate?: Date
): StreakData => {
  if (readingDates.length === 0) {
    return {
      currentStreak: 0,
      longestStreak: 0,
      lastReadingDate: undefined,
    };
  }

  // 날짜를 정렬 (최신순)
  const sortedDates = [...readingDates].sort((a, b) => b.getTime() - a.getTime());
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = getYesterday();
  yesterday.setHours(0, 0, 0, 0);

  let streak = 0;
  let checkDate = new Date(today);
  checkDate.setHours(0, 0, 0, 0);

  // 오늘 또는 어제 기록이 있는지 확인
  const hasToday = sortedDates.some(date => isSameDate(date, today));
  const hasYesterday = sortedDates.some(date => isSameDate(date, yesterday));

  // 연속 독서 일수 계산
  if (hasToday || hasYesterday) {
    // 오늘 기록이 있으면 오늘부터, 없으면 어제부터 시작
    if (!hasToday && hasYesterday) {
      checkDate = new Date(yesterday);
    }

    // 연속된 날짜를 역순으로 확인
    for (let i = 0; i < sortedDates.length; i++) {
      const date = new Date(sortedDates[i]);
      date.setHours(0, 0, 0, 0);

      if (isSameDate(date, checkDate)) {
        streak++;
        checkDate.setDate(checkDate.getDate() - 1);
      } else if (date < checkDate) {
        // 연속이 끊김
        break;
      }
    }
  }

  // 최장 연속 독서 일수 계산
  let longestStreak = streak;
  let tempStreak = 0;
  let prevDate: Date | null = null;

  for (const date of sortedDates) {
    const normalizedDate = new Date(date);
    normalizedDate.setHours(0, 0, 0, 0);

    if (prevDate === null) {
      tempStreak = 1;
      prevDate = normalizedDate;
    } else {
      const daysDiff = getDaysDifference(normalizedDate, prevDate);
      if (daysDiff === 1) {
        // 연속된 날짜
        tempStreak++;
      } else if (daysDiff === 0) {
        // 같은 날짜 (무시)
        continue;
      } else {
        // 연속이 끊김
        longestStreak = Math.max(longestStreak, tempStreak);
        tempStreak = 1;
      }
      prevDate = normalizedDate;
    }
  }
  longestStreak = Math.max(longestStreak, tempStreak);

  return {
    currentStreak: streak,
    longestStreak,
    lastReadingDate: sortedDates[0],
  };
};

/**
 * 새로운 독서 기록 추가 시 연속 독서 일수 업데이트
 */
export const updateStreakOnNewLog = (
  newLogDate: Date,
  currentStreak: number,
  lastReadingDate?: Date
): StreakData => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = getYesterday();
  yesterday.setHours(0, 0, 0, 0);

  const logDate = new Date(newLogDate);
  logDate.setHours(0, 0, 0, 0);

  let newStreak = currentStreak;
  let longestStreak = currentStreak;

  // 오늘 기록인 경우
  if (isSameDate(logDate, today)) {
    if (lastReadingDate) {
      const lastDate = new Date(lastReadingDate);
      lastDate.setHours(0, 0, 0, 0);
      const daysDiff = getDaysDifference(lastDate, today);

      if (daysDiff === 1) {
        // 어제 기록이 있으면 연속
        newStreak = currentStreak + 1;
      } else if (daysDiff === 0) {
        // 오늘 이미 기록이 있으면 그대로
        newStreak = currentStreak;
      } else {
        // 연속이 끊겼으면 1일부터 시작
        newStreak = 1;
      }
    } else {
      // 첫 기록
      newStreak = 1;
    }
  } else if (isSameDate(logDate, yesterday)) {
    // 어제 기록인 경우
    if (lastReadingDate) {
      const lastDate = new Date(lastReadingDate);
      lastDate.setHours(0, 0, 0, 0);
      const daysDiff = getDaysDifference(lastDate, yesterday);

      if (daysDiff === 1) {
        newStreak = currentStreak + 1;
      } else if (daysDiff === 0) {
        newStreak = currentStreak;
      } else {
        newStreak = 1;
      }
    } else {
      newStreak = 1;
    }
  } else {
    // 과거 기록인 경우 (일반적으로 발생하지 않지만 처리)
    if (lastReadingDate) {
      const lastDate = new Date(lastReadingDate);
      lastDate.setHours(0, 0, 0, 0);
      const daysDiff = getDaysDifference(logDate, lastDate);

      if (daysDiff === 1) {
        newStreak = currentStreak + 1;
      } else {
        newStreak = 1;
      }
    } else {
      newStreak = 1;
    }
  }

  longestStreak = Math.max(currentStreak, newStreak);

  return {
    currentStreak: newStreak,
    longestStreak,
    lastReadingDate: logDate,
  };
};

