/**
 * 캐릭터 시스템 유틸리티
 */

export type AnimalType = 
  | 'bear'      // 곰
  | 'rabbit'    // 토끼
  | 'cat'       // 고양이
  | 'dog'       // 강아지
  | 'panda'     // 판다
  | 'fox'       // 여우
  | 'penguin'   // 펭귄
  | 'owl'       // 부엉이
  | 'deer'      // 사슴
  | 'squirrel'; // 다람쥐

export type OutfitColor = 
  | 'blue'
  | 'red'
  | 'green'
  | 'yellow'
  | 'purple'
  | 'pink'
  | 'orange'
  | 'teal';

export type OutfitDesign = 
  | 'solid'      // 단색
  | 'striped'    // 줄무늬
  | 'polka'      // 도트
  | 'checkered'; // 체크

export interface CharacterConfig {
  animalType: AnimalType;
  outfitColor: OutfitColor;
  outfitDesign: OutfitDesign;
}

export interface CharacterOption {
  animalType: AnimalType;
  name: string;
  emoji: string;
}

/**
 * 사용 가능한 동물 캐릭터 목록
 */
export const ANIMAL_OPTIONS: CharacterOption[] = [
  { animalType: 'bear', name: '곰', emoji: '🐻' },
  { animalType: 'rabbit', name: '토끼', emoji: '🐰' },
  { animalType: 'cat', name: '고양이', emoji: '🐱' },
  { animalType: 'dog', name: '강아지', emoji: '🐶' },
  { animalType: 'panda', name: '판다', emoji: '🐼' },
  { animalType: 'fox', name: '여우', emoji: '🦊' },
  { animalType: 'penguin', name: '펭귄', emoji: '🐧' },
  { animalType: 'owl', name: '부엉이', emoji: '🦉' },
  { animalType: 'deer', name: '사슴', emoji: '🦌' },
  { animalType: 'squirrel', name: '다람쥐', emoji: '🐿️' },
];

/**
 * 옷 색상 옵션
 */
export const OUTFIT_COLORS: OutfitColor[] = [
  'blue', 'red', 'green', 'yellow', 'purple', 'pink', 'orange', 'teal'
];

/**
 * 옷 디자인 옵션
 */
export const OUTFIT_DESIGNS: OutfitDesign[] = [
  'solid', 'striped', 'polka', 'checkered'
];

/**
 * 각 동물 타입마다 고정된 옷 스타일 반환
 * 같은 동물은 항상 같은 스타일을 가집니다.
 */
export const getFixedOutfitForAnimal = (animalType: AnimalType): CharacterConfig => {
  // 각 동물별 고정된 옷 스타일 정의
  const animalOutfits: Record<AnimalType, { color: OutfitColor; design: OutfitDesign }> = {
    bear: { color: 'blue', design: 'solid' },
    rabbit: { color: 'pink', design: 'polka' },
    cat: { color: 'purple', design: 'striped' },
    dog: { color: 'red', design: 'solid' },
    panda: { color: 'teal', design: 'checkered' },
    fox: { color: 'orange', design: 'striped' },
    penguin: { color: 'blue', design: 'solid' },
    owl: { color: 'purple', design: 'polka' },
    deer: { color: 'green', design: 'solid' },
    squirrel: { color: 'yellow', design: 'polka' },
  };

  const outfit = animalOutfits[animalType];
  return {
    animalType,
    outfitColor: outfit.color,
    outfitDesign: outfit.design,
  };
};

/**
 * 캐릭터를 시각적으로 표현하는 SVG 생성 (얼굴만)
 */
