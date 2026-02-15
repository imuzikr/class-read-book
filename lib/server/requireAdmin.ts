import { NextRequest } from 'next/server';
import { getAdminAuth, getAdminDb } from '@/lib/firebase/admin';

export interface AdminAuthResult {
  uid: string;
  email?: string;
}

export class AdminAuthError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'AdminAuthError';
    this.status = status;
  }
}

function getBearerToken(request: NextRequest): string {
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new AdminAuthError('인증 토큰이 필요합니다.', 401);
  }

  const token = authHeader.slice('Bearer '.length).trim();
  if (!token) {
    throw new AdminAuthError('유효한 인증 토큰이 필요합니다.', 401);
  }

  return token;
}

export async function requireAdmin(request: NextRequest): Promise<AdminAuthResult> {
  const token = getBearerToken(request);
  const adminAuth = getAdminAuth();
  const adminDb = getAdminDb();
  const decoded = await adminAuth.verifyIdToken(token);

  const adminDoc = await adminDb.collection('admins').doc(decoded.uid).get();
  if (!adminDoc.exists) {
    throw new AdminAuthError('관리자 권한이 없습니다.', 403);
  }

  return {
    uid: decoded.uid,
    email: decoded.email,
  };
}
