import { Timestamp } from 'firebase-admin/firestore';
import { getAdminDb } from '@/lib/firebase/admin';
import { BADGE_DEFINITIONS, type BadgeDefinition } from '@/lib/utils/badgeDefinitions';
import { getLevelFromExp } from '@/lib/utils/game';
import { kstMonthStart } from './gamification';

export interface AwardedBadge {
  id: string;
  name: string;
  icon: string;
  expReward: number;
}

/**
 * 사용자의 현재 데이터를 기준으로 새로 획득한 뱃지를 평가하고 부여한다.
 * 뱃지 보상 경험치도 함께 반영한다. (서버 전용)
 */
export async function checkAndAwardBadges(uid: string): Promise<AwardedBadge[]> {
  const db = getAdminDb();

  const userRef = db.collection('users').doc(uid);
  const [userSnap, ownedSnap, booksSnap, reviewsSnap, logsSnap] = await Promise.all([
    userRef.get(),
    db.collection('userBadges').where('userId', '==', uid).get(),
    db.collection('books').where('userId', '==', uid).get(),
    db.collection('reviews').where('userId', '==', uid).get(),
    db.collection('readingLogs').where('userId', '==', uid).get(),
  ]);

  if (!userSnap.exists) {
    return [];
  }
  const user = userSnap.data()!;

  const ownedBadgeIds = new Set(ownedSnap.docs.map((doc) => doc.data().badgeId));
  const completedBooks = booksSnap.docs.filter((doc) => doc.data().status === 'completed').length;

  const monthStart = kstMonthStart();
  const pagesThisMonth = logsSnap.docs.reduce((sum, doc) => {
    const data = doc.data();
    const date = data.date instanceof Timestamp ? data.date.toDate() : null;
    return date && date >= monthStart ? sum + Number(data.pagesRead ?? 0) : sum;
  }, 0);

  const meetsCondition = (badge: BadgeDefinition): boolean => {
    switch (badge.condition.type) {
      case 'first_book':
        return booksSnap.size >= badge.condition.value;
      case 'streak_days':
        return Number(user.currentStreak ?? 0) >= badge.condition.value;
      case 'books_completed':
        return completedBooks >= badge.condition.value;
      case 'reviews_written':
        return reviewsSnap.size >= badge.condition.value;
      case 'level_reached':
        return Number(user.level ?? 1) >= badge.condition.value;
      case 'pages_month':
        return pagesThisMonth >= badge.condition.value;
      default:
        return false;
    }
  };

  const newBadges = BADGE_DEFINITIONS.filter(
    (badge) => !ownedBadgeIds.has(badge.id) && meetsCondition(badge)
  );

  if (newBadges.length === 0) {
    return [];
  }

  const batch = db.batch();
  const now = Timestamp.now();
  for (const badge of newBadges) {
    batch.set(db.collection('userBadges').doc(), {
      userId: uid,
      badgeId: badge.id,
      earnedAt: now,
    });
  }

  const totalReward = newBadges.reduce((sum, badge) => sum + badge.expReward, 0);
  const newExp = Number(user.exp ?? 0) + totalReward;
  batch.update(userRef, {
    exp: newExp,
    level: getLevelFromExp(newExp),
    updatedAt: now,
  });

  await batch.commit();

  return newBadges.map(({ id, name, icon, expReward }) => ({ id, name, icon, expReward }));
}
