import { NextRequest } from 'next/server';
import { getAdminAuth } from '@/lib/firebase/admin';

export class HttpError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
  }
}

export interface UserAuthResult {
  uid: string;
  email?: string;
}

/**
 * 로그인한 사용자의 ID 토큰을 검증한다. (관리자 여부는 확인하지 않음)
 */
export async function requireUser(request: NextRequest): Promise<UserAuthResult> {
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new HttpError('인증 토큰이 필요합니다.', 401);
  }

  const token = authHeader.slice('Bearer '.length).trim();
  if (!token) {
    throw new HttpError('유효한 인증 토큰이 필요합니다.', 401);
  }

  try {
    const decoded = await getAdminAuth().verifyIdToken(token);
    return { uid: decoded.uid, email: decoded.email };
  } catch {
    throw new HttpError('인증 토큰이 유효하지 않습니다.', 401);
  }
}
