/**
 * 게임화 시스템 유틸리티 함수
 */

// 레벨별 필요 경험치 계산
export const getExpForLevel = (level: number): number => {
  if (level <= 1) return 0;
  if (level === 2) return 100;
  if (level === 3) return 250;
  if (level === 4) return 500;
  if (level === 5) return 1000;
  
  // 레벨 6 이상: 이전 레벨 * 1.5
  let exp = 1000;
  for (let i = 6; i <= level; i++) {
    exp = Math.round(exp * 1.5);
  }
  return exp;
};

// 현재 경험치로 레벨 계산
export const getLevelFromExp = (exp: number): number => {
  let level = 1;
  while (getExpForLevel(level + 1) <= exp) {
    level++;
  }
  return level;
};

// 다음 레벨까지 필요한 경험치
export const getExpToNextLevel = (currentExp: number, currentLevel: number): number => {
  const nextLevelExp = getExpForLevel(currentLevel + 1);
  return Math.max(0, nextLevelExp - currentExp);
};

// 레벨업 진행률 (0-100)
export const getLevelProgress = (currentExp: number, currentLevel: number): number => {
  const currentLevelExp = getExpForLevel(currentLevel);
  const nextLevelExp = getExpForLevel(currentLevel + 1);
  const expInCurrentLevel = currentExp - currentLevelExp;
  const expNeededForNextLevel = nextLevelExp - currentLevelExp;
  
  if (expNeededForNextLevel === 0) return 100;
  
  // 진행률 계산 (0-100 범위로 제한)
  const progress = Math.round((expInCurrentLevel / expNeededForNextLevel) * 100);
  return Math.min(100, Math.max(0, progress));
};

// 경험치 획득 계산
export const calculateExpGain = (
  pagesRead: number,
  isStreakBonus: boolean = false,
  streakDays: number = 0
): number => {
  let exp = pagesRead; // 1페이지당 1 EXP
  
  // 연속 독서 보너스
  if (isStreakBonus && streakDays > 0) {
    exp += streakDays * 10;
  }
  
  return exp;
};

// 뱃지 획득 조건 체크 (클라이언트 측 기본 체크)
export const checkBadgeConditions = {
  first_book: (booksCount: number) => booksCount >= 1,
  streak_days: (streakDays: number, requiredDays: number) => streakDays >= requiredDays,
  books_completed: (completedBooks: number, requiredBooks: number) => completedBooks >= requiredBooks,
  pages_month: (pagesThisMonth: number, requiredPages: number) => pagesThisMonth >= requiredPages,
  reviews_written: (reviewsCount: number, requiredReviews: number) => reviewsCount >= requiredReviews,
  level_reached: (level: number, requiredLevel: number) => level >= requiredLevel,
};

