/**
 * 책 검색 유틸리티
 * 네이버 책 검색 API를 사용하여 책 정보를 검색합니다.
 */

export interface BookSearchResult {
  title: string;
  author: string;
  publisher: string;
  pubdate: string;
  isbn: string;
  description: string;
  image?: string;
  totalPages?: number;
}

export interface BookSearchResponse {
  items: Array<{
    title: string;
    author: string;
    publisher: string;
    pubdate: string;
    isbn: string;
    description: string;
    image?: string;
    price?: string;
    discount?: string;
    link?: string;
  }>;
}

/**
 * 네이버 책 검색 API를 사용하여 책을 검색합니다.
 * @param query 검색어 (책 제목 또는 저자)
 * @returns 검색 결과 배열
 */
export const searchBooks = async (query: string): Promise<BookSearchResult[]> => {
  if (!query.trim()) {
    return [];
  }

  try {
    // 네이버 책 검색 API는 클라이언트에서 직접 호출할 수 없으므로
    // Next.js API Route를 통해 호출합니다.
    const response = await fetch(`/api/books/search?q=${encodeURIComponent(query)}`);
    
    if (!response.ok) {
      throw new Error('책 검색에 실패했습니다.');
    }

    const data: BookSearchResponse = await response.json();
    
    // 각 아이템에 대해 ISBN으로 페이지 수를 가져오기 (병렬 처리)
    const itemsWithPages = await Promise.all(
      data.items.map(async (item) => {
        // 페이지 수 추출 시도
        let totalPages: number | undefined;
        
        // 먼저 ISBN으로 Google Books API에서 페이지 수 가져오기 시도
        if (item.isbn) {
          try {
            // ISBN이 여러 개일 수 있으므로 첫 번째 ISBN 사용
            const isbnList = item.isbn.split(/\s+/).filter(isbn => isbn.trim());
            const firstIsbn = isbnList[0] || item.isbn;
            
            console.log(`책 "${item.title}" ISBN으로 페이지 수 가져오기 시도:`, firstIsbn);
            const { getBookInfoByIsbn } = await import('@/lib/utils/bookInfo');
            const bookInfo = await getBookInfoByIsbn(firstIsbn);
            if (bookInfo?.pageCount) {
              console.log(`책 "${item.title}" 페이지 수 가져오기 성공:`, bookInfo.pageCount);
              totalPages = bookInfo.pageCount;
            } else {
              console.log(`책 "${item.title}" Google Books API에서 페이지 수를 찾을 수 없음`);
            }
          } catch (error) {
            console.error(`책 "${item.title}" ISBN으로 페이지 수 가져오기 실패:`, error);
          }
        }
        
        // ISBN으로 가져오지 못한 경우, 제목과 저자로 Google Books API 시도
        if (!totalPages) {
          try {
            console.log(`책 "${item.title}" 제목과 저자로 페이지 수 가져오기 시도`);
            const { getBookInfoByTitleAndAuthor } = await import('@/lib/utils/bookInfo');
            const cleanTitle = item.title.replace(/<[^>]*>/g, '').trim();
            const cleanAuthor = item.author.replace(/<[^>]*>/g, '').split(/[|^/]/)[0].trim();
            if (cleanTitle && cleanAuthor) {
              const bookInfo = await getBookInfoByTitleAndAuthor(cleanTitle, cleanAuthor);
              if (bookInfo?.pageCount) {
                console.log(`책 "${item.title}" 제목/저자로 페이지 수 가져오기 성공:`, bookInfo.pageCount);
                totalPages = bookInfo.pageCount;
              }
            }
          } catch (error) {
            console.error(`책 "${item.title}" 제목/저자로 페이지 수 가져오기 실패:`, error);
          }
        }
        
        // Google Books API에서 가져오지 못한 경우, 설명에서 추출 시도
        if (!totalPages) {
          // 검색할 텍스트: 제목 + 설명
          const searchText = `${item.title} ${item.description || ''}`;
          
          // 다양한 패턴으로 페이지 수 추출 시도
          const patterns = [
            /(\d+)\s*페이지/i,           // "320페이지", "320 페이지"
            /(\d+)\s*p/i,                 // "320p", "320 p"
            /(\d+)\s*쪽/i,                // "320쪽", "320 쪽"
            /페이지[:\s]*(\d+)/i,         // "페이지: 320", "페이지 320"
            /쪽수[:\s]*(\d+)/i,           // "쪽수: 320"
            /총\s*(\d+)\s*페이지/i,      // "총 320페이지"
            /전체\s*(\d+)\s*페이지/i,     // "전체 320페이지"
          ];
          
          for (const pattern of patterns) {
            const match = searchText.match(pattern);
            if (match) {
              const pages = parseInt(match[1]);
              // 합리적인 페이지 수 범위 체크 (10 ~ 10000)
              if (pages >= 10 && pages <= 10000) {
                totalPages = pages;
                break;
              }
            }
          }
        }
        
        return { ...item, totalPages };
      })
    );
    
    return itemsWithPages.map((item) => {

      // 저자명 처리: 지은이만 추출
      let author = item.author.replace(/<[^>]*>/g, ''); // HTML 태그 제거
      
      // 여러 구분자로 분리: |, ^, / 등
      const authorParts = author.split(/[|^/]/).map(part => part.trim()).filter(part => part);
      
      // "글", "지은이", "저자" 등의 키워드가 있는 부분 우선 선택
      const writtenByIndex = authorParts.findIndex(part => 
        /(글|지은이|저자|글쓴이|작가)/.test(part)
      );
      
      if (writtenByIndex !== -1) {
        // 키워드가 포함된 부분에서 이름만 추출
        const writtenByPart = authorParts[writtenByIndex];
        // "글: 이름" 또는 "지은이: 이름" 형식에서 이름만 추출
        author = writtenByPart.replace(/^(글|지은이|저자|글쓴이|작가)[:\s]*/i, '').trim();
      } else {
        // 키워드가 없으면 첫 번째 저자 사용
        author = authorParts[0] || author;
      }
      
      // "그림", "그린이", "일러스트" 등이 포함된 부분 제거
      author = author.replace(/\s*\([^)]*그림[^)]*\)/gi, ''); // (그림: 이름) 형식 제거
      author = author.replace(/\s*\[[^\]]*그림[^\]]*\]/gi, ''); // [그림: 이름] 형식 제거
      
      // 최종 정리
      author = author.trim();

      return {
        title: item.title.replace(/<[^>]*>/g, ''), // HTML 태그 제거
        author,
        publisher: item.publisher.replace(/<[^>]*>/g, ''),
        pubdate: item.pubdate,
        isbn: item.isbn,
        description: item.description?.replace(/<[^>]*>/g, '') || '',
        image: item.image,
        totalPages: item.totalPages,
      };
    });
  } catch (error) {
    console.error('책 검색 오류:', error);
    throw error;
  }
};

/**
 * ISBN을 사용하여 책 상세 정보를 가져옵니다.
 * @param isbn ISBN 번호
 * @returns 책 정보
 */
export const getBookByIsbn = async (isbn: string): Promise<BookSearchResult | null> => {
  try {
    const results = await searchBooks(isbn);
    return results.length > 0 ? results[0] : null;
  } catch (error) {
    console.error('ISBN 검색 오류:', error);
    return null;
  }
};

