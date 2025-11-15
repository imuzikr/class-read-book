import { NextRequest, NextResponse } from 'next/server';

/**
 * 네이버 책 검색 API 프록시
 * 클라이언트에서 직접 네이버 API를 호출할 수 없으므로 서버 사이드에서 처리합니다.
 */
export const dynamic = 'force-dynamic';

// 빈 결과를 반환하는 헬퍼 함수
function returnEmptyResult() {
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

export async function GET(request: NextRequest) {
  // 모든 에러를 잡아서 빈 결과를 반환하도록 최상위 try-catch
  try {
    // 검색어 가져오기
    let query: string | null = null;
    try {
      const searchParams = request.nextUrl.searchParams;
      query = searchParams.get('q');
    } catch (e) {
      console.error('searchParams 가져오기 실패:', e);
      return returnEmptyResult();
    }

    if (!query) {
      return NextResponse.json({ error: '검색어가 필요합니다.' }, { status: 400 });
    }

    // 환경 변수 가져오기
    let clientId: string | undefined;
    let clientSecret: string | undefined;
    try {
      clientId = process.env.NAVER_CLIENT_ID;
      clientSecret = process.env.NAVER_CLIENT_SECRET;
    } catch (e) {
      console.error('환경 변수 읽기 실패:', e);
      return returnEmptyResult();
    }

    // 네이버 API 키가 없으면 빈 결과 반환
    if (!clientId || !clientSecret) {
      console.log('네이버 API 키가 설정되지 않았습니다. 빈 결과 반환.');
      return returnEmptyResult();
    }

    // 네이버 API 호출
    try {
      const apiUrl = `https://openapi.naver.com/v1/search/book.json?query=${encodeURIComponent(query)}&display=10&start=1`;
      
      const response = await fetch(apiUrl, {
        headers: {
          'X-Naver-Client-Id': clientId,
          'X-Naver-Client-Secret': clientSecret,
        },
      });

      if (!response.ok) {
        let errorText = '';
        try {
          errorText = await response.text();
        } catch (e) {
          // 응답 본문 읽기 실패는 무시
        }
        console.warn(`네이버 API 오류 (${response.status}):`, errorText || '응답 본문 없음');
        return returnEmptyResult();
      }

      let data;
      try {
        data = await response.json();
      } catch (jsonError) {
        console.error('네이버 API 응답 JSON 파싱 오류:', jsonError);
        return returnEmptyResult();
      }

      return NextResponse.json(data, { status: 200 });
    } catch (fetchError: any) {
      // 네이버 API 호출 실패 (네트워크 오류, 타임아웃 등)
      console.warn('네이버 API 호출 실패:', fetchError?.message || String(fetchError));
      return returnEmptyResult();
    }
  } catch (error: any) {
    // 예상치 못한 모든 에러 처리
    const errorMessage = error?.message || String(error);
    const errorStack = error?.stack || 'No stack trace';
    
    console.error('책 검색 API 예상치 못한 오류:', errorMessage);
    console.error('에러 스택:', errorStack);
    console.error('에러 타입:', typeof error);
    
    // 항상 빈 결과 반환 (500 에러 방지)
    try {
      return returnEmptyResult();
    } catch (responseError: any) {
      // NextResponse.json도 실패하는 경우 (매우 드묾)
      console.error('NextResponse.json 실패:', responseError);
      return new NextResponse(
        JSON.stringify({
          items: [],
          total: 0,
          start: 0,
          display: 0,
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );
    }
  }
}
