import { NextRequest, NextResponse } from 'next/server';
import { requireUser, HttpError } from '@/lib/server/requireUser';
import { getPublicProfile } from '@/lib/server/community';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    await requireUser(request);

    const { userId } = params;
    if (!userId) {
      throw new HttpError('userId가 필요합니다.', 400);
    }

    const profile = await getPublicProfile(userId);
    if (!profile) {
      throw new HttpError('사용자를 찾을 수 없습니다.', 404);
    }

    return NextResponse.json(profile);
  } catch (error) {
    if (error instanceof HttpError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('공개 프로필 API 오류:', error);
    return NextResponse.json({ error: '사용자 정보를 불러오지 못했습니다.' }, { status: 500 });
  }
}
