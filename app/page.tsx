'use client';

import Link from 'next/link';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import WeeklyChampions from '@/components/weekly/WeeklyChampions';

export default function Home() {
  return (
    <div className="space-y-12">
      {/* Weekly Champions Section */}
      <section className="pt-8">
        <WeeklyChampions />
      </section>

      {/* Hero Section */}
      <section className="text-center py-12">
        <h1 className="text-5xl font-bold text-gray-900 mb-4">
          📚 우리 반 독서 대장
        </h1>
        <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
          학생들의 독서 활동을 게임화하여 장려하는 웹 애플리케이션입니다.
          독서량, 연속 독서일, 감상문을 기록하고 레벨업과 뱃지를 획득하세요!
        </p>
        <div className="flex justify-center space-x-4">
          <Link href="/signup">
            <Button size="lg">시작하기</Button>
          </Link>
          <Link href="/login">
            <Button variant="outline" size="lg">로그인</Button>
          </Link>
        </div>
      </section>

      {/* Features Section */}
      <section>
        <h2 className="text-3xl font-bold text-center mb-8">주요 기능</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Card title="📖 독서 기록">
            <p className="text-gray-600">
              책을 등록하고 일일 독서량을 기록하여 독서 활동을 체계적으로 관리하세요.
            </p>
          </Card>
          <Card title="🔥 연속 독서">
            <p className="text-gray-600">
              매일 독서를 기록하여 연속 독서 일수를 늘리고 보너스 경험치를 획득하세요.
            </p>
          </Card>
          <Card title="✍️ 감상문 작성">
            <p className="text-gray-600">
              읽은 책에 대한 감상문을 작성하고 별점을 매겨 독서 경험을 풍부하게 만드세요.
            </p>
          </Card>
          <Card title="🎮 게임화">
            <p className="text-gray-600">
              독서 활동으로 경험치를 획득하고 레벨업하여 성취감을 느껴보세요.
            </p>
          </Card>
          <Card title="🏆 뱃지 시스템">
            <p className="text-gray-600">
              다양한 업적을 달성하여 뱃지를 획득하고 컬렉션을 완성하세요.
            </p>
          </Card>
          <Card title="📊 통계 및 랭킹">
            <p className="text-gray-600">
              개인 통계를 확인하고 다른 사용자와 랭킹으로 경쟁하세요.
            </p>
          </Card>
        </div>
      </section>
    </div>
  );
}
