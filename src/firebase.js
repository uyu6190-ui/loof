import { getApp, getApps, initializeApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInAnonymously,
  signInWithPopup,
  signOut,
} from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Firebase の Web 設定値は公開して利用する識別子です。アクセスの保護は
// Firestore Security Rules と Firebase Authentication で行います。
const firebaseConfig = {
  apiKey: "AIzaSyC7pDhyPi0Gfc_BBKjsFbLRZXELbYs5X1g",
  authDomain: "myposts-64092.firebaseapp.com",
  projectId: "myposts-64092",
  storageBucket: "myposts-64092.firebasestorage.app",
  messagingSenderId: "799369413079",
  appId: "1:799369413079:web:e1b0c89f528c566a5c8b92",
  measurementId: "G-SR298KXMJB"
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// 認証SDKがネットワーク待ちになってもアプリ全体を停止させない。
const initialAuthState = new Promise((resolve) => {
  let settled = false;
  let unsubscribe;
  let timer;
  const finish = (user) => {
    if (settled) return;
    settled = true;
    clearTimeout(timer);
    unsubscribe?.();
    resolve(user);
  };
  timer = setTimeout(() => finish(auth.currentUser), 4_000);
  unsubscribe = onAuthStateChanged(auth, finish);
  if (settled) {
    clearTimeout(timer);
    unsubscribe();
  }
});

function withTimeout(promise, milliseconds = 8_000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Firebase authentication timed out")), milliseconds);
    promise.then(
      (value) => { clearTimeout(timer); resolve(value); },
      (error) => { clearTimeout(timer); reject(error); },
    );
  });
}

let signInPromise;

export async function getFirebaseUser() {
  await initialAuthState;
  if (auth.currentUser) return auth.currentUser;

  if (!signInPromise) {
    signInPromise = withTimeout(signInAnonymously(auth))
      .then(({ user }) => user)
      .finally(() => { signInPromise = undefined; });
  }

  return signInPromise;
}

export function subscribeToFirebaseUser(callback) {
  return onAuthStateChanged(auth, callback);
}

export function isGoogleUser(user) {
  return !!user?.providerData?.some((provider) => provider.providerId === "google.com");
}

export function signInWithGoogle() {
  const provider = new GoogleAuthProvider();
  auth.useDeviceLanguage();
  const currentUser = auth.currentUser;

  // ボタン操作の同期中にポップアップを開く。事前に認証状態を await すると
  // モバイルSafariがポップアップをブロックすることがある。
  // ゲストのデータは Google アカウントへ移行せず、ログイン後はGoogle側の記録だけを使う。
  return signInWithPopup(auth, provider)
    .then(({ user }) => ({ user, switchedUser: user.uid !== currentUser?.uid }));
}

export async function signOutFirebaseUser() {
  await signOut(auth);
  return getFirebaseUser();
}
