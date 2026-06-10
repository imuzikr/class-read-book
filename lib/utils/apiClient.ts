import { auth } from '@/lib/firebase/config';

/**
 * Firebase ID 토큰을 포함해 내부 API를 호출하는 헬퍼
 */
export async function authedFetch<T = unknown>(
  url: string,
  options: { method?: string; body?: unknown } = {}
): Promise<T> {
  if (!auth?.currentUser) {
    throw new Error('로그인이 필요합니다.');
  }

  const token = await auth.currentUser.getIdToken();
  const response = await fetch(url, {
    method: options.method ?? 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error((data as { error?: string })?.error || '요청 처리에 실패했습니다.');
  }

  return data as T;
}
