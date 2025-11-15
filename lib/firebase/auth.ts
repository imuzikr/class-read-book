import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  GoogleAuthProvider,
  signOut,
  sendPasswordResetEmail,
  updateProfile,
  User,
  UserCredential,
} from 'firebase/auth';
import { auth } from './config';

// Firebase가 설정되어 있는지 확인
const checkAuth = () => {
  if (!auth) {
    throw new Error('Firebase가 설정되지 않았습니다. .env.local 파일에 Firebase 설정을 추가해주세요.');
  }
};

// 회원가입
export const signUp = async (
  email: string,
  password: string,
  displayName?: string
): Promise<UserCredential> => {
  checkAuth();
  const userCredential = await createUserWithEmailAndPassword(auth!, email, password);
  
  if (displayName && userCredential.user) {
    await updateProfile(userCredential.user, { displayName });
  }
  
  return userCredential;
};

// 로그인
export const signIn = async (
  email: string,
  password: string
): Promise<UserCredential> => {
  checkAuth();
  return signInWithEmailAndPassword(auth!, email, password);
};

// 로그아웃
export const logout = async (): Promise<void> => {
  checkAuth();
  return signOut(auth!);
};

// 비밀번호 재설정
export const resetPassword = async (email: string): Promise<void> => {
  checkAuth();
  return sendPasswordResetEmail(auth!, email);
};

// Google 로그인 (리다이렉트 방식 사용 - COOP 경고 방지)
export const signInWithGoogle = async (): Promise<UserCredential | null> => {
  checkAuth();
  const provider = new GoogleAuthProvider();
  // 리다이렉트 방식 사용 (팝업 대신 전체 페이지 리다이렉트)
  await signInWithRedirect(auth!, provider);
  // 리다이렉트는 비동기로 완료되므로 null 반환
  // 실제 결과는 getRedirectResult로 확인해야 함
  return null;
};

// 리다이렉트 결과 확인
export const getGoogleRedirectResult = async (): Promise<UserCredential | null> => {
  checkAuth();
  try {
    const result = await getRedirectResult(auth!);
    return result;
  } catch (error) {
    console.error('리다이렉트 결과 확인 실패:', error);
    return null;
  }
};

// 현재 사용자 가져오기
export const getCurrentUser = (): User | null => {
  return auth?.currentUser || null;
};