export const renderCharacterSVG = (config: CharacterConfig, size: number = 80): string => {
  const { animalType } = config;
  
  // 동물별 기본 색상
  const animalColors: Record<AnimalType, { body: string; face: string }> = {
    bear: { body: '#8B4513', face: '#654321' },
    rabbit: { body: '#FFFFFF', face: '#F0F0F0' },
    cat: { body: '#FFA500', face: '#FF8C00' },
    dog: { body: '#D2691E', face: '#A0522D' },
    panda: { body: '#FFFFFF', face: '#000000' },
    fox: { body: '#FF8C00', face: '#FF6347' },
    penguin: { body: '#000000', face: '#FFFFFF' },
    owl: { body: '#8B4513', face: '#654321' },
    deer: { body: '#DEB887', face: '#CD853F' },
    squirrel: { body: '#A0522D', face: '#8B4513' },
  };

  const animalColor = animalColors[animalType];

  return `
    <svg width="${size}" height="${size}" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <!-- 머리 -->
      <circle cx="50" cy="50" r="35" fill="${animalColor.body}"/>
      
      <!-- 얼굴 (동물별 특징) -->
      ${animalType === 'bear' ? `
        <circle cx="42" cy="45" r="4" fill="${animalColor.face}"/>
        <circle cx="58" cy="45" r="4" fill="${animalColor.face}"/>
        <ellipse cx="50" cy="55" rx="6" ry="4" fill="${animalColor.face}"/>
      ` : ''}
      ${animalType === 'rabbit' ? `
        <ellipse cx="40" cy="40" rx="3" ry="8" fill="${animalColor.face}" transform="rotate(-25 40 40)"/>
        <ellipse cx="60" cy="40" rx="3" ry="8" fill="${animalColor.face}" transform="rotate(25 60 40)"/>
        <circle cx="50" cy="55" r="3" fill="${animalColor.face}"/>
      ` : ''}
      ${animalType === 'cat' ? `
        <path d="M 42 38 L 40 33 L 42 33 Z M 58 38 L 60 33 L 58 33 Z" fill="${animalColor.face}"/>
        <ellipse cx="50" cy="55" rx="4" ry="3" fill="${animalColor.face}"/>
      ` : ''}
      ${animalType === 'dog' ? `
        <ellipse cx="42" cy="42" rx="3" ry="5" fill="${animalColor.face}"/>
        <ellipse cx="58" cy="42" rx="3" ry="5" fill="${animalColor.face}"/>
        <ellipse cx="50" cy="55" rx="6" ry="4" fill="${animalColor.face}"/>
      ` : ''}
      ${animalType === 'panda' ? `
        <circle cx="42" cy="45" r="6" fill="${animalColor.face}"/>
        <circle cx="58" cy="45" r="6" fill="${animalColor.face}"/>
        <ellipse cx="50" cy="55" rx="4" ry="3" fill="${animalColor.face}"/>
      ` : ''}
      ${animalType === 'fox' ? `
        <path d="M 50 35 L 42 42 L 50 40 Z M 50 35 L 58 42 L 50 40 Z" fill="${animalColor.face}"/>
        <ellipse cx="50" cy="55" rx="4" ry="3" fill="${animalColor.face}"/>
      ` : ''}
      ${animalType === 'penguin' ? `
        <ellipse cx="50" cy="45" rx="12" ry="15" fill="${animalColor.face}"/>
        <circle cx="44" cy="42" r="3" fill="white"/>
        <circle cx="56" cy="42" r="3" fill="white"/>
        <ellipse cx="50" cy="55" rx="4" ry="3" fill="orange"/>
      ` : ''}
      ${animalType === 'owl' ? `
        <circle cx="50" cy="45" r="18" fill="${animalColor.face}"/>
        <circle cx="44" cy="42" r="4" fill="white"/>
        <circle cx="56" cy="42" r="4" fill="white"/>
        <circle cx="44" cy="42" r="2" fill="black"/>
        <circle cx="56" cy="42" r="2" fill="black"/>
        <path d="M 44 50 L 50 53 L 56 50" stroke="${animalColor.face}" stroke-width="2" fill="none"/>
      ` : ''}
      ${animalType === 'deer' ? `
        <path d="M 50 30 L 46 38 L 50 36 L 54 38 Z" fill="${animalColor.face}"/>
        <ellipse cx="50" cy="55" rx="4" ry="3" fill="${animalColor.face}"/>
      ` : ''}
      ${animalType === 'squirrel' ? `
        <path d="M 50 35 Q 42 28 35 35 Q 42 42 50 35" fill="${animalColor.face}"/>
        <ellipse cx="50" cy="55" rx="4" ry="3" fill="${animalColor.face}"/>
      ` : ''}
    </svg>
  `;
};

/**
 * 캐릭터를 이모지로 간단히 표현 (임시용)
 */
export const getCharacterEmoji = (animalType: AnimalType): string => {
  const option = ANIMAL_OPTIONS.find(opt => opt.animalType === animalType);
  return option?.emoji || '🐾';
};

