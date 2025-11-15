/**
 * 지도 여정 시스템 유틸리티
 */

export interface MapPosition {
  x: number; // 0-100 (퍼센트)
  y: number; // 0-100 (퍼센트)
  stage: number; // 현재 스테이지 (1-10)
  progress: number; // 현재 스테이지 내 진행률 (0-100)
}

export interface CharacterData {
  userId: string;
  userName: string;
  level: number;
  exp: number;
  totalPagesRead: number;
  badgesCount: number;
  position: MapPosition;
  avatar: string; // 캐릭터 아이콘/이모지
}

/**
 * 레벨에 따른 지도 위치 계산
 */
export const calculateMapPosition = (level: number, exp: number, totalPagesRead: number): MapPosition => {
  // 총 10개의 스테이지 (각 스테이지는 약 2-3레벨)
  const maxStage = 10;
  const stage = Math.min(Math.floor(level / 1.5) + 1, maxStage);
  
  // 현재 스테이지 내 진행률 계산
  const stageStartLevel = (stage - 1) * 1.5;
  const stageEndLevel = stage * 1.5;
  const currentStageProgress = Math.min(
    ((level - stageStartLevel) / (stageEndLevel - stageStartLevel)) * 100,
    100
  );

  // 지도 좌표 계산 (S자 경로)
  const pathPoints = generateSPath(maxStage);
  const currentPoint = pathPoints[stage - 1];
  const nextPoint = pathPoints[Math.min(stage, maxStage - 1)];

  // 현재 스테이지 내 보간
  const x = currentPoint.x + (nextPoint.x - currentPoint.x) * (currentStageProgress / 100);
  const y = currentPoint.y + (nextPoint.y - currentPoint.y) * (currentStageProgress / 100);

  return {
    x: Math.max(0, Math.min(100, x)),
    y: Math.max(0, Math.min(100, y)),
    stage,
    progress: Math.round(currentStageProgress),
  };
};

/**
 * S자 경로 생성 (지도상의 경로)
 */
const generateSPath = (stages: number): Array<{ x: number; y: number }> => {
  const points: Array<{ x: number; y: number }> = [];
  
  for (let i = 0; i < stages; i++) {
    const progress = i / (stages - 1);
    
    // S자 곡선 경로
    let x: number;
    let y: number;
    
    if (i < stages / 2) {
      // 상단 반원
      const angle = (i / (stages / 2)) * Math.PI;
      x = 20 + (80 * (i / (stages / 2)));
      y = 20 + 30 * Math.sin(angle);
    } else {
      // 하단 반원
      const angle = ((i - stages / 2) / (stages / 2)) * Math.PI;
      x = 20 + (80 * ((i - stages / 2) / (stages / 2)));
      y = 50 + 30 * Math.sin(angle);
    }
    
    points.push({ x, y });
  }
  
  return points;
};

/**
 * 캐릭터 아바타 선택 (레벨 및 업적 기반)
 */
export const getCharacterAvatar = (level: number, badgesCount: number): string => {
  // 레벨에 따른 기본 캐릭터
  if (level >= 20) return '👑'; // 킹
  if (level >= 15) return '🦸'; // 히어로
  if (level >= 10) return '🧙'; // 마법사
  if (level >= 7) return '⚔️'; // 전사
  if (level >= 5) return '🏃'; // 러너
  if (level >= 3) return '📚'; // 독서가
  return '🌱'; // 새싹
};

/**
 * 스테이지 이름 가져오기
 */
export const getStageName = (stage: number): string => {
  const stageNames = [
    '시작의 마을',
    '독서의 숲',
    '지식의 언덕',
    '상상의 바다',
    '지혜의 산',
    '탐험의 계곡',
    '발견의 섬',
    '성장의 평원',
    '완성의 성',
    '마스터의 궁전',
  ];
  
  return stageNames[stage - 1] || `스테이지 ${stage}`;
};

/**
 * 사용자들을 지도 위치 순으로 정렬
 */
export const sortUsersByPosition = (users: CharacterData[]): CharacterData[] => {
  return [...users].sort((a, b) => {
    // 먼저 스테이지로 정렬
    if (a.position.stage !== b.position.stage) {
      return b.position.stage - a.position.stage;
    }
    // 같은 스테이지면 진행률로 정렬
    if (a.position.progress !== b.position.progress) {
      return b.position.progress - a.position.progress;
    }
    // 같은 진행률이면 레벨로 정렬
    return b.level - a.level;
  });
};

