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
  runTransaction,
} from 'firebase/firestore';
import { db } from './config';
import { User, Book, ReadingLog, Review } from '@/types';
import { calculateExpGain, getLevelFromExp } from '@/lib/utils/game';

// Helper to convert Firestore Timestamp to Date
const toDate = (timestamp: any): Date => {
  if (timestamp instanceof Timestamp) {
    return timestamp.toDate();
  }
  if (timestamp instanceof Date) {
    return timestamp;
  }
  return new Date(); // Fallback
};

// --- Converters ---

const convertUser = (docSnap: QueryDocumentSnapshot | DocumentData, id?: string): User => {
  const data = docSnap.data ? docSnap.data() : docSnap;
  const docId = id || (docSnap.id as string);
  
  return {
    id: docId,
    email: data.email || '',
    name: data.name || '',
    displayName: data.displayName || data.name || '',
    photoURL: data.photoURL || '',
    level: data.level || 1,
    exp: data.exp || 0,
    totalPagesRead: data.totalPagesRead || 0,
    totalBooksRead: data.totalBooksRead || 0,
    currentStreak: data.currentStreak || 0,
    longestStreak: data.longestStreak || 0,
    lastReadingDate: data.lastReadingDate ? toDate(data.lastReadingDate) : undefined,
    createdAt: data.createdAt ? toDate(data.createdAt) : new Date(),
    updatedAt: data.updatedAt ? toDate(data.updatedAt) : new Date(),
    isAnonymous: data.isAnonymous || false,
    nickname: data.nickname,
    useNickname: data.useNickname,
    showTodayThought: data.showTodayThought,
    character: data.character,
  };
};

const convertBook = (docSnap: QueryDocumentSnapshot | DocumentData, id?: string): Book => {
  const data = docSnap.data ? docSnap.data() : docSnap;
  const docId = id || (docSnap.id as string);

  return {
    id: docId,
    userId: data.userId,
    title: data.title,
    author: data.author,
    totalPages: data.totalPages,
    currentPage: data.currentPage,
    startDate: data.startDate ? toDate(data.startDate) : new Date(),
    finishDate: data.finishDate ? toDate(data.finishDate) : undefined,
    status: data.status,
    coverImage: data.coverImage,
    createdAt: data.createdAt ? toDate(data.createdAt) : new Date(),
    updatedAt: data.updatedAt ? toDate(data.updatedAt) : new Date(),
  };
};

const convertReadingLog = (docSnap: QueryDocumentSnapshot | DocumentData, id?: string): ReadingLog => {
  const data = docSnap.data ? docSnap.data() : docSnap;
  const docId = id || (docSnap.id as string);

  return {
    id: docId,
    userId: data.userId,
    bookId: data.bookId,
    date: data.date ? toDate(data.date) : new Date(),
    pagesRead: data.pagesRead,
    startPage: data.startPage,
    endPage: data.endPage,
    notes: data.notes,
    isPublic: data.isPublic,
    expGained: data.expGained,
    createdAt: data.createdAt ? toDate(data.createdAt) : new Date(),
  };
};

const convertReview = (docSnap: QueryDocumentSnapshot | DocumentData, id?: string): Review => {
  const data = docSnap.data ? docSnap.data() : docSnap;
  const docId = id || (docSnap.id as string);

  return {
    id: docId,
    userId: data.userId,
    bookId: data.bookId,
    content: data.content,
    rating: data.rating,
    createdAt: data.createdAt ? toDate(data.createdAt) : new Date(),
    updatedAt: data.updatedAt ? toDate(data.updatedAt) : new Date(),
  };
};

// --- CRUD Operations ---

// 사용자 데이터 CRUD
export const getUserData = async (userId: string): Promise<User | null> => {
  if (!db) {
    throw new Error('Firebase가 설정되지 않았습니다.');
  }
  const docRef = doc(db, 'users', userId);
  const docSnap = await getDoc(docRef);
  
  if (docSnap.exists()) {
    return convertUser(docSnap);
  }
  return null;
};

export const createUserData = async (userId: string, userData: Partial<User>): Promise<void> => {
  if (!db) {
    throw new Error('Firebase가 설정되지 않았습니다.');
  }
  const docRef = doc(db, 'users', userId);
  const now = Timestamp.now();
  
  // undefined 제거 및 필요한 필만 저장
  const dataToSave: any = {
    ...userData,
    createdAt: now,
    updatedAt: now,
  };
  
  // id 필드는 문서 데이터에 저장하지 않음 (문서 ID로 사용됨)
  delete dataToSave.id;

  await setDoc(docRef, dataToSave);
};

