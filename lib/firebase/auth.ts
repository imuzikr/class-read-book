import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
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

// Google 로그인
export const signInWithGoogle = async (): Promise<UserCredential> => {
  checkAuth();
  const provider = new GoogleAuthProvider();
  return signInWithPopup(auth!, provider);
};

// 현재 사용자 가져오기
export const getCurrentUser = (): User | null => {
  return auth?.currentUser || null;
};

