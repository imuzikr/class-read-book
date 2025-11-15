/**
 * Google Books API를 사용하여 책 커버 이미지 URL을 가져옵니다.
 * 여러 검색 방법을 시도하여 정확도를 높입니다.
 */
export const getBookCoverImage = async (
  title: string,
  author: string
): Promise<string | null> => {
  const cleanTitle = title.trim();
  const cleanAuthor = author.trim();
  
  if (!cleanTitle) {
    return null;
  }

  // 여러 검색 방법을 시도
  const searchMethods = [
    // 방법 1: intitle과 inauthor를 사용한 정확한 검색
    cleanAuthor ? `intitle:${cleanTitle} inauthor:${cleanAuthor}` : null,
    // 방법 2: 제목과 저자를 함께 검색
    cleanAuthor ? `${cleanTitle} ${cleanAuthor}` : null,
    // 방법 3: 제목만 검색
    cleanTitle,
  ].filter(Boolean) as string[];

  for (const query of searchMethods) {
    try {
      const encodedQuery = encodeURIComponent(query);
      const response = await fetch(
        `https://www.googleapis.com/books/v1/volumes?q=${encodedQuery}&maxResults=5`
      );

      if (!response.ok) {
        console.warn(`Google Books API 요청 실패 (${query}):`, response.status);
        continue;
      }

      const data = await response.json();

      if (data.items && data.items.length > 0) {
        // 여러 결과 중에서 가장 매칭되는 것을 찾기
        for (const book of data.items) {
          const volumeInfo = book.volumeInfo;
          
          // 제목 매칭 확인 (대소문자 무시)
          const bookTitle = volumeInfo.title?.toLowerCase() || '';
          const searchTitle = cleanTitle.toLowerCase();
          
          // 저자 매칭 확인
          const bookAuthors = volumeInfo.authors || [];
          const authorMatch = !cleanAuthor || bookAuthors.some((a: string) => 
            a.toLowerCase().includes(cleanAuthor.toLowerCase()) ||
            cleanAuthor.toLowerCase().includes(a.toLowerCase())
          );
          
          // 제목이 유사하고 (저자가 없거나 매칭되면) 이미지 반환
          const titleMatch = bookTitle.includes(searchTitle) || searchTitle.includes(bookTitle);
          if (titleMatch && authorMatch) {
            if (volumeInfo.imageLinks) {
              const imageUrl = volumeInfo.imageLinks.thumbnail || 
                              volumeInfo.imageLinks.smallThumbnail ||
                              volumeInfo.imageLinks.medium ||
                              volumeInfo.imageLinks.large ||
                              null;
              
              if (imageUrl) {
                console.log(`책 "${cleanTitle}" 이미지 찾기 성공 (${query}):`, imageUrl);
                return imageUrl;
              }
            }
          }
        }
      }
    } catch (error) {
      console.warn(`책 "${cleanTitle}" 이미지 검색 실패 (${query}):`, error);
      continue;
    }
  }

  console.log(`책 "${cleanTitle}" (${cleanAuthor}) 이미지를 찾을 수 없음`);
  return null;
};

/**
 * 기본 책 커버 이미지 URL을 반환합니다.
 */
export const getDefaultBookCover = (): string => {
  // 기본 책 아이콘 또는 플레이스홀더 이미지
  return 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjMwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjMwMCIgZmlsbD0iI2U1ZTdlYiIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMjQiIGZpbGw9IiM5Y2EzYWYiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj7slYzslYzslYzPC90ZXh0Pjwvc3ZnPg==';
};

