/**
 * 캐릭터 할당 유틸리티
 * 기존 사용자들의 캐릭터 정보를 확인하고 고유한 옷 조합을 생성합니다.
 */

import { getAllUsers } from '@/lib/firebase/users';
import { generateUniqueOutfit, type AnimalType, type CharacterConfig } from './characters';

/**
 * 기존 사용자들의 캐릭터 정보를 가져와서 고유한 옷 조합 생성
 */
export const assignCharacterWithUniqueOutfit = async (
  animalType: AnimalType
): Promise<CharacterConfig> => {
  try {
    // 모든 사용자 데이터 가져오기 (최대 100명)
    const allUsers = await getAllUsers(100);
    
    // 캐릭터 정보가 있는 사용자들만 필터링
    const existingCharacters: CharacterConfig[] = allUsers
      .filter(user => user.character)
      .map(user => ({
        animalType: user.character!.animalType as AnimalType,
        outfitColor: user.character!.outfitColor as any,
        outfitDesign: user.character!.outfitDesign as any,
      }));

    // 고유한 옷 조합 생성
    return generateUniqueOutfit(animalType, existingCharacters);
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

