import { getApp, getApps, initializeApp } from "firebase/app";
import {
  getAuth,
  getRedirectResult,
  GoogleAuthProvider,
  linkWithRedirect,
  linkWithPopup,
  onAuthStateChanged,
  signInAnonymously,
  signInWithRedirect,
  signInWithPopup,
  signOut,
} from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Firebase の Web 設定値は公開して利用する識別子です。アクセスの保護は
// Firestore Security Rules と Firebase Authentication で行います。
const firebaseConfig = {
  apiKey: "AIzaSyC7pDhyPi0Gfc_BBKjsFbLRZXELbYs5X1g",
  // Vercel 側で /__/auth と /__/firebase を Firebase Hosting へリバースプロキシする。
  // 認証ヘルパーをアプリと同じオリジンに置くことで、モバイルSafari/Chromeの
  // サードパーティストレージ制限下でも redirect ログインを維持できる。
  authDomain: "loof-tau.vercel.app",
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
const GOOGLE_REDIRECT_FLOW = "loof.google-redirect-flow";

function shouldUseRedirect() {
  if (typeof navigator === "undefined") return false;
  return /Android|iPhone|iPad|iPod|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

function saveRedirectFlow(flow) {
  try { window.sessionStorage.setItem(GOOGLE_REDIRECT_FLOW, flow); } catch (_) {}
}

function takeRedirectFlow() {
  try {
    const flow = window.sessionStorage.getItem(GOOGLE_REDIRECT_FLOW);
    window.sessionStorage.removeItem(GOOGLE_REDIRECT_FLOW);
    return flow;
  } catch (_) {
    return null;
  }
}

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

// 匿名アカウントへ Google をリンクすれば、Firestore の users/{uid} を移動せずに
// そのまま恒久アカウントへ昇格できる。
export async function signInWithGoogle() {
  const provider = new GoogleAuthProvider();
  auth.useDeviceLanguage();
  const currentUser = await getFirebaseUser();

  // Firebase はモバイルWebではリダイレクト方式を推奨している。ポップアップが
  // ブロックされるSafari/Chromeでも、この方式ならログインできる。
  if (shouldUseRedirect()) {
    if (currentUser.isAnonymous) {
      saveRedirectFlow("link");
      await linkWithRedirect(currentUser, provider);
    } else {
      saveRedirectFlow("sign-in");
      await signInWithRedirect(auth, provider);
    }
    return { redirecting: true };
  }

  if (currentUser.isAnonymous) {
    try {
      const result = await linkWithPopup(currentUser, provider);
      return { user: result.user, switchedUser: false };
    } catch (error) {
      // すでに別の端末で使われている Google アカウントなら、その既存アカウントで入る。
      if (error.code !== "auth/credential-already-in-use") throw error;
    }
  }

  const previousUid = auth.currentUser?.uid;
  const result = await signInWithPopup(auth, provider);
  return { user: result.user, switchedUser: result.user.uid !== previousUid };
}

// リダイレクトでアプリへ戻った直後に必ず呼び出す。すでに使われているGoogle
// アカウントだった場合は、リンクではなく通常ログインへ自動的に切り替える。
export async function getGoogleRedirectResult() {
  try {
    const result = await getRedirectResult(auth);
    takeRedirectFlow();
    return result ? { user: result.user } : null;
  } catch (error) {
    const flow = takeRedirectFlow();
    if (flow === "link" && error.code === "auth/credential-already-in-use") {
      saveRedirectFlow("sign-in");
      await signInWithRedirect(auth, new GoogleAuthProvider());
      return { redirecting: true };
    }
    throw error;
  }
}

export async function signOutFirebaseUser() {
  await signOut(auth);
  return getFirebaseUser();
}
