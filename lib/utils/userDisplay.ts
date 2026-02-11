import type { User } from '@/types';

/**
 * 사용자의 표시 이름을 반환합니다.
 * useNickname이 true이면 별명을, false이면 실명을 반환합니다.
 */
export const getUserDisplayName = (userData: User | null | undefined): string => {
  if (!userData) return '사용자';
  
  if (userData.useNickname && userData.nickname) {
    return userData.nickname;
  }
  
  return userData.displayName || userData.name || '사용자';
};

/**
 * 사용자의 표시 이름을 반환합니다 (랭킹 등에서 사용)
 */
export const getUserDisplayNameForRanking = (userData: {
  nickname?: string;
  useNickname?: boolean;
  displayName?: string;
  name?: string;
  isAnonymous?: boolean;
} | null | undefined): string => {
  if (!userData) return '사용자';
  
  if (userData.isAnonymous) {
    return '익명 사용자';
  }
  
  if (userData.useNickname && userData.nickname) {
    return userData.nickname;
  }
  
  return userData.displayName || userData.name || '사용자';
};

