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

// Google 로그인 (팝업 방식 - 팝업이 차단되면 자동으로 리다이렉트 방식으로 전환)
export const signInWithGoogle = async (): Promise<UserCredential> => {
  checkAuth();
  const provider = new GoogleAuthProvider();
  
  try {
    // 먼저 팝업 방식 시도
    return await signInWithPopup(auth!, provider);
  } catch (error: any) {
    // 팝업이 차단된 경우 리다이렉트 방식으로 전환
    if (error.code === 'auth/popup-blocked' || error.code === 'auth/popup-closed-by-user') {
      await signInWithRedirect(auth!, provider);
      // 리다이렉트는 페이지 이동이 발생하므로 여기서는 에러를 throw하지 않음
      // 대신 로그인 페이지에서 리다이렉트 결과를 처리해야 함
      throw new Error('REDIRECT_INITIATED');
    }
    throw error;
  }
};

// 리다이렉트 결과 확인 (로그인 후 리다이렉트된 페이지에서 호출)
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
