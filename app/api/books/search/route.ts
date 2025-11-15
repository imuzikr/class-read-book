import { NextRequest, NextResponse } from 'next/server';

/**
 * 네이버 책 검색 API 프록시
 * 클라이언트에서 직접 네이버 API를 호출할 수 없으므로 서버 사이드에서 처리합니다.
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get('q');

  if (!query) {
    return NextResponse.json({ error: '검색어가 필요합니다.' }, { status: 400 });
  }

  try {
    const clientId = process.env.NAVER_CLIENT_ID;
    const clientSecret = process.env.NAVER_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      console.error('네이버 API 키가 설정되지 않았습니다.');
      return NextResponse.json(
        { error: '책 검색 기능을 사용할 수 없습니다. 관리자에게 문의하세요.' },
        { status: 500 }
      );
    }

    const apiUrl = `https://openapi.naver.com/v1/search/book.json?query=${encodeURIComponent(query)}&display=10&start=1`;
    
    const response = await fetch(apiUrl, {
      headers: {
        'X-Naver-Client-Id': clientId,
        'X-Naver-Client-Secret': clientSecret,
      },
    });

    if (!response.ok) {
      throw new Error(`네이버 API 오류: ${response.status}`);
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('책 검색 API 오류:', error);
    return NextResponse.json(
      { error: error.message || '책 검색에 실패했습니다.' },
      { status: 500 }
    );
  }
}

