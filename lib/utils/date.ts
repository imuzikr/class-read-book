import { format, startOfDay, endOfDay, isSameDay, differenceInDays } from 'date-fns';
import { ko } from 'date-fns/locale';

/**
 * 날짜 유틸리티 함수
 */

// 날짜를 YYYY-MM-DD 형식으로 포맷
export const formatDate = (date: Date): string => {
  return format(date, 'yyyy-MM-dd');
};

// 날짜를 한국어 형식으로 포맷
export const formatDateKorean = (date: Date): string => {
  return format(date, 'yyyy년 MM월 dd일', { locale: ko });
};

// 날짜의 시작 시간 (00:00:00)
export const getStartOfDay = (date: Date): Date => {
  return startOfDay(date);
};

// 날짜의 끝 시간 (23:59:59)
export const getEndOfDay = (date: Date): Date => {
  return endOfDay(date);
};

// 두 날짜가 같은 날인지 확인
export const isSameDate = (date1: Date, date2: Date): boolean => {
  return isSameDay(date1, date2);
};

// 두 날짜 사이의 일수 차이 계산
export const getDaysDifference = (date1: Date, date2: Date): number => {
  return differenceInDays(date2, date1);
};

// 오늘 날짜
export const getToday = (): Date => {
  return new Date();
};

// 어제 날짜
export const getYesterday = (): Date => {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return yesterday;
};

