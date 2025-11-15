'use client';

import { ANIMAL_OPTIONS, type AnimalType, type CharacterConfig } from '@/lib/utils/characters';

interface CharacterSelectorProps {
  selectedAnimal?: AnimalType;
  onSelect: (animalType: AnimalType) => void;
  existingCharacters?: CharacterConfig[];
}

export default function CharacterSelector({
  selectedAnimal,
  onSelect,
  existingCharacters = [],
}: CharacterSelectorProps) {
  return (
    <div className="space-y-4">
      <label className="block text-sm font-medium text-gray-700 mb-2">
        캐릭터 선택 *
      </label>
      <div className="grid grid-cols-5 gap-4">
        {ANIMAL_OPTIONS.map((option) => {
          const isSelected = selectedAnimal === option.animalType;

          return (
            <button
              key={option.animalType}
              type="button"
              onClick={() => onSelect(option.animalType)}
              className={`
                relative p-3 rounded-lg border-2 transition-all
                ${isSelected 
                  ? 'border-primary-500 bg-primary-50 shadow-md scale-105' 
                  : 'border-gray-200 bg-white hover:border-primary-300 hover:shadow-sm'
                }
              `}
            >
              <div className="flex flex-col items-center space-y-2">
                <div className="text-5xl">{option.emoji}</div>
                <div className="text-sm font-medium text-gray-700">
                  {option.name}
                </div>
              </div>
              {isSelected && (
                <div className="absolute top-1 right-1 w-5 h-5 bg-primary-500 rounded-full flex items-center justify-center">
                  <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
              )}
            </button>
          );
        })}
      </div>
      {selectedAnimal && (
        <div className="mt-2 text-xs text-gray-500 text-center">
          💡 같은 동물을 선택해도 괜찮아요. 모두 같은 스타일의 옷을 입고 있어요!
        </div>
      )}
    </div>
  );
}

