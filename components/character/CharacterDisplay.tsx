'use client';

import { type CharacterConfig } from '@/lib/utils/characters';
import { renderCharacterSVG, getCharacterEmoji } from '@/lib/utils/characters';

interface CharacterDisplayProps {
  character: CharacterConfig;
  size?: number;
  showEmoji?: boolean;
  className?: string;
}

export default function CharacterDisplay({
  character,
  size = 80,
  showEmoji = false,
  className = '',
}: CharacterDisplayProps) {
  return (
    <div className={`inline-flex items-center justify-center ${className}`}>
      {showEmoji ? (
        <span className="text-4xl">{getCharacterEmoji(character.animalType)}</span>
      ) : (
        <div
          dangerouslySetInnerHTML={{ 
            __html: renderCharacterSVG(character, size) 
          }}
          className="inline-block"
        />
      )}
    </div>
  );
}

