import { Timestamp } from 'firebase-admin/firestore';
import { getAdminDb } from '@/lib/firebase/admin';
import { getLevelFromExp } from '@/lib/utils/game';
import { getUserDisplayNameForRanking } from '@/lib/utils/userDisplay';
import {
  REVIEW_EXP_REWARD,
  kstDayNumber,
  kstPeriodStart,
  kstWeekStart,
  type RankingPeriod,
} from './gamification';

/**
 * 커뮤니티(랭킹/주간대장/지도) 집계 - 서버 전용
 *
 * 다른 사용자의 readingLogs를 클라이언트가 직접 읽지 않도록
 * 모든 교차 사용자 집계를 Admin SDK로 수행한다.
 * 비공개 감상(notes)은 본인 것 외에는 절대 응답에 포함하지 않는다.
 */

const toDate = (value: unknown): Date | null =>
  value instanceof Timestamp ? value.toDate() : null;

interface CommunityUser {
  id: string;
  data: FirebaseFirestore.DocumentData;
}

/** 관리자/익명 사용자를 제외한 사용자 목록 (경험치 내림차순) */
async function getCommunityUsers(limitCount: number): Promise<CommunityUser[]> {
  const db = getAdminDb();
  const [adminsSnap, usersSnap] = await Promise.all([
    db.collection('admins').get(),
    db.collection('users').orderBy('exp', 'desc').limit(limitCount + 10).get(),
  ]);

  const adminIds = new Set(adminsSnap.docs.map((doc) => doc.id));

  return usersSnap.docs
    .filter((doc) => !adminIds.has(doc.id) && doc.data().isAnonymous !== true)
    .slice(0, limitCount)
    .map((doc) => ({ id: doc.id, data: doc.data() }));
}

export interface RankingItemDto {
  userId: string;
  userName: string;
  level: number;
  totalExp: number;
  rank: number;
}

/** 기간별 랭킹 계산 (기간 경험치 = 독서 기록 expGained 합 + 감상문 70/건) */
export async function computeRankings(period: RankingPeriod): Promise<RankingItemDto[]> {
  const db = getAdminDb();
  const users = await getCommunityUsers(100);

  let expByUser: Map<string, number> | null = null;
  const periodStart = kstPeriodStart(period);

  if (periodStart) {
    const startTs = Timestamp.fromDate(periodStart);
    const [logsSnap, reviewsSnap] = await Promise.all([
      db.collection('readingLogs').where('date', '>=', startTs).get(),
      db.collection('reviews').where('createdAt', '>=', startTs).get(),
    ]);

    expByUser = new Map<string, number>();
    for (const doc of logsSnap.docs) {
      const data = doc.data();
      const userId = String(data.userId ?? '');
      expByUser.set(userId, (expByUser.get(userId) ?? 0) + Number(data.expGained ?? 0));
    }
    for (const doc of reviewsSnap.docs) {
      const data = doc.data();
      const userId = String(data.userId ?? '');
      expByUser.set(userId, (expByUser.get(userId) ?? 0) + REVIEW_EXP_REWARD);
    }
  }

  const items = users.map(({ id, data }) => {
    const totalExp = expByUser ? expByUser.get(id) ?? 0 : Number(data.exp ?? 0);
    return {
      userId: id,
      userName: getUserDisplayNameForRanking(data),
      level: getLevelFromExp(Number(data.exp ?? 0)),
      totalExp,
      rank: 0,
    };
  });

  items.sort((a, b) => b.totalExp - a.totalExp);
  items.forEach((item, index) => {
    item.rank = index + 1;
  });

  return items;
}

export interface WeeklyChampionDto {
  userId: string;
  userName: string;
  userPhotoURL?: string;
  rank: number;
  weeklyStreak: number;
  weeklyPages: number;
  weeklyExp: number;
  score: number;
  recentBookCover?: string;
  character?: {
    animalType: string;
    outfitColor: string;
    outfitDesign: string;
  };
}

/** 주간(월~일) 연속 독서 일수: 오늘 또는 어제로 끝나는 연속 일수만 인정 */
function weeklyStreakFromDays(days: Set<number>, weekStartDay: number, todayDay: number): number {
  let checkDay = days.has(todayDay) ? todayDay : todayDay - 1;
  if (!days.has(checkDay)) {
    return 0;
  }
  let streak = 0;
  while (checkDay >= weekStartDay && days.has(checkDay)) {
    streak++;
    checkDay--;
  }
  return streak;
}