export const updateUserData = async (userId: string, updates: Partial<User>): Promise<void> => {
  if (!db) {
    throw new Error('Firebase가 설정되지 않았습니다.');
  }
  const docRef = doc(db, 'users', userId);
  
  const updatesToSave: any = { ...updates };
  delete updatesToSave.id; // ID는 업데이트하지 않음
  updatesToSave.updatedAt = Timestamp.now();
  
  if (updatesToSave.lastReadingDate instanceof Date) {
    updatesToSave.lastReadingDate = Timestamp.fromDate(updatesToSave.lastReadingDate);
  }

  await updateDoc(docRef, updatesToSave);
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
  
  const books = querySnapshot.docs.map((doc) => convertBook(doc));
  
  // 중복 제거: 같은 제목과 저자를 가진 책 중 가장 최근 것만 유지
  const uniqueBooks = new Map<string, Book>();
  
  for (const book of books) {
    const key = `${book.title.trim().toLowerCase()}_${book.author.trim().toLowerCase()}`;
    const existing = uniqueBooks.get(key);
    
    // createdAt은 Date 타입이므로 getTime() 사용
    if (!existing || (book.createdAt.getTime() > existing.createdAt.getTime())) {
      uniqueBooks.set(key, book);
    }
  }
  
  return Array.from(uniqueBooks.values());
};

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
  if (!db) {
    throw new Error('Firebase가 설정되지 않았습니다.');
  }
  const docRef = doc(db, 'books', bookId);
  const docSnap = await getDoc(docRef);
  
  if (docSnap.exists()) {
    return convertBook(docSnap);
  }
  return null;
};

