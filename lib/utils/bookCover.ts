/**
 * Google Books API를 사용하여 책 커버 이미지 URL을 가져옵니다.
 */
export const getBookCoverImage = async (
  title: string,
  author: string
): Promise<string | null> => {
  try {
    // Google Books API 검색
    const query = encodeURIComponent(`${title} ${author}`);
    const response = await fetch(
      `https://www.googleapis.com/books/v1/volumes?q=${query}&maxResults=1`
    );

    if (!response.ok) {
      throw new Error('Google Books API 요청 실패');
    }

    const data = await response.json();

    if (data.items && data.items.length > 0) {
      const book = data.items[0];
      const volumeInfo = book.volumeInfo;

      // 커버 이미지 URL 찾기 (우선순위: thumbnail > smallThumbnail)
      if (volumeInfo.imageLinks) {
        return (
          volumeInfo.imageLinks.thumbnail ||
          volumeInfo.imageLinks.smallThumbnail ||
          null
        );
      }
    }

    return null;
  } catch (error) {
    console.error('책 커버 이미지 가져오기 실패:', error);
    return null;
  }
};

/**
 * 기본 책 커버 이미지 URL을 반환합니다.
 */
export const getDefaultBookCover = (): string => {
  // 기본 책 아이콘 또는 플레이스홀더 이미지
  return 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjMwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjMwMCIgZmlsbD0iI2U1ZTdlYiIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMjQiIGZpbGw9IiM5Y2EzYWYiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj7slYzslYzslYzPC90ZXh0Pjwvc3ZnPg==';
};

