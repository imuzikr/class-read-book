import { NextRequest, NextResponse } from 'next/server';
import { requireUser, HttpError } from '@/lib/server/requireUser';
import { computeRankings } from '@/lib/server/community';
import type { RankingPeriod } from '@/lib/server/gamification';

export const dynamic = 'force-dynamic';

const VALID_PERIODS: RankingPeriod[] = ['daily', 'weekly', 'monthly', 'all-time'];

export async function GET(request: NextRequest) {
  try {
    await requireUser(request);

    const periodRaw = request.nextUrl.searchParams.get('period') ?? 'all-time';
    if (!VALID_PERIODS.includes(periodRaw as RankingPeriod)) {
      throw new HttpError('유효하지 않은 기간입니다.', 400);
    }

    const rankings = await computeRankings(periodRaw as RankingPeriod);
    return NextResponse.json({ rankings });
  } catch (error) {
    if (error instanceof HttpError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('랭킹 API 오류:', error);
    return NextResponse.json({ error: '랭킹을 불러오지 못했습니다.' }, { status: 500 });
  }
}
