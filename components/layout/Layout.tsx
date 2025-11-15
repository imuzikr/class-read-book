'use client';

import { useEffect } from 'react';
import Header from './Header';

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  useEffect(() => {
    // 개발 환경에서만 콘솔 로그 출력
    if (process.env.NODE_ENV === 'development') {
      console.log('Layout 컴포넌트 렌더링됨');
    }
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  );
}
