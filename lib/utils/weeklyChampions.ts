import { getRankings } from './ranking';
import { getUserData } from '@/lib/firebase/firestore';
import { getReadingLogs } from '@/lib/firebase/firestore';
import { getPeriodStartDate } from './ranking';
import { getUserDisplayNameForRanking } from './userDisplay';

/**
 * 주간 독서 대장 정보
 */
export interface WeeklyChampion {
  userId: string;
  userName: string;
  userPhotoURL?: string;
  rank: number;
  weeklyStreak: number; // 주간 연속 독서 일수
  weeklyPages: number; // 주간 독서 분량
  weeklyExp: number; // 주간 경험치
  score: number; // 종합 점수
  recentBookCover?: string; // 최근 읽은 책 커버 이미지
  character?: {
    animalType: string;
    outfitColor: string;
    outfitDesign: string;
  }; // 사용자 캐릭터 정보
}

/**
 * 주간 연속 독서 일수 계산 (월~일)
 */
const calculateWeeklyStreak = async (userId: string): Promise<number> => {
  const weekStart = getPeriodStartDate('weekly');
  if (!weekStart) return 0;

  const readingLogs = await getReadingLogs(userId);
  const weekLogs = readingLogs.filter(log => {
    const logDate = log.date.toDate();
    return logDate >= weekStart;
  });

  if (weekLogs.length === 0) return 0;

  // 날짜별로 그룹화 (중복 제거)
  const datesSet = new Set<string>();
  weekLogs.forEach(log => {
    const date = log.date.toDate();
    date.setHours(0, 0, 0, 0);
    const dateKey = date.getTime().toString();
    datesSet.add(dateKey);
  });

  // 날짜를 숫자로 변환하여 정렬
  const dates = Array.from(datesSet)
    .map(time => new Date(parseInt(time)))
    .sort((a, b) => b.getTime() - a.getTime()); // 최신순 정렬
  
  if (dates.length === 0) return 0;

  // 오늘 날짜 설정
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  // 어제 날짜 설정
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  
  // 오늘 또는 어제 기록이 있는지 확인
  const hasToday = dates.some(date => date.getTime() === today.getTime());
  const hasYesterday = dates.some(date => date.getTime() === yesterday.getTime());
  
  if (!hasToday && !hasYesterday) {
    return 0; // 오늘과 어제 모두 기록이 없으면 연속이 끊김
  }

  // 시작 날짜 결정 (오늘 기록이 있으면 오늘부터, 없으면 어제부터)
  let checkDate = hasToday ? new Date(today) : new Date(yesterday);
  let streak = 0;
  
  // 주간 시작일까지만 확인
  const weekEnd = new Date(today);
  weekEnd.setHours(23, 59, 59, 999);
  
  // 연속된 날짜 확인
  while (checkDate >= weekStart) {
    const dateExists = dates.some(date => date.getTime() === checkDate.getTime());
    
    if (dateExists) {
      streak++;
      checkDate.setDate(checkDate.getDate() - 1);
    } else {
      break; // 연속이 끊김
    }
  }

  return streak;
};

/**
 * 주간 독서 분량 계산 (월~일)
 */
const calculateWeeklyPages = async (userId: string): Promise<number> => {
  const weekStart = getPeriodStartDate('weekly');
  if (!weekStart) return 0;

  const readingLogs = await getReadingLogs(userId);
  const weekLogs = readingLogs.filter(log => {
    const logDate = log.date.toDate();
    return logDate >= weekStart;
  });

  return weekLogs.reduce((total, log) => total + log.pagesRead, 0);
};

/**
 * 주간 독서 대장 상위 3명 조회
 */
