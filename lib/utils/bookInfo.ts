/**
 * Google Books API를 사용하여 ISBN으로 책 상세 정보를 가져옵니다.
 */

export interface BookInfo {
  title: string;
  author: string;
  isbn?: string;
  pageCount?: number;
  description?: string;
  coverImage?: string;
  publisher?: string;
  publishedDate?: string;
}

/**
 * ISBN을 사용하여 Google Books API에서 책 정보를 가져옵니다.
 */
export const getBookInfoByIsbn = async (isbn: string): Promise<BookInfo | null> => {
  try {
    // ISBN에서 하이픈 제거
    const cleanIsbn = isbn.replace(/[-\s]/g, '');
    
    // Google Books API로 ISBN 검색
    const response = await fetch(
      `https://www.googleapis.com/books/v1/volumes?q=isbn:${cleanIsbn}&maxResults=1`
    );

    if (!response.ok) {
      throw new Error('Google Books API 요청 실패');
    }

    const data = await response.json();

    if (data.items && data.items.length > 0) {
      const book = data.items[0];
      const volumeInfo = book.volumeInfo;

      // 저자 배열을 문자열로 변환
      const authors = volumeInfo.authors || [];
      const author = authors.length > 0 ? authors[0] : '';

      // ISBN 추출 (우선순위: ISBN_13 > ISBN_10)
      let isbn13 = '';
      let isbn10 = '';
      if (volumeInfo.industryIdentifiers) {
        for (const identifier of volumeInfo.industryIdentifiers) {
          if (identifier.type === 'ISBN_13') {
            isbn13 = identifier.identifier;
          } else if (identifier.type === 'ISBN_10') {
            isbn10 = identifier.identifier;
          }
        }
      }

      return {
        title: volumeInfo.title || '',
        author,
        isbn: isbn13 || isbn10 || cleanIsbn,
        pageCount: volumeInfo.pageCount || undefined,
        description: volumeInfo.description || undefined,
        coverImage: volumeInfo.imageLinks?.thumbnail || volumeInfo.imageLinks?.smallThumbnail || undefined,
        publisher: volumeInfo.publisher || undefined,
        publishedDate: volumeInfo.publishedDate || undefined,
      };
    }

    return null;
  } catch (error) {
    console.error('ISBN으로 책 정보 가져오기 실패:', error);
    return null;
  }
};

/**
 * 제목과 저자로 Google Books API에서 책 정보를 가져옵니다.
 */
export const getBookInfoByTitleAndAuthor = async (
  title: string,
  author: string
): Promise<BookInfo | null> => {
  try {
    const query = encodeURIComponent(`intitle:${title} inauthor:${author}`);
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

      const authors = volumeInfo.authors || [];
      const authorName = authors.length > 0 ? authors[0] : '';

      let isbn13 = '';
      let isbn10 = '';
      if (volumeInfo.industryIdentifiers) {
        for (const identifier of volumeInfo.industryIdentifiers) {
          if (identifier.type === 'ISBN_13') {
            isbn13 = identifier.identifier;
          } else if (identifier.type === 'ISBN_10') {
            isbn10 = identifier.identifier;
          }
        }
      }

      return {
        title: volumeInfo.title || '',
        author: authorName,
        isbn: isbn13 || isbn10 || undefined,
        pageCount: volumeInfo.pageCount || undefined,
        description: volumeInfo.description || undefined,
        coverImage: volumeInfo.imageLinks?.thumbnail || volumeInfo.imageLinks?.smallThumbnail || undefined,
        publisher: volumeInfo.publisher || undefined,
        publishedDate: volumeInfo.publishedDate || undefined,
      };
    }

    return null;
  } catch (error) {
    console.error('제목과 저자로 책 정보 가져오기 실패:', error);
    return null;
  }
};

