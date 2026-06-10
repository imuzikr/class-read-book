import { NextRequest, NextResponse } from 'next/server';
import { requireUser, HttpError } from '@/lib/server/requireUser';
import { computeWeeklyChampions } from '@/lib/server/community';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    await requireUser(request);
    const champions = await computeWeeklyChampions(3);
    return NextResponse.json({ champions });
  } catch (error) {
    if (error instanceof HttpError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('주간 독서 대장 API 오류:', error);
    return NextResponse.json({ error: '주간 독서 대장을 불러오지 못했습니다.' }, { status: 500 });
  }
}