export const getWeeklyChampions = async (limit: number = 3): Promise<WeeklyChampion[]> => {
  // 주간 랭킹에서 상위 사용자들 가져오기
  const rankings = await getRankings('weekly', 50); // 충분히 많은 사용자 가져오기

  if (rankings.length === 0) {
    return [];
  }

  // 각 사용자의 주간 연속 독서 일수와 독서 분량 계산
  const championsData: Omit<WeeklyChampion, 'score'>[] = [];

  for (const ranking of rankings) {
    try {
      const [weeklyStreak, weeklyPages, userData] = await Promise.all([
        calculateWeeklyStreak(ranking.userId),
        calculateWeeklyPages(ranking.userId),
        getUserData(ranking.userId),
      ]);

      // 주간 독서일이 0이면 제외 (주간 독서일이 0이면 주간 경험치도 0이어야 함)
      // 주간 독서일이 0이라는 것은 주간에 독서 기록이 없다는 의미이므로 대장에 포함되면 안 됨
      if (weeklyStreak === 0) {
        continue;
      }

      // 주간 경험치 재계산 (주간 독서 기록 기반으로만 계산)
      // 주간 독서일이 0이 아니므로 주간 독서 기록이 있음
      const weekStart = getPeriodStartDate('weekly');
      let actualWeeklyExp = 0;
      if (weekStart) {
        const { getReadingLogs, getReviews } = await import('@/lib/firebase/firestore');
        const readingLogs = await getReadingLogs(ranking.userId);
        const weekLogs = readingLogs.filter(log => {
          const logDate = log.date.toDate();
          return logDate >= weekStart;
        });
        
        // 주간 독서 기록 경험치만 계산 (독서 기록이 있어야 경험치가 있음)
        weekLogs.forEach(log => {
          actualWeeklyExp += log.expGained;
        });
        
        // 감상문 경험치는 주간 독서 기록이 있을 때만 포함
        // (주간에 읽은 책에 대한 감상문만 인정)
        if (weekLogs.length > 0) {
          const reviews = await getReviews(ranking.userId);
          const weekReviews = reviews.filter(review => {
            const reviewDate = review.createdAt.toDate();
            // 감상문이 주간 기간 내에 작성되었고, 주간에 읽은 책에 대한 감상문인지 확인
            if (reviewDate >= weekStart) {
              // 주간에 읽은 책 ID 목록
              const weekBookIds = new Set(weekLogs.map(log => log.bookId));
              return weekBookIds.has(review.bookId);
            }
            return false;
          });
          actualWeeklyExp += weekReviews.length * 70;
        }
      }

      // 관리자 계정 제외
      if (userData) {
        const { isAdmin } = await import('@/lib/firebase/firestore');
        const userIsAdmin = await isAdmin(ranking.userId);
        if (userIsAdmin) {
          continue;
        }
      }

      // 최근 읽은 책 커버 이미지 가져오기
      const { getBooks } = await import('@/lib/firebase/firestore');
      let recentBookCover: string | undefined = undefined;
      
      try {
        const books = await getBooks(ranking.userId);
        
        // 읽는 중인 책 우선, 없으면 완독한 책
        const readingBooks = books.filter(book => book.status === 'reading');
        const completedBooks = books.filter(book => book.status === 'completed');
        
        const recentBook = readingBooks.length > 0
          ? readingBooks.sort((a, b) => {
              const aTime = a.updatedAt?.toMillis() || 0;
              const bTime = b.updatedAt?.toMillis() || 0;
              return bTime - aTime;
            })[0]
          : completedBooks.length > 0
          ? completedBooks.sort((a, b) => {
              const aTime = a.updatedAt?.toMillis() || 0;
              const bTime = b.updatedAt?.toMillis() || 0;
              return bTime - aTime;
            })[0]
          : null;

        if (recentBook && recentBook.coverImage) {
          recentBookCover = recentBook.coverImage;
          console.log(`[주간 대장] ${getUserDisplayNameForRanking(userData)}의 책 커버:`, recentBook.coverImage);
        } else if (recentBook) {
          console.log(`[주간 대장] ${getUserDisplayNameForRanking(userData)}의 책 "${recentBook.title}"에는 커버 이미지가 없습니다.`);
        }
      } catch (error) {
        console.error(`[주간 대장] 사용자 ${ranking.userId}의 책 정보 가져오기 실패:`, error);
      }

      championsData.push({
        userId: ranking.userId,
        userName: getUserDisplayNameForRanking(userData),
        userPhotoURL: userData?.photoURL,
        rank: ranking.rank,
        weeklyStreak,
        weeklyPages,
        weeklyExp: actualWeeklyExp, // 실제 계산된 주간 경험치 사용
        recentBookCover,
        character: userData?.character,
      });
    } catch (error) {
      console.error(`사용자 ${ranking.userId} 데이터 처리 실패:`, error);
      continue;
    }
  }

  // 최대값 계산 (정규화를 위해)
  const maxStreak = Math.max(...championsData.map(c => c.weeklyStreak), 7);
  const maxPages = Math.max(...championsData.map(c => c.weeklyPages), 1);

  // 종합 점수 계산 및 추가
  const championsWithScore: WeeklyChampion[] = championsData.map(champion => {
    // 정규화 (0-100 범위)
    const normalizedStreak = maxStreak > 0 ? Math.min((champion.weeklyStreak / maxStreak) * 100, 100) : 0;
    const normalizedPages = maxPages > 0 ? Math.min((champion.weeklyPages / maxPages) * 100, 100) : 0;
    
    // 종합 점수 계산 (연속 독서 일수 40% + 독서 분량 60%)
    const score = normalizedStreak * 0.4 + normalizedPages * 0.6;

    return {
      ...champion,
      score,
    };
  });

  // 종합 점수로 정렬
  championsWithScore.sort((a, b) => b.score - a.score);
  
  // 1등, 2등, 3등으로 rank 재설정하고 반환
  return championsWithScore.slice(0, limit).map((champion, index) => ({
    ...champion,
    rank: index + 1,
  }));
};

