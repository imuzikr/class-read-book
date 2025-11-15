import { NextRequest, NextResponse } from 'next/server';

/**
 * 네이버 책 검색 API 프록시
 * 클라이언트에서 직접 네이버 API를 호출할 수 없으므로 서버 사이드에서 처리합니다.
 */
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

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
      console.error('NAVER_CLIENT_ID:', clientId ? '설정됨' : '없음');
      console.error('NAVER_CLIENT_SECRET:', clientSecret ? '설정됨' : '없음');
      
      // 네이버 API 키가 없어도 Google Books API만 사용할 수 있도록 빈 결과 반환
      return NextResponse.json({
        items: [],
        total: 0,
        start: 0,
        display: 0,
      });
    }

    const apiUrl = `https://openapi.naver.com/v1/search/book.json?query=${encodeURIComponent(query)}&display=10&start=1`;
    
    const response = await fetch(apiUrl, {
      headers: {
        'X-Naver-Client-Id': clientId,
        'X-Naver-Client-Secret': clientSecret,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`네이버 API 오류 (${response.status}):`, errorText);
      
      // 네이버 API 실패 시 빈 결과 반환 (Google Books API는 여전히 사용 가능)
      return NextResponse.json({
        items: [],
        total: 0,
        start: 0,
        display: 0,
      });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('책 검색 API 오류:', error);
    console.error('에러 상세:', error?.message || String(error), error?.stack);
    
    // 에러 발생 시 빈 결과 반환 (앱이 완전히 중단되지 않도록)
    // 항상 200 상태 코드로 반환하여 클라이언트가 정상적으로 처리할 수 있도록 함
    return NextResponse.json(
      {
        items: [],
        total: 0,
        start: 0,
        display: 0,
      },
      { status: 200 }
    );
  }
}

