import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth, onAuthStateChanged, signInAnonymously } from "firebase/auth";
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

const initialAuthState = new Promise((resolve) => {
  const unsubscribe = onAuthStateChanged(auth, (user) => {
    unsubscribe();
    resolve(user);
  });
});

let signInPromise;

export async function getFirebaseUser() {
  const currentUser = await initialAuthState;
  if (currentUser) return currentUser;

  if (!signInPromise) {
    signInPromise = signInAnonymously(auth)
      .then(({ user }) => user)
      .catch((error) => {
        signInPromise = undefined;
        throw error;
      });
  }

  return signInPromise;
}
