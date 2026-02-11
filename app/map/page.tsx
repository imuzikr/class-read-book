'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { getUserData, getUserBadges, isAdmin, getBooks, getReadingLogs, getReviews } from '@/lib/firebase/firestore';
import { type Book, type ReadingLog, type Review } from '@/types';
import { getAllUsers } from '@/lib/firebase/users';
import { getLevelProgress, getExpToNextLevel, getLevelFromExp, getExpForLevel } from '@/lib/utils/game';
import { getCharacterEmoji, type AnimalType } from '@/lib/utils/characters';
import { updateUserData } from '@/lib/firebase/firestore';
import { getUserDisplayNameForRanking } from '@/lib/utils/userDisplay';
import Card from '@/components/ui/Card';

interface UserStatus {
  userId: string;
  userName: string;
  level: number;
  exp: number;
  totalPagesRead: number;
  badgesCount: number;
  character?: {
    animalType: AnimalType;
    outfitColor: string;
    outfitDesign: string;
  };
  progress: number; // 0-100 (전체 여정 진행률)
  currentLevelProgress: number; // 현재 레벨 내 진행률 (0-100)
  lastReadingLogDate?: number; // 가장 최근 독서 기록 날짜 (timestamp)
}

export default function StatusBarPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [userData, setUserData] = useState<any>(null);
  const [allUsers, setAllUsers] = useState<UserStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<UserStatus | null>(null);
  const [userBooks, setUserBooks] = useState<Book[]>([]);
  const [userReadingLogs, setUserReadingLogs] = useState<ReadingLog[]>([]);
  const [userReviews, setUserReviews] = useState<Review[]>([]);
  const [userBadges, setUserBadges] = useState<string[]>([]);

  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        router.push('/login');
        return;
      }
      fetchStatusData();
    }
  }, [user, authLoading, router]);

  const fetchStatusData = async () => {
    if (!user) return;

    try {
      // 현재 사용자 데이터 가져오기
      const currentUserData = await getUserData(user.uid);
      if (!currentUserData) {
        router.push('/dashboard');
        return;
      }

      // 현재 사용자의 레벨도 자동 업데이트
      const correctLevel = getLevelFromExp(currentUserData.exp);
      if (correctLevel !== currentUserData.level) {
        await updateUserData(user.uid, {
          level: correctLevel,
        });
        currentUserData.level = correctLevel;
      }

      setUserData(currentUserData);

      // 현재 사용자의 여정 데이터 가져오기 (병렬 처리)
      Promise.all([
        getBooks(user.uid),
        getReadingLogs(user.uid),
        getReviews(user.uid),
        getUserBadges(user.uid),
      ]).then(([books, logs, reviews, badges]) => {
        setUserBooks(books);
        setUserReadingLogs(logs);
        setUserReviews(reviews);
        setUserBadges(badges);
      }).catch(err => console.error('여정 데이터 로드 실패:', err));

      // 모든 사용자 데이터 가져오기
      const allUsersData = await getAllUsers(50); // 상위 50명만 표시
      
      // 병렬 처리: 모든 사용자 데이터를 동시에 처리
      const userStatusPromises = allUsersData.map(async (userData) => {
        try {
          // 관리자 계정은 현황판에서 제외
          const userIsAdmin = await isAdmin(userData.id);
          if (userIsAdmin) {
            return null; // 관리자는 건너뛰기
          }

          // 병렬로 뱃지, 레벨 정보, 독서 기록 가져오기
          const [userBadges, correctLevel, readingLogs] = await Promise.all([
            getUserBadges(userData.id),
            Promise.resolve(getLevelFromExp(userData.exp)),
            getReadingLogs(userData.id),
          ]);

          // 레벨이 다르면 자동으로 업데이트 (백그라운드, await 하지 않음)
          if (correctLevel !== userData.level) {
            updateUserData(userData.id, {
              level: correctLevel,
            }).catch(err => console.error(`레벨 업데이트 실패:`, err));
            userData.level = correctLevel; // 로컬 데이터도 업데이트
          }

          // 가장 최근 독서 기록 날짜 찾기
          let lastReadingLogDate: number | undefined = undefined;
          if (readingLogs.length > 0) {
            const sortedLogs = [...readingLogs].sort((a, b) =>
              b.createdAt.getTime() - a.createdAt.getTime()
            );
            lastReadingLogDate = sortedLogs[0].createdAt.getTime();
          }

          // 현재 레벨 내 진행률 (0-100)
          let currentLevelProgress = getLevelProgress(userData.exp, userData.level);

          // 전체 진행률 계산 (레벨 10을 최대로 가정)
          // 레벨 1 = 0%, 레벨 10 = 100%
          // 각 레벨은 11.11%씩 차지 (100% / 9레벨 간격 = 약 11.11% per level)
          // 현재 레벨의 기본 진행률 + 현재 레벨 내 진행률의 비율
          const maxLevel = 10;
          const baseProgress = ((userData.level - 1) / (maxLevel - 1)) * 100; // 현재 레벨의 시작점
          const levelProgressRatio = currentLevelProgress / 100; // 현재 레벨 내 진행률 비율 (0-1)
          const levelContribution = (1 / (maxLevel - 1)) * 100 * levelProgressRatio; // 현재 레벨에서 기여하는 진행률
          const totalProgress = Math.min(100, baseProgress + levelContribution);

          // 레벨 진행률이 100%를 초과하지 않도록 제한
          currentLevelProgress = Math.min(100, currentLevelProgress);

          return {
            userId: userData.id,
            userName: getUserDisplayNameForRanking(userData),
            level: userData.level,
            exp: userData.exp,
            totalPagesRead: userData.totalPagesRead,
            badgesCount: userBadges.length,
            character: userData.character ? {
              animalType: userData.character.animalType as AnimalType,
              outfitColor: userData.character.outfitColor,
              outfitDesign: userData.character.outfitDesign,
            } : undefined,
            progress: Math.min(100, totalProgress),
            currentLevelProgress,
            lastReadingLogDate,
          };
        } catch (error) {
          console.error(`사용자 ${userData.id} 데이터 처리 실패:`, error);
          return null;
        }
      });

      // 모든 Promise를 병렬로 실행하고 결과 수집
      const userStatusResults = await Promise.all(userStatusPromises);
      const userStatuses = userStatusResults.filter((status) => status !== null) as UserStatus[];

      // 경험치 순으로 정렬 (내림차순) - 순위 계산을 위해
      userStatuses.sort((a, b) => {
        // 먼저 경험치로 정렬
        if (b.exp !== a.exp) {
          return b.exp - a.exp;
        }
        // 경험치가 같으면 최근 독서 기록 날짜로 정렬 (최신순)
        if (a.lastReadingLogDate && b.lastReadingLogDate) {
          return b.lastReadingLogDate - a.lastReadingLogDate;
        }
        // 한쪽만 독서 기록이 있으면 기록이 있는 쪽을 우선
        if (a.lastReadingLogDate) return -1;
        if (b.lastReadingLogDate) return 1;
        // 둘 다 기록이 없으면 이름 순으로 정렬
        return a.userName.localeCompare(b.userName, 'ko');
      });
      setAllUsers(userStatuses);
    } catch (error) {
      console.error('데이터 로드 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateJourneyNarrative = () => {
    if (!userData || userBooks.length === 0) {
      return "아직 독서 여정이 시작되지 않았습니다. 첫 번째 책을 추가하고 멋진 여행을 시작해보세요! 📚";
    }

    // 통계 계산
    const completedBooks = userBooks.filter(b => b.status === 'completed');
    const readingBooks = userBooks.filter(b => b.status === 'reading');

    // 첫 번째 책 시작일
    const firstBook = [...userBooks].sort((a, b) =>
      a.startDate.getTime() - b.startDate.getTime()
    )[0];
    const journeyStartDate = firstBook.startDate;
    const daysSinceStart = Math.floor((Date.now() - journeyStartDate.getTime()) / (1000 * 60 * 60 * 24));

    // 평균 일일 독서량 계산
    const avgDailyPages = daysSinceStart > 0
      ? Math.round(userData.totalPagesRead / daysSinceStart)
      : userData.totalPagesRead;

    // 레벨업 횟수 (현재 레벨 - 1)
    const levelUps = userData.level - 1;

    // 최근 완독한 책
    const recentCompletedBook = completedBooks.length > 0
      ? [...completedBooks].sort((a, b) =>
          (b.finishDate?.getTime() || 0) - (a.finishDate?.getTime() || 0)
        )[0]
      : null;

    // 감상문이 있는 책들
    const booksWithReviews = userReviews.length;

    // 여정 시작 시기 표현
    const getJourneyStartPhrase = (days: number) => {
      if (days < 7) return "이번 주부터";
      if (days < 30) return `${Math.floor(days / 7)}주 전`;
      if (days < 365) return `${Math.floor(days / 30)}개월 전`;
      return `${Math.floor(days / 365)}년 전`;
    };

    // 레벨에 따른 칭호
    const getLevelTitle = (level: number) => {
      if (level >= 10) return "독서 마스터";
      if (level >= 7) return "독서 전문가";
      if (level >= 5) return "열정적인 독서가";
      if (level >= 3) return "성실한 독서가";
      return "독서 초보자";
    };

    // 내러티브 생성
    let narrative = "";

    narrative += `${getJourneyStartPhrase(daysSinceStart)}, "${firstBook.title}"를 펼치며 독서 여정을 시작했습니다. `;

    if (completedBooks.length > 0) {
      narrative += `그로부터 ${daysSinceStart}일 동안 ${completedBooks.length}권의 책을 완독하며 `;
      narrative += `총 ${userData.totalPagesRead.toLocaleString()}페이지의 활자를 섭렵했습니다. `;
    } else {
      narrative += `${daysSinceStart}일 동안 ${userData.totalPagesRead.toLocaleString()}페이지를 읽으며 꾸준히 나아가고 있습니다. `;
    }

    if (avgDailyPages > 0) {
      if (avgDailyPages >= 50) {
        narrative += `하루 평균 ${avgDailyPages}페이지, 놀라운 독서 속도로 지식의 바다를 항해하고 있습니다. `;
      } else if (avgDailyPages >= 20) {
        narrative += `매일 평균 ${avgDailyPages}페이지씩 꾸준히 읽으며 차근차근 성장하고 있습니다. `;
      } else {
        narrative += `하루 평균 ${avgDailyPages}페이지, 천천히 그러나 확실하게 전진하고 있습니다. `;
      }
    }

    if (userData.currentStreak >= 7) {
      narrative += `🔥 ${userData.currentStreak}일 연속 독서, 불타는 열정이 느껴집니다! `;
    } else if (userData.currentStreak >= 3) {
      narrative += `${userData.currentStreak}일 연속으로 책과 함께하고 있습니다. `;
    }

    if (booksWithReviews > 0) {
      narrative += `${booksWithReviews}편의 감상문을 남기며 독서의 흔적을 기록했고, `;
    }

    narrative += `이 여정을 통해 ${userData.exp.toLocaleString()} 경험치를 획득했습니다. `;

    if (levelUps > 0) {
      narrative += `${levelUps}번의 레벨업을 거쳐 `;
    }

    narrative += `현재 레벨 ${userData.level}, ${getLevelTitle(userData.level)}의 경지에 올랐습니다. `;

    if (userBadges.length > 0) {
      narrative += `그 과정에서 ${userBadges.length}개의 뱃지를 획득하며 다양한 성취를 이뤘습니다. `;
    }

    if (recentCompletedBook && recentCompletedBook.finishDate) {
      const daysAgo = Math.floor((Date.now() - recentCompletedBook.finishDate.getTime()) / (1000 * 60 * 60 * 24));
      if (daysAgo === 0) {
        narrative += `오늘 "${recentCompletedBook.title}"를 완독하며 또 하나의 이정표를 세웠습니다. `;
      } else if (daysAgo === 1) {
        narrative += `어제 "${recentCompletedBook.title}"를 완독했습니다. `;
      } else if (daysAgo < 7) {
        narrative += `${daysAgo}일 전 "${recentCompletedBook.title}"를 완독했습니다. `;
      }
    }

    if (readingBooks.length > 0) {
      if (readingBooks.length === 1) {
        narrative += `지금은 "${readingBooks[0].title}"를 읽고 있으며, `;
      } else {
        narrative += `현재 ${readingBooks.length}권의 책을 동시에 읽으며, `;
      }
      narrative += `새로운 지식과 감동을 향해 나아가고 있습니다. `;
    }

    narrative += `📚✨`;

    return narrative;
  };

  const renderRaceTrack = () => {
    if (!userData || allUsers.length === 0) return null;

    // 상위 10명만 선택 (이미 정렬되어 있음)
    const top10Users = allUsers.slice(0, 10);

    // 레벨 마커 위치 계산 (5% ~ 95% 범위로 조정)
    const getLevelPosition = (exp: number, level: number, levelProgress: number) => {
      // 경험치가 0이면 레벨 0의 시작점(5%)에 고정
      if (exp === 0) {
        return 5;
      }
      // 레벨 마커와 동일한 범위(5% ~ 95%)로 조정
      const maxLevel = 10;
      const basePosition = 5 + (level / maxLevel) * 90; // 레벨 10을 최대로 가정, 5% ~ 95% 범위
      const progressOffset = (levelProgress / 100) * (90 / maxLevel); // 현재 레벨 내 진행률 반영
      return Math.min(95, Math.max(5, basePosition + progressOffset));
    };

    // 각 사용자의 위치 계산
    const usersWithPosition = top10Users.map((userStatus) => {
      const position = getLevelPosition(userStatus.exp, userStatus.level, userStatus.currentLevelProgress);
      return { ...userStatus, position };
    });

    // 트랙 표시용: 이름 순으로 정렬 (오름차순), 같은 이름이면 경험치 순으로 정렬
    const sortedUsersByName = [...usersWithPosition].sort((a, b) => {
      // 먼저 이름 순으로 정렬
      const nameCompare = a.userName.localeCompare(b.userName, 'ko');
      if (nameCompare !== 0) {
        return nameCompare;
      }
      // 이름이 같으면 경험치 순으로 정렬 (내림차순)
      return b.exp - a.exp;
    });

    // 이름 순서를 유지하면서 세로 위치 계산 (고정 간격)
    const minVerticalGap = 60; // 캐릭터 간 최소 세로 간격 (px)
    const trackPadding = 16; // 트랙 padding (p-4 = 16px)
    const characterHeight = 32; // 캐릭터 높이 (emoji 추정)
    const minTrackHeight = 256; // 최소 트랙 높이 (h-64 = 256px)

    const totalUsers = sortedUsersByName.length;
    const centerIndex = (totalUsers - 1) / 2;

    const usersWithOffset = sortedUsersByName.map((userStatus, index) => {
      const verticalOffset = (index - centerIndex) * minVerticalGap;
      return { ...userStatus, verticalOffset };
    });

    // 트랙 높이 계산: 모든 캐릭터가 안에 들어가도록 충분한 여유 포함
    const totalVerticalSpan = Math.max(
      characterHeight,
      (totalUsers - 1) * minVerticalGap + characterHeight
    );
    const calculatedHeight = totalVerticalSpan + trackPadding * 2 + minVerticalGap;
    const trackHeight = Math.max(minTrackHeight, calculatedHeight);

    // 이미 이름 순으로 정렬되어 있으므로 그대로 사용
    const sortedUsers = usersWithOffset;

    return (
      <Card title={
        <div className="flex items-center gap-2">
          <span>독서 여정 진행 상황</span>
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-gradient-to-r from-yellow-400 to-orange-500 text-white shadow-md">
            TOP 10
          </span>
        </div>
      }>
        {/* 레벨 마커 (카드 위쪽 바깥) */}
        <div className="relative mb-2">
          <div className="relative h-6 px-4">
            {Array.from({ length: 11 }, (_, i) => i).map((level) => {
              const maxLevel = 10;
              const markerPosition = 5 + (level / maxLevel) * 90;
              return (
                level % 2 === 0 && (
                  <div
                    key={level}
                    className="absolute transform -translate-x-1/2"
                    style={{ left: `${markerPosition}%` }}
                  >
                    <div className="text-xs text-gray-600 font-medium whitespace-nowrap">
                      Lv.{level}
                    </div>
                  </div>
                )
              );
            })}
          </div>
        </div>

        {/* 하나의 공통 스테이터스 바 (달리기 트랙) */}
        <div 
          className="relative bg-gradient-to-r from-green-100 via-blue-100 to-purple-100 rounded-lg p-4 border-2 border-gray-300 mb-6"
          style={{ height: `${trackHeight}px` }}
        >
          {/* 레벨 구분선 (트랙 내부) */}
          <div className="absolute top-0 left-0 right-0 h-full flex items-center px-4">
            {Array.from({ length: 11 }, (_, i) => i).map((level) => {
              const maxLevel = 10;
              const markerPosition = 5 + (level / maxLevel) * 90;
              return (
                <div
                  key={level}
                  className="absolute transform -translate-x-1/2"
                  style={{ left: `${markerPosition}%` }}
                >
                  <div className="w-0.5 h-full bg-gray-400 opacity-20"></div>
                </div>
              );
            })}
          </div>

          {/* 모든 사용자 캐릭터와 경험치 바 */}
          {sortedUsers.map((userStatus) => {
            const isCurrentUser = userStatus.userId === user?.uid;
            // 1등 사용자 확인 (allUsers는 경험치 순으로 정렬되어 있으므로 첫 번째가 1등)
            const isFirstPlace = allUsers.length > 0 && userStatus.userId === allUsers[0].userId;
            
            // 경험치 바: 레벨 0(5%)부터 캐릭터 위치까지
            const expBarStartPosition = 5; // 레벨 0 위치로 고정
            const expBarWidthPercent = userStatus.position - expBarStartPosition; // 레벨 0부터 캐릭터까지
            // 경험치가 0이면 경험치 바를 표시하지 않음
            const shouldShowExpBar = userStatus.exp > 0 && expBarWidthPercent > 0;
            
            return (
              <>
                {/* 경험치 바 (레벨 0부터 캐릭터 위치까지) - 경험치가 0이면 표시하지 않음 */}
                {shouldShowExpBar && (
                  <div
                    key={`exp-bar-${userStatus.userId}`}
                    className="absolute"
                    style={{
                      left: `${expBarStartPosition}%`,
                      width: `${expBarWidthPercent}%`,
                      height: '8px',
                      backgroundColor: '#fed7aa', // 아주 연한 오렌지색 (orange-200)
                      opacity: isCurrentUser ? 0.6 : 0.5,
                      top: `calc(50% + ${userStatus.verticalOffset}px)`,
                      transform: 'translateY(-50%)',
                      borderRadius: '0 999px 999px 0', // 오른쪽만 둥글게
                      zIndex: isCurrentUser ? 15 : 5,
                      border: '1px solid rgba(251, 146, 60, 0.3)', // 더 연한 경계선
                    }}
                  />
                )}
                
                {/* 캐릭터 */}
                <div
                  key={`character-${userStatus.userId}`}
                  className="absolute"
                  style={{
                    left: `${userStatus.position}%`,
                    top: `calc(50% + ${userStatus.verticalOffset}px)`,
                    transform: 'translate(-50%, -50%)',
                    zIndex: isCurrentUser ? 20 : 10,
                  }}
                  onMouseEnter={() => setSelectedUser(userStatus)}
                  onMouseLeave={() => setSelectedUser(null)}
                >
                  <div className="relative">
                    <span className="text-3xl drop-shadow-lg">
                      {userStatus.character 
                        ? getCharacterEmoji(userStatus.character.animalType)
                        : getCharacterEmoji('bear')
                      }
                    </span>
                    {/* 사용자 이름 (캐릭터 오른쪽에 항상 표시, 경험치 바와 겹치지 않도록) */}
                    <div 
                      className="absolute left-full ml-2 whitespace-nowrap flex items-center gap-1"
                      style={{ 
                        textShadow: '0 1px 2px rgba(255, 255, 255, 0.8)',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        zIndex: isCurrentUser ? 25 : 15, // 경험치 바보다 위에 표시
                      }}
                    >
                      <span 
                        className="text-xs text-gray-400"
                        style={{ 
                          fontWeight: isCurrentUser ? 500 : 400,
                        }}
                      >
                        {userStatus.userName}
                        {isCurrentUser && ' (나)'}
                      </span>
                      {/* 1등 별 마크 */}
                      {isFirstPlace && (
                        <span 
                          className="text-2xl animate-star-glow-shake inline-block"
                          style={{
                            textShadow: '0 0 10px rgba(255, 215, 0, 0.9), 0 0 20px rgba(255, 215, 0, 0.7), 0 0 30px rgba(255, 215, 0, 0.5)',
                            transformOrigin: 'center',
                            display: 'inline-block',
                          }}
                        >
                          ⭐
                        </span>
                      )}
                    </div>
                    {/* 현재 사용자 표시 */}
                    {isCurrentUser && (
                      <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full animate-pulse" style={{ backgroundColor: '#f97316' }}></div>
                    )}
                  </div>
                  
                  {/* 사용자 상세 정보 툴팁 (호버 시) */}
                  {selectedUser?.userId === userStatus.userId && (
                    <div className="absolute top-full left-1/2 transform -translate-x-1/2 mt-2 px-2 py-1 bg-gray-900 text-white text-xs rounded whitespace-nowrap z-30">
                      <span className="text-gray-300">레벨 {userStatus.level} • {userStatus.exp.toLocaleString()} EXP</span>
                    </div>
                  )}
                </div>
              </>
            );
          })}
        </div>
      </Card>
    );
  };

  if (authLoading || loading) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <div className="text-gray-400">로딩 중...</div>
      </div>
    );
  }

  if (!userData || allUsers.length === 0) {
    return (
      <div className="text-center">
        <p className="text-gray-600">데이터를 불러올 수 없습니다.</p>
      </div>
    );
  }

  const currentUser = allUsers.find(u => u.userId === user?.uid);
  const userRank = allUsers.findIndex(u => u.userId === user?.uid) + 1;

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">독서 여정 현황</h1>
          <p className="text-gray-600 mt-1">
            모든 독서가들의 진행 상황을 한눈에 확인하세요
          </p>
        </div>
        {currentUser && (
          <div className="flex items-center space-x-3">
            <div className="text-sm text-gray-600">내 순위</div>
            <div className="relative w-12 h-12 flex items-center justify-center">
              {userRank === 1 ? (
                <span className="text-5xl">🥇</span>
              ) : userRank === 2 ? (
                <span className="text-5xl">🥈</span>
              ) : userRank === 3 ? (
                <span className="text-5xl">🥉</span>
              ) : (
                <div className="relative w-12 h-12 flex items-center justify-center">
                  <svg width="48" height="48" viewBox="0 0 48 48" className="absolute">
                    {/* 메달 리본 */}
                    <path d="M 24 5 L 17 12 L 24 16 L 31 12 Z" fill="#9CA3AF" opacity="0.8"/>
                    {/* 메달 원형 */}
                    <circle cx="24" cy="24" r="19" fill="#D1D5DB" stroke="#9CA3AF" strokeWidth="2"/>
                    <circle cx="24" cy="24" r="15" fill="#E5E7EB" stroke="#9CA3AF" strokeWidth="1.5"/>
                  </svg>
                  <span className="relative z-10 text-base font-bold text-gray-700">
                    {userRank}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 달리기 경주 트랙 */}
      {renderRaceTrack()}

      {/* 사용자 목록 (게시판) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card title="독서 여정 순위" className="lg:col-span-2">
          <div className="space-y-3">
            {(() => {
              // 최종 레벨(레벨 10)에 도달하는 데 필요한 경험치를 기준으로 사용
              const maxLevel = 10;
              const maxExp = getExpForLevel(maxLevel + 1); // 레벨 11에 도달하는 데 필요한 경험치
              
              return allUsers.map((userStatus, index) => {
                const isCurrentUser = userStatus.userId === user?.uid;
                // 총 누적 경험치 기준 진행률 계산 (0-100%)
                const totalExpProgress = maxExp > 0 
                  ? Math.min(100, (userStatus.exp / maxExp) * 100)
                  : 0;
                
                return (
                  <div
                    key={userStatus.userId}
                    className={`p-4 rounded-lg border-2 transition-all cursor-pointer ${
                      isCurrentUser
                        ? 'shadow-md'
                        : 'bg-white border-gray-200 hover:border-orange-200 hover:shadow-sm'
                    }`}
                    style={isCurrentUser ? {
                      backgroundColor: '#fff7ed',
                      borderColor: '#fdba74',
                    } : {}}
                    onMouseEnter={() => setSelectedUser(userStatus)}
                    onMouseLeave={() => setSelectedUser(null)}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-4">
                        {/* 메달 표시 */}
                        <div className="relative w-10 h-10 flex items-center justify-center">
                          {index === 0 ? (
                            <span className="text-4xl">🥇</span>
                          ) : index === 1 ? (
                            <span className="text-4xl">🥈</span>
                          ) : index === 2 ? (
                            <span className="text-4xl">🥉</span>
                          ) : (
                            <div className="relative w-10 h-10 flex items-center justify-center">
                              <svg width="40" height="40" viewBox="0 0 40 40" className="absolute">
                                {/* 메달 리본 */}
                                <path d="M 20 4 L 14 10 L 20 13 L 26 10 Z" fill="#9CA3AF" opacity="0.8"/>
                                {/* 메달 원형 */}
                                <circle cx="20" cy="20" r="16" fill="#D1D5DB" stroke="#9CA3AF" strokeWidth="1.5"/>
                                <circle cx="20" cy="20" r="13" fill="#E5E7EB" stroke="#9CA3AF" strokeWidth="1"/>
                              </svg>
                              <span className="relative z-10 text-sm font-bold text-gray-700">
                                {index + 1}
                              </span>
                            </div>
                          )}
                        </div>
                        <span className="text-3xl">
                          {userStatus.character 
                            ? getCharacterEmoji(userStatus.character.animalType)
                            : getCharacterEmoji('bear')
                          }
                        </span>
                        <div>
                          <div className={`font-semibold ${isCurrentUser ? '' : 'text-gray-900'}`}
                               style={isCurrentUser ? { color: '#c2410c' } : {}}
                          >
                            {userStatus.userName}
                            {isCurrentUser && ' (나)'}
                          </div>
                          <div className="text-sm text-gray-600">
                            레벨 {userStatus.level} • {userStatus.exp.toLocaleString()} EXP
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-semibold" style={{ color: '#ea580c' }}>
                          {userStatus.totalPagesRead.toLocaleString()} 페이지
                        </div>
                        <div className="text-xs text-gray-500">
                          {userStatus.badgesCount}개 뱃지
                        </div>
                      </div>
                    </div>
                    {/* 총 누적 경험치 진행 바 */}
                    <div className="space-y-1">
                      <div className="text-xs text-gray-500">
                        레벨 {userStatus.level} • {userStatus.exp.toLocaleString()} EXP
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2 relative">
                        {userStatus.exp > 0 ? (
                          <div
                            className="h-2 rounded-full transition-all"
                            style={{ 
                              // 최소 너비를 3%로 설정하여 낮은 경험치도 잘 보이도록
                              // 실제 진행률이 3% 미만이면 3%로 표시, 그 이상이면 실제 진행률 사용
                              width: `${Math.max(3, totalExpProgress)}%`,
                              background: 'linear-gradient(to right, #fb923c, #ea580c)'
                            }}
                          />
                        ) : (
                          <div className="h-2 rounded-full bg-gray-300" style={{ width: '0%' }} />
                        )}
                      </div>
                    </div>
                  </div>
                );
              });
            })()}
          </div>
        </Card>

        {/* 내 정보 카드 */}
        {currentUser && (
          <Card title="내 여정 정보">
            <div className="space-y-4">
              <div className="text-center">
                <div className="text-6xl mb-2">
                  {currentUser.character
                    ? getCharacterEmoji(currentUser.character.animalType)
                    : getCharacterEmoji('bear')
                  }
                </div>
                <div className="text-lg font-semibold">{currentUser.userName}</div>
                <div className="flex items-center justify-center gap-2 mt-1">
                  {userRank === 1 ? (
                    <span className="text-4xl">🥇</span>
                  ) : userRank === 2 ? (
                    <span className="text-4xl">🥈</span>
                  ) : userRank === 3 ? (
                    <span className="text-4xl">🥉</span>
                  ) : (
                    <div className="relative w-10 h-10 flex items-center justify-center">
                      <svg width="40" height="40" viewBox="0 0 40 40" className="absolute">
                        {/* 메달 리본 */}
                        <path d="M 20 4 L 14 10 L 20 13 L 26 10 Z" fill="#9CA3AF" opacity="0.8"/>
                        {/* 메달 원형 */}
                        <circle cx="20" cy="20" r="16" fill="#D1D5DB" stroke="#9CA3AF" strokeWidth="1.5"/>
                        <circle cx="20" cy="20" r="13" fill="#E5E7EB" stroke="#9CA3AF" strokeWidth="1"/>
                      </svg>
                      <span className="relative z-10 text-sm font-bold text-gray-700">
                        {userRank}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-2 pt-4 border-t">
                <div className="flex justify-between">
                  <span className="text-gray-600">레벨</span>
                  <span className="font-semibold">{currentUser.level}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">현재 경험치</span>
                  <span className="font-semibold">{currentUser.exp.toLocaleString()} EXP</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">다음 레벨까지</span>
                  <span className="font-semibold">{getExpToNextLevel(currentUser.exp, currentUser.level).toLocaleString()} EXP</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">총 페이지</span>
                  <span className="font-semibold">{currentUser.totalPagesRead.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">뱃지</span>
                  <span className="font-semibold">{currentUser.badgesCount}개</span>
                </div>
              </div>

              {/* 여정 이야기 */}
              <div className="pt-4 pb-2 border-t">
                <div className="bg-gradient-to-br from-orange-50 to-amber-50 rounded-lg p-4 border border-orange-100">
                  <h3 className="text-sm font-semibold text-orange-800 mb-2 flex items-center gap-1">
                    <span>📖</span>
                    <span>나의 독서 여정</span>
                  </h3>
                  <p className="text-sm text-gray-700 leading-relaxed">
                    {generateJourneyNarrative()}
                  </p>
                </div>
              </div>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
