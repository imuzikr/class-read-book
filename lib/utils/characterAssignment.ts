/**
 * 캐릭터 할당 유틸리티
 * 기존 사용자들의 캐릭터 정보를 확인하고 고유한 옷 조합을 생성합니다.
 */

import { getAllUsers } from '@/lib/firebase/users';
import { getFixedOutfitForAnimal, type AnimalType, type CharacterConfig } from './characters';

/**
 * 기존 사용자들의 캐릭터 정보를 가져와서 고유한 옷 조합 생성
 */
export const assignCharacterWithUniqueOutfit = async (
  animalType: AnimalType
): Promise<CharacterConfig> => {
  try {
    // 각 동물 타입마다 고정된 옷 스타일 반환
    return getFixedOutfitForAnimal(animalType);
  } catch (error) {
    console.error('캐릭터 할당 오류:', error);
    // 오류 발생 시 기본 조합 반환
    return {
      animalType,
      outfitColor: 'blue',
      outfitDesign: 'solid',
    };
  }
};

