import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
  QueryConstraint,
  DocumentData,
  QueryDocumentSnapshot,
} from 'firebase/firestore';
import { db } from './config';

// 타입 정의
export interface UserData {
  email: string;
  name: string;
  displayName?: string;
  photoURL?: string;
  level: number;
  exp: number;
  totalPagesRead: number;
  totalBooksRead: number;
  currentStreak: number;
  longestStreak: number;
  lastReadingDate?: Timestamp;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  isAnonymous: boolean;
  // 캐릭터 정보
  character?: {
    animalType: string;
    outfitColor: string;
    outfitDesign: string;
  };
}

export interface Book {
  id?: string;
  userId: string;
  title: string;
  author: string;
  totalPages: number;
  currentPage: number;
  startDate: Timestamp;
  finishDate?: Timestamp;
  status: 'reading' | 'completed' | 'paused';
  coverImage?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface ReadingLog {
  id?: string;
  userId: string;
  bookId: string;
  date: Timestamp;
  pagesRead: number; // 읽은 총 페이지 수 (계산된 값)
  startPage?: number; // 시작 페이지 (선택사항, 호환성 유지)
  endPage?: number; // 마지막 페이지 (선택사항, 호환성 유지)
  notes?: string;
  expGained: number;
  createdAt: Timestamp;
}

export interface Review {
  id?: string;
  userId: string;
  bookId: string;
  content: string;
  rating: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// 사용자 데이터 CRUD
export const getUserData = async (userId: string): Promise<UserData | null> => {
  const docRef = doc(db, 'users', userId);
  const docSnap = await getDoc(docRef);
  
  if (docSnap.exists()) {
    return docSnap.data() as UserData;
  }
  return null;
};

export const createUserData = async (userId: string, userData: Partial<UserData>): Promise<void> => {
  const docRef = doc(db, 'users', userId);
  const now = Timestamp.now();
  
  await setDoc(docRef, {
    email: userData.email || '',
    name: userData.name || '',
    displayName: userData.displayName || userData.name || '',
    photoURL: userData.photoURL || '',
    level: userData.level || 1,
    exp: userData.exp || 0,
    totalPagesRead: userData.totalPagesRead || 0,
    totalBooksRead: userData.totalBooksRead || 0,
    currentStreak: userData.currentStreak || 0,
    longestStreak: userData.longestStreak || 0,
    isAnonymous: userData.isAnonymous || false,
    character: userData.character || null,
    createdAt: now,
    updatedAt: now,
  });
};

export const updateUserData = async (userId: string, updates: Partial<UserData>): Promise<void> => {
  const docRef = doc(db, 'users', userId);
  await updateDoc(docRef, {
    ...updates,
    updatedAt: Timestamp.now(),
  });
};

// 책 CRUD
export const getBooks = async (
  userId: string,
  status?: Book['status']
): Promise<Book[]> => {
  if (!db) {
    throw new Error('Firebase가 설정되지 않았습니다.');
  }
  
  const constraints: QueryConstraint[] = [where('userId', '==', userId)];
  
  if (status) {
    constraints.push(where('status', '==', status));
  }
  
  constraints.push(orderBy('createdAt', 'desc'));
  
  const q = query(collection(db, 'books'), ...constraints);
  const querySnapshot = await getDocs(q);
  
  const books = querySnapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as Book[];
  
  // 중복 제거: 같은 제목과 저자를 가진 책 중 가장 최근 것만 유지
  const uniqueBooks = new Map<string, Book>();
  
  for (const book of books) {
    const key = `${book.title.trim().toLowerCase()}_${book.author.trim().toLowerCase()}`;
    const existing = uniqueBooks.get(key);
    
    if (!existing || (book.createdAt && existing.createdAt && 
        book.createdAt.toMillis() > existing.createdAt.toMillis())) {
      uniqueBooks.set(key, book);
    }
  }
  
  return Array.from(uniqueBooks.values());
};

/**
 * 같은 제목과 저자의 책이 이미 존재하는지 확인
 */
export const checkDuplicateBook = async (
  userId: string,
  title: string,
  author: string
): Promise<boolean> => {
  if (!db) {
    throw new Error('Firebase가 설정되지 않았습니다.');
  }
  
  const q = query(
    collection(db, 'books'),
    where('userId', '==', userId),
    where('title', '==', title.trim()),
    where('author', '==', author.trim())
  );
  
  const querySnapshot = await getDocs(q);
  return querySnapshot.size > 0;
};

export const getBook = async (bookId: string): Promise<Book | null> => {
  const docRef = doc(db, 'books', bookId);
  const docSnap = await getDoc(docRef);
  
  if (docSnap.exists()) {
    return { id: docSnap.id, ...docSnap.data() } as Book;
  }
  return null;
};

export const createBook = async (book: Omit<Book, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> => {
  const now = Timestamp.now();
  const docRef = await addDoc(collection(db, 'books'), {
    ...book,
    createdAt: now,
    updatedAt: now,
  });
  return docRef.id;
};

export const updateBook = async (bookId: string, updates: Partial<Book>): Promise<void> => {
  if (!db) {
    throw new Error('Firebase가 설정되지 않았습니다.');
  }
  
  const docRef = doc(db, 'books', bookId);
  
  // undefined 값을 제거한 업데이트 객체 생성
  const cleanUpdates: any = {
    updatedAt: Timestamp.now(),
  };
  
  for (const [key, value] of Object.entries(updates)) {
    if (value !== undefined) {
      cleanUpdates[key] = value;
    }
  }
  
  await updateDoc(docRef, cleanUpdates);
};

export const deleteBook = async (bookId: string): Promise<void> => {
  const docRef = doc(db, 'books', bookId);
  await deleteDoc(docRef);
};

// 독서 기록 CRUD
export const getReadingLogs = async (
  userId: string,
  bookId?: string,
  limitCount?: number
): Promise<ReadingLog[]> => {
  if (!db) {
    throw new Error('Firebase가 설정되지 않았습니다.');
  }
  
  let querySnapshot;
  
  if (bookId) {
    // bookId가 있을 때: bookId와 userId로 필터링하고, 클라이언트 측에서 정렬
    const q = query(
      collection(db, 'readingLogs'),
      where('bookId', '==', bookId),
      where('userId', '==', userId)
    );
    querySnapshot = await getDocs(q);
  } else {
    // bookId가 없을 때: userId로 필터링하고 date로 정렬 (기존 인덱스 사용)
    const constraints: QueryConstraint[] = [
      where('userId', '==', userId),
      orderBy('date', 'desc')
    ];
    
    if (limitCount) {
      constraints.push(limit(limitCount));
    }
    
    const q = query(collection(db, 'readingLogs'), ...constraints);
    querySnapshot = await getDocs(q);
  }
  
  let logs = querySnapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as ReadingLog[];
  
  // bookId가 있을 때 클라이언트 측에서 날짜순 정렬
  if (bookId) {
    logs.sort((a, b) => {
      const aTime = a.date.toMillis();
      const bTime = b.date.toMillis();
      return bTime - aTime; // 내림차순
    });
    
    // limitCount가 있으면 제한
    if (limitCount) {
      logs = logs.slice(0, limitCount);
    }
  }
  
  return logs;
};

export const createReadingLog = async (
  log: Omit<ReadingLog, 'id' | 'createdAt'>
): Promise<string> => {
  const docRef = await addDoc(collection(db, 'readingLogs'), {
    ...log,
    createdAt: Timestamp.now(),
  });
  return docRef.id;
};

// 감상문 CRUD
export const getReviews = async (userId: string): Promise<Review[]> => {
  const q = query(
    collection(db, 'reviews'),
    where('userId', '==', userId),
    orderBy('createdAt', 'desc')
  );
  const querySnapshot = await getDocs(q);
  
  return querySnapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as Review[];
};

export const getReview = async (reviewId: string): Promise<Review | null> => {
  const docRef = doc(db, 'reviews', reviewId);
  const docSnap = await getDoc(docRef);
  
  if (docSnap.exists()) {
    return { id: docSnap.id, ...docSnap.data() } as Review;
  }
  return null;
};

export const createReview = async (
  review: Omit<Review, 'id' | 'createdAt' | 'updatedAt'>
): Promise<string> => {
  const now = Timestamp.now();
  const docRef = await addDoc(collection(db, 'reviews'), {
    ...review,
    createdAt: now,
    updatedAt: now,
  });
  return docRef.id;
};

export const updateReview = async (reviewId: string, updates: Partial<Review>): Promise<void> => {
  const docRef = doc(db, 'reviews', reviewId);
  await updateDoc(docRef, {
    ...updates,
    updatedAt: Timestamp.now(),
  });
};

export const deleteReview = async (reviewId: string): Promise<void> => {
  const docRef = doc(db, 'reviews', reviewId);
  await deleteDoc(docRef);
};

// 사용자 뱃지 CRUD
export const getUserBadges = async (userId: string): Promise<string[]> => {
  const q = query(
    collection(db, 'userBadges'),
    where('userId', '==', userId)
  );
  const querySnapshot = await getDocs(q);
  
  return querySnapshot.docs.map((doc) => doc.data().badgeId);
};

export const hasBadge = async (userId: string, badgeId: string): Promise<boolean> => {
  const badges = await getUserBadges(userId);
  return badges.includes(badgeId);
};

// 관리자 확인 함수
export const isAdmin = async (userId: string): Promise<boolean> => {
  if (!db) {
    return false;
  }
  
  try {
    const adminDoc = doc(db, 'admins', userId);
    const adminSnap = await getDoc(adminDoc);
    return adminSnap.exists();
  } catch (error) {
    console.error('관리자 확인 실패:', error);
    return false;
  }
};

// 이메일로 관리자 확인 (로그인 시 사용)
export const isAdminByEmail = async (email: string): Promise<boolean> => {
  if (!db) {
    return false;
  }
  
  try {
    const q = query(
      collection(db, 'admins'),
      where('email', '==', email.toLowerCase().trim())
    );
    const querySnapshot = await getDocs(q);
    return !querySnapshot.empty;
  } catch (error) {
    console.error('관리자 확인 실패:', error);
    return false;
  }
};

// 관리자용: 모든 책 가져오기 (중복 제거: 같은 사용자가 같은 책을 여러 번 등록한 경우만)
export const getAllBooks = async (limitCount: number = 100): Promise<Book[]> => {
  if (!db) {
    throw new Error('Firebase가 설정되지 않았습니다.');
  }
  
  const q = query(
    collection(db, 'books'),
    orderBy('createdAt', 'desc'),
    limit(limitCount * 3) // 충분히 많이 가져오기
  );
  
  const querySnapshot = await getDocs(q);
  const books = querySnapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as Book[];
  
  // 중복 제거: 같은 사용자가 같은 제목과 저자를 가진 책 중 가장 최근 것만 유지
  // 다른 사용자가 같은 책을 읽는 경우는 모두 유지
  const uniqueBooks = new Map<string, Book>();
  
  for (const book of books) {
    // 사용자별로 중복 제거 (같은 사용자가 같은 책을 여러 번 등록한 경우)
    const key = `${book.userId}_${book.title.trim().toLowerCase()}_${book.author.trim().toLowerCase()}`;
    const existing = uniqueBooks.get(key);
    
    if (!existing) {
      uniqueBooks.set(key, book);
    } else {
      // 기존 책과 비교: updatedAt 또는 createdAt 중 더 최근 것을 선택
      const bookTime = book.updatedAt?.toMillis() || book.createdAt?.toMillis() || 0;
      const existingTime = existing.updatedAt?.toMillis() || existing.createdAt?.toMillis() || 0;
      
      if (bookTime > existingTime) {
        uniqueBooks.set(key, book);
      }
    }
  }
  
  // 최신순으로 정렬하고 limitCount만큼만 반환 (updatedAt 우선, 없으면 createdAt 사용)
  return Array.from(uniqueBooks.values())
    .sort((a, b) => {
      const aTime = a.updatedAt?.toMillis() || a.createdAt?.toMillis() || 0;
      const bTime = b.updatedAt?.toMillis() || b.createdAt?.toMillis() || 0;
      return bTime - aTime;
    })
    .slice(0, limitCount);
};

// 관리자용: 같은 제목과 저자의 책을 읽는 모든 사용자 찾기
export const getBooksByTitleAndAuthor = async (
  title: string,
  author: string
): Promise<Book[]> => {
  if (!db) {
    throw new Error('Firebase가 설정되지 않았습니다.');
  }
  
  const q = query(
    collection(db, 'books'),
    where('title', '==', title.trim()),
    where('author', '==', author.trim())
  );
  
  const querySnapshot = await getDocs(q);
  const books = querySnapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as Book[];
  
  // 같은 사용자가 여러 번 등록한 경우 가장 최근 것만 유지
  const uniqueBooks = new Map<string, Book>();
  
  for (const book of books) {
    const key = book.userId;
    const existing = uniqueBooks.get(key);
    
    if (!existing || (book.createdAt && existing.createdAt && 
        book.createdAt.toMillis() > existing.createdAt.toMillis())) {
      uniqueBooks.set(key, book);
    }
  }
  
  return Array.from(uniqueBooks.values());
};

// 관리자용: 모든 사용자 가져오기 (관리자 제외)
export const getAllUsersAdmin = async (limitCount: number = 100): Promise<Array<UserData & { id: string }>> => {
  if (!db) {
    throw new Error('Firebase가 설정되지 않았습니다.');
  }
  
  const q = query(
    collection(db, 'users'),
    orderBy('createdAt', 'desc'),
    limit(limitCount * 2) // 관리자 필터링을 위해 더 많이 가져오기
  );
  
  const querySnapshot = await getDocs(q);
  const allUsers = querySnapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as Array<UserData & { id: string }>;
  
  // 관리자 계정 제외
  const filteredUsers: Array<UserData & { id: string }> = [];
  for (const user of allUsers) {
    const userIsAdmin = await isAdmin(user.id);
    if (!userIsAdmin) {
      filteredUsers.push(user);
    }
    if (filteredUsers.length >= limitCount) {
      break;
    }
  }
  
  return filteredUsers;
};

// 관리자용: 모든 독서 기록 가져오기
export const getAllReadingLogs = async (limitCount: number = 100): Promise<ReadingLog[]> => {
  if (!db) {
    throw new Error('Firebase가 설정되지 않았습니다.');
  }
  
  const q = query(
    collection(db, 'readingLogs'),
    orderBy('createdAt', 'desc'),
    limit(limitCount)
  );
  
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as ReadingLog[];
};

// 관리자용: 모든 리뷰 가져오기
export const getAllReviews = async (limitCount: number = 100): Promise<Review[]> => {
  if (!db) {
    throw new Error('Firebase가 설정되지 않았습니다.');
  }
  
  const q = query(
    collection(db, 'reviews'),
    orderBy('createdAt', 'desc'),
    limit(limitCount)
  );
  
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as Review[];
};

