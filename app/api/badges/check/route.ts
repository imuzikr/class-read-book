import { NextRequest, NextResponse } from 'next/server';
import { requireUser, HttpError } from '@/lib/server/requireUser';
import { checkAndAwardBadges } from '@/lib/server/badges';

/**
 * 뱃지 재평가 API
 * 책 등록/수정 등 뱃지 조건이 바뀔 수 있는 동작 후 호출한다.
 */
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const { uid } = await requireUser(request);
    const newBadges = await checkAndAwardBadges(uid);
    return NextResponse.json({ newBadges });
  } catch (error) {
    if (error instanceof HttpError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('뱃지 확인 API 오류:', error);
    return NextResponse.json({ error: '뱃지 확인에 실패했습니다.' }, { status: 500 });
  }
}
