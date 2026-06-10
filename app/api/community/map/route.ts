import { NextRequest, NextResponse } from 'next/server';
import { requireUser, HttpError } from '@/lib/server/requireUser';
import { computeMapStatuses } from '@/lib/server/community';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    await requireUser(request);
    const statuses = await computeMapStatuses();
    return NextResponse.json({ statuses });
  } catch (error) {
    if (error instanceof HttpError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('여정 현황 API 오류:', error);
    return NextResponse.json({ error: '여정 현황을 불러오지 못했습니다.' }, { status: 500 });
  }
}