export const createBook = async (book: Omit<Book, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> => {
  if (!db) {
    throw new Error('Firebase가 설정되지 않았습니다.');
  }
  const now = Timestamp.now();
  
  const bookData: any = {
    ...book,
    createdAt: now,
    updatedAt: now,
  };

  // Date 객체를 Timestamp로 변환
  if (bookData.startDate instanceof Date) bookData.startDate = Timestamp.fromDate(bookData.startDate);
  if (bookData.finishDate instanceof Date) bookData.finishDate = Timestamp.fromDate(bookData.finishDate);

  const docRef = await addDoc(collection(db, 'books'), bookData);
  return docRef.id;
};

export const updateBook = async (bookId: string, updates: Partial<Book>): Promise<void> => {
  if (!db) {
    throw new Error('Firebase가 설정되지 않았습니다.');
  }
  
  const docRef = doc(db, 'books', bookId);
  
  const cleanUpdates: any = {
    updatedAt: Timestamp.now(),
  };
  
  for (const [key, value] of Object.entries(updates)) {
    if (value !== undefined && key !== 'id') {
      if (value instanceof Date) {
        cleanUpdates[key] = Timestamp.fromDate(value);
      } else {
        cleanUpdates[key] = value;
      }
    }
  }
  
  await updateDoc(docRef, cleanUpdates);
};

export const deleteBook = async (bookId: string): Promise<void> => {
  if (!db) {
    throw new Error('Firebase가 설정되지 않았습니다.');
  }
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
    const q = query(
      collection(db, 'readingLogs'),
      where('bookId', '==', bookId),
      where('userId', '==', userId)
    );
    querySnapshot = await getDocs(q);
  } else {
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
  
  let logs = querySnapshot.docs.map((doc) => convertReadingLog(doc));
  
  if (bookId) {
    logs.sort((a, b) => b.date.getTime() - a.date.getTime());
    
    if (limitCount) {
      logs = logs.slice(0, limitCount);
    }
  }
  
  return logs;
};

export const createReadingLog = async (
  log: Omit<ReadingLog, 'id' | 'createdAt'>
): Promise<string> => {
  if (!db) {
    throw new Error('Firebase가 설정되지 않았습니다.');
  }
  
  const logData: any = {
    ...log,
    createdAt: Timestamp.now(),
  };
  
  if (logData.date instanceof Date) {
    logData.date = Timestamp.fromDate(logData.date);
  }

  const docRef = await addDoc(collection(db, 'readingLogs'), logData);
  return docRef.id;
};

export const deleteReadingLog = async (logId: string): Promise<void> => {
if (!db) {
    throw new Error('Firebase가 설정되지 않았습니다.');
  }
  const firestore = db;

  await runTransaction(firestore, async (transaction) => {
    // 1. 로그 데이터 가져오기
    const logRef = doc(firestore, 'readingLogs', logId);
    const logSnap = await transaction.get(logRef);
    if (!logSnap.exists()) {
      throw new Error('독서 기록을 찾을 수 없습니다.');
    }
    const logData = convertReadingLog(logSnap);

    // 2. 사용자 및 책 데이터 가져오기
    const userRef = doc(firestore, 'users', logData.userId);
    const bookRef = doc(firestore, 'books', logData.bookId);
    const [userSnap, bookSnap] = await Promise.all([
      transaction.get(userRef),
      transaction.get(bookRef)
    ]);

    if (!userSnap.exists() || !bookSnap.exists()) {
      throw new Error('관련 데이터를 찾을 수 없습니다.');
    }

    const userData = convertUser(userSnap);
    const bookData = convertBook(bookSnap);

    // 3. 사용자 데이터 업데이트 (경험치, 총 페이지 수 감소)
    const newExp = Math.max(0, userData.exp - logData.expGained);
    const newLevel = getLevelFromExp(newExp);
    const newTotalPagesRead = Math.max(0, userData.totalPagesRead - logData.pagesRead);

    transaction.update(userRef, {
      exp: newExp,
      level: newLevel,
      totalPagesRead: newTotalPagesRead,
      updatedAt: Timestamp.now()
    });

    // 4. 책 데이터 업데이트 (현재 페이지 롤백)
    let newCurrentPage = bookData.currentPage;
    let newStatus = bookData.status;
    let newFinishDate = bookData.finishDate;
    let newTotalBooksRead = userData.totalBooksRead;

    if (logData.endPage && logData.endPage === bookData.currentPage) {
        newCurrentPage = Math.max(0, (logData.startPage || 1) - 1);
        
        // 만약 완독 상태였다면, 다시 읽는 중으로 변경
        if (bookData.status === 'completed') {
            newStatus = 'reading';
            newFinishDate = undefined; 
            // 완독 횟수 감소 (사용자 데이터)
            newTotalBooksRead = Math.max(0, userData.totalBooksRead - 1);
            
            // 사용자 데이터에 완독 횟수 감소 반영
            transaction.update(userRef, {
                totalBooksRead: newTotalBooksRead
            });
        }
    }

    // 책 업데이트
    const bookUpdates: any = {
        currentPage: newCurrentPage,
        status: newStatus,
        updatedAt: Timestamp.now()
    };
    
    if (newFinishDate === undefined && bookData.finishDate) {
        bookUpdates.finishDate = null; 
    }

    transaction.update(bookRef, bookUpdates);

    // 5. 로그 삭제
    transaction.delete(logRef);
  });
};

export const updateReadingLog = async (logId: string, updates: Partial<ReadingLog>): Promise<void> => {
    if (!db) {
        throw new Error('Firebase가 설정되지 않았습니다.');
    }
    const firestore = db;

    await runTransaction(firestore, async (transaction) => {
        const logRef = doc(firestore, 'readingLogs', logId);
        const logSnap = await transaction.get(logRef);
        if (!logSnap.exists()) {
            throw new Error('독서 기록을 찾을 수 없습니다.');
        }
        const oldLog = convertReadingLog(logSnap);
        
        if (updates.notes !== undefined && !updates.startPage && !updates.endPage) {
            transaction.update(logRef, { notes: updates.notes });
            return;
        }

        transaction.update(logRef, { 
            notes: updates.notes,
            ...(updates.isPublic !== undefined ? { isPublic: updates.isPublic } : {})
        });
    });
};

// --- Missing Functions Restored ---

// 감상문 CRUD
export const getReviews = async (userId: string): Promise<Review[]> => {
  if (!db) {
    throw new Error('Firebase가 설정되지 않았습니다.');
  }
  const q = query(
    collection(db, 'reviews'),
    where('userId', '==', userId),
    orderBy('createdAt', 'desc')
  );
  const querySnapshot = await getDocs(q);
  
  return querySnapshot.docs.map((doc) => convertReview(doc));
};

export const getReview = async (reviewId: string): Promise<Review | null> => {
  if (!db) {
    throw new Error('Firebase가 설정되지 않았습니다.');
  }
  const docRef = doc(db, 'reviews', reviewId);
  const docSnap = await getDoc(docRef);
  
  if (docSnap.exists()) {
    return convertReview(docSnap);
  }
  return null;
};

export const createReview = async (
  review: Omit<Review, 'id' | 'createdAt' | 'updatedAt'>
): Promise<string> => {
  if (!db) {
    throw new Error('Firebase가 설정되지 않았습니다.');
  }
  const now = Timestamp.now();
  const reviewData: any = {
    ...review,
    createdAt: now,
    updatedAt: now,
  };
  
  const docRef = await addDoc(collection(db, 'reviews'), reviewData);
  return docRef.id;
};

export const updateReview = async (reviewId: string, updates: Partial<Review>): Promise<void> => {
  if (!db) {
    throw new Error('Firebase가 설정되지 않았습니다.');
  }
  const docRef = doc(db, 'reviews', reviewId);
  
  const updatesToSave: any = { ...updates };
  delete updatesToSave.id;
  updatesToSave.updatedAt = Timestamp.now();
  
  await updateDoc(docRef, updatesToSave);
};

export const deleteReview = async (reviewId: string): Promise<void> => {
  if (!db) {
    throw new Error('Firebase가 설정되지 않았습니다.');
  }
  const docRef = doc(db, 'reviews', reviewId);
  await deleteDoc(docRef);
};

// 사용자 뱃지 CRUD
export const getUserBadges = async (userId: string): Promise<string[]> => {
  if (!db) {
    throw new Error('Firebase가 설정되지 않았습니다.');
  }
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

// 사용자 데이터 완전 삭제 (탈퇴)
export const deleteUserData = async (userId: string): Promise<void> => {
  if (!db) {
    throw new Error('Firebase가 설정되지 않았습니다.');
  }

  try {
    const booksQuery = query(collection(db, 'books'), where('userId', '==', userId));
    const booksSnapshot = await getDocs(booksQuery);
    await Promise.all(booksSnapshot.docs.map((doc) => deleteDoc(doc.ref)));

    const logsQuery = query(collection(db, 'readingLogs'), where('userId', '==', userId));
    const logsSnapshot = await getDocs(logsQuery);
    await Promise.all(logsSnapshot.docs.map((doc) => deleteDoc(doc.ref)));

    const reviewsQuery = query(collection(db, 'reviews'), where('userId', '==', userId));
    const reviewsSnapshot = await getDocs(reviewsQuery);
    await Promise.all(reviewsSnapshot.docs.map((doc) => deleteDoc(doc.ref)));

    const badgesQuery = query(collection(db, 'userBadges'), where('userId', '==', userId));
    const badgesSnapshot = await getDocs(badgesQuery);
    await Promise.all(badgesSnapshot.docs.map((doc) => deleteDoc(doc.ref)));

    const userDocRef = doc(db, 'users', userId);
    await deleteDoc(userDocRef);
  } catch (error) {
    console.error('사용자 데이터 삭제 실패:', error);
    throw new Error('사용자 데이터 삭제에 실패했습니다.');
  }
};

// 관리자 확인 함수
export const isAdmin = async (userId: string): Promise<boolean> => {
  if (!db) return false;
  try {
    const adminDoc = doc(db, 'admins', userId);
    const adminSnap = await getDoc(adminDoc);
    return adminSnap.exists();
  } catch (error) {
    console.error('관리자 확인 실패:', error);
    return false;
  }
};

export const isAdminByEmail = async (email: string): Promise<boolean> => {
  if (!db) return false;
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

// 관리자용: 모든 책 가져오기
export const getAllBooks = async (limitCount: number = 100): Promise<Book[]> => {
  if (!db) {
    throw new Error('Firebase가 설정되지 않았습니다.');
  }
  
  const q = query(
    collection(db, 'books'),
    orderBy('createdAt', 'desc'),
    limit(limitCount * 3)
  );
  
  const querySnapshot = await getDocs(q);
  const books = querySnapshot.docs.map((doc) => convertBook(doc));
  
  const uniqueBooks = new Map<string, Book>();
  
  for (const book of books) {
    const key = `${book.userId}_${book.title.trim().toLowerCase()}_${book.author.trim().toLowerCase()}`;
    const existing = uniqueBooks.get(key);
    
    if (!existing) {
      uniqueBooks.set(key, book);
    } else {
      const bookTime = book.updatedAt.getTime();
      const existingTime = existing.updatedAt.getTime();
      
      if (bookTime > existingTime) {
        uniqueBooks.set(key, book);
      }
    }
  }
  
  return Array.from(uniqueBooks.values())
    .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
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
  const books = querySnapshot.docs.map((doc) => convertBook(doc));
  
  const uniqueBooks = new Map<string, Book>();
  
  for (const book of books) {
    const key = book.userId;
    const existing = uniqueBooks.get(key);
    
    if (!existing || (book.createdAt.getTime() > existing.createdAt.getTime())) {
      uniqueBooks.set(key, book);
    }
  }
  
  return Array.from(uniqueBooks.values());
};

// 관리자용: 모든 사용자 가져오기
export const getAllUsersAdmin = async (limitCount: number = 100): Promise<User[]> => {
  if (!db) {
    throw new Error('Firebase가 설정되지 않았습니다.');
  }
  
  const q = query(
    collection(db, 'users'),
    orderBy('createdAt', 'desc'),
    limit(limitCount * 2)
  );
  
  const querySnapshot = await getDocs(q);
  const allUsers = querySnapshot.docs.map((doc) => convertUser(doc));
  
  const filteredUsers: User[] = [];
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
  return querySnapshot.docs.map((doc) => convertReadingLog(doc));
};

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
  return querySnapshot.docs.map((doc) => convertReview(doc));
};
