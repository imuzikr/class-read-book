'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useAuth } from '@/hooks/useAuth';
import { createBook, checkDuplicateBook } from '@/lib/firebase/firestore';
import { authedFetch } from '@/lib/utils/apiClient';

import { searchBooks, fetchBookPageCount, type BookSearchResult } from '@/lib/utils/bookSearch';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Card from '@/components/ui/Card';

export default function NewBookPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<BookSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [showManualInput, setShowManualInput] = useState(false);
  const [selectedBookImage, setSelectedBookImage] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    title: '',
    author: '',
    totalPages: '',
    currentPage: '0',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) {
      router.push('/login');
      return;
    }

    setError('');
    setLoading(true);

    try {
      const totalPagesNum = parseInt(formData.totalPages);
      const currentPageNum = parseInt(formData.currentPage);

      if (!formData.title.trim()) {
        setError('책 제목을 입력해주세요.');
        return;
      }

      if (!formData.author.trim()) {
        setError('저자명을 입력해주세요.');
        return;
      }

      if (isNaN(totalPagesNum) || totalPagesNum <= 0) {
        setError('총 페이지 수를 올바르게 입력해주세요.');
        return;
      }

      if (isNaN(currentPageNum) || currentPageNum < 0 || currentPageNum > totalPagesNum) {
        setError('현재 페이지를 올바르게 입력해주세요.');
        return;
      }

      // 중복 체크
      const isDuplicate = await checkDuplicateBook(
        user.uid,
        formData.title.trim(),
        formData.author.trim()
      );

      if (isDuplicate) {
        setError('이미 같은 제목과 저자의 책이 등록되어 있습니다. 내 서재를 확인해주세요.');
        return;
      }

      // 책 커버 이미지 가져오기
      let coverImage: string | null = null;
      
      // 검색 결과에서 선택한 이미지가 있으면 우선 사용
      if (selectedBookImage) {
        coverImage = selectedBookImage;
      } else {
        // 없으면 Google Books API에서 가져오기
        const { getBookCoverImage } = await import('@/lib/utils/bookCover');
        coverImage = await getBookCoverImage(
          formData.title.trim(),
          formData.author.trim()
        );
      }

      await createBook({
        userId: user.uid,
        title: formData.title.trim(),
        author: formData.author.trim(),
        totalPages: totalPagesNum,
        currentPage: currentPageNum,
        startDate: new Date(),
        status: currentPageNum >= totalPagesNum ? 'completed' : 'reading',
        coverImage: coverImage || undefined,
      });

      // 뱃지 체크 (첫 책 등록) - 서버에서 평가/부여
      try {
        const { newBadges } = await authedFetch<{ newBadges: { name: string }[] }>('/api/badges/check');
        if (newBadges.length === 1) {
          alert(`🎉 뱃지 획득: ${newBadges[0].name}!`);
        } else if (newBadges.length > 1) {
          alert(`🎉 ${newBadges.length}개의 뱃지를 획득했습니다!`);
        }
      } catch (badgeErr) {
        console.error('뱃지 확인 실패:', badgeErr);
      }

      router.push('/books');
    } catch (err: any) {
      setError(err.message || '책 등록에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) {
      return;
    }

    setSearching(true);
    setError('');

    try {
      const results = await searchBooks(searchQuery);
      setSearchResults(results);
      if (results.length === 0) {
        setError('검색 결과가 없습니다. 수동으로 입력해주세요.');
        setShowManualInput(true);
      }
    } catch (err: any) {
      setError(err.message || '책 검색에 실패했습니다. 수동으로 입력해주세요.');
      setShowManualInput(true);
    } finally {
      setSearching(false);
    }
  };

  const handleSelectBook = async (book: BookSearchResult) => {
    // 검색 결과에서 이미지가 있으면 저장
    setSelectedBookImage(book.image || null);
    
    // 페이지 수가 없으면 Google Books API에서 가져오기 시도
    let totalPages = book.totalPages;
    if (!totalPages) {
      setError('페이지 수를 가져오는 중...');
      try {
        totalPages = await fetchBookPageCount(book);
        if (totalPages) {
          setError('');
        } else {
          setError('페이지 수 정보를 찾을 수 없습니다. 총 페이지 수를 직접 입력해주세요.');
        }
      } catch (err) {
        setError('페이지 수 정보를 찾을 수 없습니다. 총 페이지 수를 직접 입력해주세요.');
      }
    } else {
      setError('');
    }
    
    setFormData({
      title: book.title,
      author: book.author,
      totalPages: totalPages?.toString() || '',
      currentPage: '0',
    });
    setSearchResults([]);
    setSearchQuery('');
    setShowManualInput(true);
  };

  const handleManualInputToggle = () => {
    setShowManualInput(!showManualInput);
    if (!showManualInput) {
      // 수동 입력 모드로 전환 시 검색 결과 초기화
      setSearchResults([]);
      setSearchQuery('');
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">새 책 추가</h1>
      
      <Card>
        {/* 책 검색 섹션 */}
        {!showManualInput && (
          <div className="mb-6 pb-6 border-b">
            <h2 className="text-lg font-semibold mb-4">책 검색</h2>
            <form onSubmit={handleSearch} className="space-y-4">
              <div className="flex space-x-2">
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="책 제목 또는 저자명을 입력하세요"
                  disabled={searching || loading}
                  className="flex-1"
                />
                <Button
                  type="submit"
                  disabled={searching || loading || !searchQuery.trim()}
                >
                  {searching ? '검색 중...' : '검색'}
                </Button>
              </div>
            </form>

            {/* 검색 결과 */}
            {searchResults.length > 0 && (
              <div className="mt-4 space-y-2 max-h-96 overflow-y-auto">
                <p className="text-sm text-gray-600 mb-2">
                  검색 결과 ({searchResults.length}개)
                </p>
                {searchResults.map((book, index) => (
                  <div
                    key={index}
                    onClick={() => handleSelectBook(book)}
                    className="p-3 border rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                  >
                    <div className="flex items-start space-x-3">
                      {book.image && (
                        <Image
                          src={book.image}
                          alt={book.title}
                          className="w-16 h-20 object-cover rounded"
                          width={64}
                          height={80}
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-sm truncate">{book.title}</h3>
                        <p className="text-xs text-gray-600 mt-1">
                          {book.author} • {book.publisher}
                        </p>
                        {book.totalPages ? (
                          <p className="text-xs text-primary-600 font-medium mt-1">
                            {book.totalPages}페이지
                          </p>
                        ) : (
                          <p className="text-xs text-amber-600 mt-1">
                            ⚠️ 페이지 수 정보 없음 (수동 입력 필요)
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* 수동 입력 버튼 */}
            <div className="mt-4 text-center">
              <button
                type="button"
                onClick={handleManualInputToggle}
                className="text-sm text-primary-600 hover:text-primary-700 underline"
              >
                검색 결과가 없나요? 수동으로 입력하기
              </button>
            </div>
          </div>
        )}

        {/* 수동 입력 모드 토글 버튼 */}
        {showManualInput && (
          <div className="mb-4">
            <button
              type="button"
              onClick={handleManualInputToggle}
              className="text-sm text-primary-600 hover:text-primary-700 underline"
            >
              ← 책 검색으로 돌아가기
            </button>
          </div>
        )}

        {/* 책 정보 입력 폼 */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            name="title"
            label="책 제목 *"
            value={formData.title}
            onChange={handleChange}
            placeholder="예: 해리포터와 마법사의 돌"
            required
            disabled={loading}
          />
          
          <Input
            name="author"
            label="저자 *"
            value={formData.author}
            onChange={handleChange}
            placeholder="예: J.K. 롤링"
            required
            disabled={loading}
          />
          
          <Input
            name="totalPages"
            label="총 페이지 수 *"
            type="number"
            value={formData.totalPages}
            onChange={handleChange}
            placeholder="예: 320"
            min="1"
            required
            disabled={loading}
          />
          
          <Input
            name="currentPage"
            label="현재 읽은 페이지"
            type="number"
            value={formData.currentPage}
            onChange={handleChange}
            placeholder="예: 0 (처음부터 읽기)"
            min="0"
            disabled={loading}
          />

          {error && (
            <div className="text-red-600 text-sm bg-red-50 p-3 rounded-lg">
              {error}
            </div>
          )}

          <div className="flex space-x-4">
            <Button
              type="submit"
              disabled={loading}
              className="flex-1"
            >
              {loading ? '등록 중...' : '책 추가하기'}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => router.back()}
              disabled={loading}
            >
              취소
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}

