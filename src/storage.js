import { Capacitor, registerPlugin } from "@capacitor/core";
import { collection, doc, getDoc, getDocs, setDoc, writeBatch } from "firebase/firestore";
import { db, getFirebaseUser } from "./firebase.js";

const localStorageAdapter = {
  async get(key) {
    const value = window.localStorage.getItem(key);
    return value == null ? null : { value };
  },
  async set(key, value) {
    window.localStorage.setItem(key, value);
  },
  async delete(key) {
    window.localStorage.removeItem(key);
  }
};

const LoofCloud = registerPlugin("LoofCloud");

const CHUNK_SIZE = 700_000;

function storageDocument(userId, key) {
  return doc(db, "users", userId, "storage", key);
}

async function readFirebaseValue(userId, key) {
  const target = storageDocument(userId, key);
  const metadata = await getDoc(target);
  if (!metadata.exists()) return null;

  const data = metadata.data();
  // 旧形式にも対応。将来の移行時にも既存データを失わない。
  if (typeof data.value === "string") return data.value;
  if (!data.chunkCount) return null;

  const snapshots = await getDocs(collection(target, "chunks"));
  const chunks = snapshots.docs
    .map((snapshot) => snapshot.data())
    .filter((chunk) => chunk.index < data.chunkCount)
    .sort((a, b) => a.index - b.index)
    .map((chunk) => chunk.data);
  return chunks.join("");
}

async function writeFirebaseValue(userId, key, value) {
  const target = storageDocument(userId, key);
  const chunks = [];
  for (let index = 0; index < value.length; index += CHUNK_SIZE) {
    chunks.push(value.slice(index, index + CHUNK_SIZE));
  }
  // 空の値も明示的に保存する。
  if (chunks.length === 0) chunks.push("");

  // 画像付きの記録でも Firestore の 1 MiB / ドキュメント制限を超えないよう分割する。
  for (let start = 0; start < chunks.length; start += 400) {
    const batch = writeBatch(db);
    chunks.slice(start, start + 400).forEach((data, offset) => {
      const index = start + offset;
      batch.set(doc(target, "chunks", String(index).padStart(6, "0")), { index, data });
    });
    await batch.commit();
  }

  // 以前より小さくなったデータの古いチャンクは、読み込み対象外にしつつ削除する。
  const previousChunks = await getDocs(collection(target, "chunks"));
  const stale = previousChunks.docs.filter((snapshot) => snapshot.data().index >= chunks.length);
  for (let start = 0; start < stale.length; start += 400) {
    const batch = writeBatch(db);
    stale.slice(start, start + 400).forEach((snapshot) => batch.delete(snapshot.ref));
    await batch.commit();
  }

  await setDoc(target, { chunkCount: chunks.length, updatedAt: new Date().toISOString() });
}

function createFirebaseStorageAdapter() {
  return {
    async get(key) {
      try {
        const user = await getFirebaseUser();
        const value = await readFirebaseValue(user.uid, key);
        if (value != null) return { value };

        // 初回のみ、これまで端末に保存されていた記録を Firebase へ移す。
        const local = await localStorageAdapter.get(key);
        if (local?.value != null) await writeFirebaseValue(user.uid, key, local.value);
        return local;
      } catch (_) {
        return localStorageAdapter.get(key);
      }
    },
    async set(key, value) {
      await localStorageAdapter.set(key, value);
      try {
        const user = await getFirebaseUser();
        await writeFirebaseValue(user.uid, key, value);
      } catch (_) {
        // Firebase Console の初期設定前も、アプリは端末保存で使い続けられる。
      }
    },
    async delete(key) {
      await localStorageAdapter.delete(key);
    }
  };
}

async function createNativeStorageAdapter() {
  try {
    const status = await LoofCloud.isAvailable();
    if (!status.available) return localStorageAdapter;
  } catch (_) {
    return localStorageAdapter;
  }

  return {
    async get(key) {
      try {
        const result = await LoofCloud.get({ key });
        if (result?.value == null) {
          const local = await localStorageAdapter.get(key);
          if (local?.value != null) await LoofCloud.set({ key, value: local.value });
          return local;
        }
        return { value: result.value };
      } catch (_) {
        return localStorageAdapter.get(key);
      }
    },
    async set(key, value) {
      await localStorageAdapter.set(key, value);
      try {
        await LoofCloud.set({ key, value });
      } catch (_) {}
    },
    async delete(key) {
      await localStorageAdapter.delete(key);
      try {
        await LoofCloud.delete({ key });
      } catch (_) {}
    }
  };
}

if (typeof window !== "undefined" && !window.storage) {
  const adapterPromise = Capacitor.isNativePlatform()
    ? createNativeStorageAdapter()
    : Promise.resolve(createFirebaseStorageAdapter());

  window.storage = {
    async get(key) {
      const adapter = await adapterPromise;
      return adapter.get(key);
    },
    async set(key, value) {
      const adapter = await adapterPromise;
      return adapter.set(key, value);
    },
    async delete(key) {
      const adapter = await adapterPromise;
      return adapter.delete(key);
    }
  };
}
