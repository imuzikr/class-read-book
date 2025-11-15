import type { BookSearchResult } from './bookSearch';

export interface BookSearchResponse {
  items: Array<{
    title: string;
    author: string;
    publisher: string;
    pubdate: string;
    isbn: string;
    description?: string;
    image?: string;
  }>;
  total: number;
  start: number;
  display: number;
}

/**
 * 네이버 책 검색 API를 사용하여 책을 검색합니다.
 * 페이지 수는 빠르게 설명에서 추출하고, Google Books API 호출은 최소화합니다.
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
    const response = await fetch(`/api/books/search?q=${encodeURIComponent(query)}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    // 응답이 없거나 실패한 경우 빈 배열 반환
    if (!response) {
      console.warn('책 검색 API 응답 없음');
      return [];
    }
    
    if (!response.ok) {
      // 응답 본문을 읽으려고 시도하되 실패해도 계속 진행
      try {
        const errorText = await response.text();
        console.warn(`책 검색 API 응답 오류 (${response.status}):`, errorText);
      } catch (e) {
        console.warn(`책 검색 API 응답 오류 (${response.status})`);
      }
      // 네이버 API가 실패해도 빈 배열 반환 (앱이 중단되지 않도록)
      return [];
    }

    let data: BookSearchResponse;
    try {
      data = await response.json();
    } catch (jsonError) {
      console.error('책 검색 응답 JSON 파싱 오류:', jsonError);
      return [];
    }
    
    // 네이버 API가 빈 결과를 반환한 경우
    if (!data.items || data.items.length === 0) {
      console.log(`책 검색 결과 없음: "${query}"`);
      return [];
    }
    
    // 빠르게 기본 정보만 반환 (설명에서 페이지 수 추출)
    return data.items.map((item) => {
      // 페이지 수 추출 시도 (설명에서 빠르게 추출)
      let totalPages: number | undefined;
      
      if (item.description) {
        // 다양한 패턴으로 페이지 수 추출
        const patterns = [
          /(\d+)\s*페이지/i,           // "320페이지", "320 페이지"
          /페이지\s*[:：]\s*(\d+)/i,   // "페이지: 320", "페이지 320"
          /(\d+)\s*쪽/i,                // "320쪽", "320 쪽"
          /쪽\s*[:：]\s*(\d+)/i,        // "쪽: 320"
          /(\d+)\s*p/i,                 // "320p", "320 p"
          /총\s*(\d+)\s*페이지/i,      // "총 320페이지"
          /전체\s*(\d+)\s*페이지/i,     // "전체 320페이지"
        ];
        
        for (const pattern of patterns) {
          const match = item.description.match(pattern);
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
        totalPages, // 설명에서 추출한 페이지 수 (없으면 undefined)
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

/**
 * 선택한 책의 페이지 수를 Google Books API에서 가져옵니다.
 * 검색 결과에 페이지 수가 없을 때만 호출합니다.
 * @param book 검색 결과 책 정보
 * @returns 페이지 수 (없으면 undefined)
 */
export const fetchBookPageCount = async (book: BookSearchResult): Promise<number | undefined> => {
  // ISBN으로 먼저 시도
  if (book.isbn) {
    try {
      const isbnList = book.isbn.split(/\s+/).filter(isbn => isbn.trim());
      const firstIsbn = isbnList[0] || book.isbn;
      const { getBookInfoByIsbn } = await import('@/lib/utils/bookInfo');
      const bookInfo = await getBookInfoByIsbn(firstIsbn);
      if (bookInfo?.pageCount) {
        return bookInfo.pageCount;
      }
    } catch (error) {
      // 실패해도 계속 진행
    }
  }
  
  // 제목과 저자로 시도
  if (book.title && book.author) {
    try {
      const { getBookInfoByTitleAndAuthor } = await import('@/lib/utils/bookInfo');
      const bookInfo = await getBookInfoByTitleAndAuthor(book.title, book.author);
      if (bookInfo?.pageCount) {
        return bookInfo.pageCount;
      }
    } catch (error) {
      // 실패해도 계속 진행
    }
  }
  
  return undefined;
};