/** 주간 독서 대장 상위 N명 계산 */
export async function computeWeeklyChampions(limitCount: number = 3): Promise<WeeklyChampionDto[]> {
  const db = getAdminDb();
  const weekStart = kstWeekStart();
  const startTs = Timestamp.fromDate(weekStart);
  const weekStartDay = kstDayNumber(weekStart);
  const todayDay = kstDayNumber(new Date());

  const [logsSnap, reviewsSnap, adminsSnap] = await Promise.all([
    db.collection('readingLogs').where('date', '>=', startTs).get(),
    db.collection('reviews').where('createdAt', '>=', startTs).get(),
    db.collection('admins').get(),
  ]);

  const adminIds = new Set(adminsSnap.docs.map((doc) => doc.id));

  interface WeekStats {
    days: Set<number>;
    pages: number;
    exp: number;
    bookIds: Set<string>;
  }
  const statsByUser = new Map<string, WeekStats>();

  for (const doc of logsSnap.docs) {
    const data = doc.data();
    const userId = String(data.userId ?? '');
    if (!userId || adminIds.has(userId)) continue;

    const date = toDate(data.date);
    if (!date) continue;

    let stats = statsByUser.get(userId);
    if (!stats) {
      stats = { days: new Set(), pages: 0, exp: 0, bookIds: new Set() };
      statsByUser.set(userId, stats);
    }
    stats.days.add(kstDayNumber(date));
    stats.pages += Number(data.pagesRead ?? 0);
    stats.exp += Number(data.expGained ?? 0);
    if (data.bookId) stats.bookIds.add(String(data.bookId));
  }

  // 이번 주에 독서한 책의 감상문만 주간 경험치에 포함 (기존 동작 유지)
  for (const doc of reviewsSnap.docs) {
    const data = doc.data();
    const userId = String(data.userId ?? '');
    const stats = statsByUser.get(userId);
    if (stats && data.bookId && stats.bookIds.has(String(data.bookId))) {
      stats.exp += REVIEW_EXP_REWARD;
    }
  }

  // 연속 독서가 이어지고 있는 사용자만 후보로
  const candidates: Array<{ userId: string; streak: number; stats: WeekStats }> = [];
  for (const [userId, stats] of statsByUser) {
    const streak = weeklyStreakFromDays(stats.days, weekStartDay, todayDay);
    if (streak > 0) {
      candidates.push({ userId, streak, stats });
    }
  }
  if (candidates.length === 0) {
    return [];
  }

  const userSnaps = await db.getAll(
    ...candidates.map((c) => db.collection('users').doc(c.userId))
  );
  const userDataById = new Map(
    userSnaps.filter((snap) => snap.exists).map((snap) => [snap.id, snap.data()!])
  );

  const maxStreak = Math.max(...candidates.map((c) => c.streak), 7);
  const maxPages = Math.max(...candidates.map((c) => c.stats.pages), 1);

  const scored = candidates
    .filter((c) => {
      const user = userDataById.get(c.userId);
      return user && user.isAnonymous !== true;
    })
    .map((c) => {
      const user = userDataById.get(c.userId)!;
      const normalizedStreak = Math.min((c.streak / maxStreak) * 100, 100);
      const normalizedPages = Math.min((c.stats.pages / maxPages) * 100, 100);
      return {
        userId: c.userId,
        userName: getUserDisplayNameForRanking(user),
        userPhotoURL: user.photoURL || undefined,
        rank: 0,
        weeklyStreak: c.streak,
        weeklyPages: c.stats.pages,
        weeklyExp: c.stats.exp,
        score: normalizedStreak * 0.4 + normalizedPages * 0.6,
        recentBookCover: undefined as string | undefined,
        character: user.character ?? undefined,
      };
    });

  scored.sort((a, b) => b.score - a.score);
  const top = scored.slice(0, limitCount).map((champion, index) => ({
    ...champion,
    rank: index + 1,
  }));

  // 상위권만 최근 읽은 책 커버 조회
  await Promise.all(
    top.map(async (champion) => {
      const booksSnap = await db
        .collection('books')
        .where('userId', '==', champion.userId)
        .get();
      const books = booksSnap.docs.map((doc) => doc.data());
      const byRecency = (a: FirebaseFirestore.DocumentData, b: FirebaseFirestore.DocumentData) =>
        (toDate(b.updatedAt)?.getTime() ?? 0) - (toDate(a.updatedAt)?.getTime() ?? 0);
      const recent =
        books.filter((b) => b.status === 'reading').sort(byRecency)[0] ??
        books.filter((b) => b.status === 'completed').sort(byRecency)[0];
      if (recent?.coverImage) {
        champion.recentBookCover = String(recent.coverImage);
      }
    })
  );

  return top;
}

export interface MapStatusDto {
  userId: string;
  userName: string;
  level: number;
  exp: number;
  totalPagesRead: number;
  badgesCount: number;
  character?: {
    animalType: string;
    outfitColor: string;
    outfitDesign: string;
  };
  lastReadingLogDate?: number;
}

/** 지도(여정 현황) 페이지용 사용자 현황 */
export async function computeMapStatuses(): Promise<MapStatusDto[]> {
  const db = getAdminDb();
  const [users, badgesSnap] = await Promise.all([
    getCommunityUsers(50),
    db.collection('userBadges').get(),
  ]);

  const badgeCountByUser = new Map<string, number>();
  for (const doc of badgesSnap.docs) {
    const userId = String(doc.data().userId ?? '');
    badgeCountByUser.set(userId, (badgeCountByUser.get(userId) ?? 0) + 1);
  }

  return users.map(({ id, data }) => {
    const exp = Number(data.exp ?? 0);
    return {
      userId: id,
      userName: getUserDisplayNameForRanking(data),
      level: getLevelFromExp(exp),
      exp,
      totalPagesRead: Number(data.totalPagesRead ?? 0),
      badgesCount: badgeCountByUser.get(id) ?? 0,
      character: data.character ?? undefined,
      lastReadingLogDate: toDate(data.lastReadingDate)?.getTime() ?? undefined,
    };
  });
}

export interface PublicProfileDto {
  user: {
    userName: string;
    level: number;
    exp: number;
    totalBooksRead: number;
    totalPagesRead: number;
    currentStreak: number;
    character?: {
      animalType: string;
      outfitColor: string;
      outfitDesign: string;
    };
  };
  books: Array<{
    id: string;
    title: string;
    author: string;
    totalPages: number;
    currentPage: number;
    status: string;
    coverImage?: string;
  }>;
  logs: Array<{
    id: string;
    bookId: string;
    date: string;
    pagesRead: number;
    notes?: string;
  }>;
}

/** 다른 사용자의 공개 프로필 (감상은 isPublic인 것만 포함) */
export async function getPublicProfile(targetUid: string): Promise<PublicProfileDto | null> {
  const db = getAdminDb();
  const [userSnap, booksSnap, logsSnap] = await Promise.all([
    db.collection('users').doc(targetUid).get(),
    db.collection('books').where('userId', '==', targetUid).get(),
    db.collection('readingLogs').where('userId', '==', targetUid).get(),
  ]);

  if (!userSnap.exists) {
    return null;
  }
  const user = userSnap.data()!;

  const books = booksSnap.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      title: String(data.title ?? ''),
      author: String(data.author ?? ''),
      totalPages: Number(data.totalPages ?? 0),
      currentPage: Number(data.currentPage ?? 0),
      status: String(data.status ?? 'reading'),
      coverImage: data.coverImage ? String(data.coverImage) : undefined,
    };
  });

  // 비공개 감상은 서버에서 걸러서 클라이언트에 아예 전달하지 않는다
  const logs = logsSnap.docs
    .map((doc) => ({ id: doc.id, ...doc.data() }) as Record<string, unknown> & { id: string })
    .filter((log) => log.isPublic !== false)
    .sort((a, b) => (toDate(b.date)?.getTime() ?? 0) - (toDate(a.date)?.getTime() ?? 0))
    .slice(0, 20)
    .map((log) => ({
      id: log.id,
      bookId: String(log.bookId ?? ''),
      date: toDate(log.date)?.toISOString() ?? '',
      pagesRead: Number(log.pagesRead ?? 0),
      notes: log.notes ? String(log.notes) : undefined,
    }));

  return {
    user: {
      userName: getUserDisplayNameForRanking(user),
      level: getLevelFromExp(Number(user.exp ?? 0)),
      exp: Number(user.exp ?? 0),
      totalBooksRead: Number(user.totalBooksRead ?? 0),
      totalPagesRead: Number(user.totalPagesRead ?? 0),
      currentStreak: Number(user.currentStreak ?? 0),
      character: user.character ?? undefined,
    },
    books,
    logs,
  };
}
