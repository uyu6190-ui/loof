import { Capacitor, registerPlugin } from "@capacitor/core";
import {
  addDoc, collection, deleteField, doc, getDocFromServer, getDocsFromServer,
  onSnapshot, runTransaction, serverTimestamp, setDoc, writeBatch
} from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { db, getFirebaseUser, mediaStorage } from "./firebase.js";

const DATA_KEYS = {
  "nb.accounts": "accounts",
  "nb.entries": "entries",
  "nb.collections": "collections"
};
const PREFERENCE_KEYS = new Set(["nb.current", "nb.icloud"]);
// Firestoreは1ドキュメント1MiB・1バッチ10MiBまで。複数画像でも余裕を持たせる。
const CHUNK_SIZE = 400_000;
const CHUNKS_PER_BATCH = 8;
const LoofCloud = registerPlugin("LoofCloud");
const migrations = new Map();

const localStorageAdapter = {
  async get(key) {
    const value = window.localStorage.getItem(key);
    return value == null ? null : { value };
  },
  async set(key, value) { window.localStorage.setItem(key, value); },
  async delete(key) { window.localStorage.removeItem(key); }
};

function reportSync(status, error) {
  window.dispatchEvent(new CustomEvent("loof:sync-status", {
    detail: { status, message: error?.message || "" }
  }));
}

function getClientId() {
  const key = "loof.client-id";
  let id = window.localStorage.getItem(key);
  if (!id) {
    id = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    window.localStorage.setItem(key, id);
  }
  return id;
}

function syncLog(event, detail = {}) {
  const record = { event, clientId: getClientId(), at: new Date().toISOString(), ...detail };
  console.info("[loof sync]", record);
  window.dispatchEvent(new CustomEvent("loof:sync-log", { detail: record }));
  return record;
}

// 端末をまたいで原因を追えるよう、実際の変更・拒否だけはFirestoreにも残す。
// 読み込みイベントは大量になるためConsoleのみとする。
async function writeAuditLog(userId, event, detail) {
  try {
    await addDoc(collection(db, "users", userId, "syncLogs"), {
      event, clientId: getClientId(), occurredAt: serverTimestamp(), ...detail
    });
  } catch (error) {
    console.warn("[loof sync] audit-log-failed", error);
  }
}

function stable(value) {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stable(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function collectionRef(userId, key) {
  return collection(db, "users", userId, DATA_KEYS[key]);
}

function itemRef(userId, key, id) {
  return doc(db, "users", userId, DATA_KEYS[key], id);
}

function preferenceRef(userId, key) {
  return doc(db, "users", userId, "preferences", key.replace("nb.", ""));
}

function legacyRef(userId, key) {
  return doc(db, "users", userId, "storage", key);
}

function clientUpdatedAt(value) {
  const candidate = typeof value?.updatedAt === "string" ? Date.parse(value.updatedAt) : NaN;
  return Number.isFinite(candidate) ? candidate : Date.now();
}

function imageExtension(contentType) {
  if (contentType === "image/png") return "png";
  if (contentType === "image/webp") return "webp";
  if (contentType === "image/gif") return "gif";
  return "jpg";
}

async function uploadInlineImages(userId, key, item) {
  // Firestoreにはdata URLを残さない。画像本体はFirebase Storage、投稿にはURLだけを保存する。
  const revision = `${Date.now()}-${getClientId()}-${Math.random().toString(36).slice(2, 8)}`;
  const walk = async (value, path = []) => {
    if (typeof value === "string" && value.startsWith("data:image/")) {
      const response = await fetch(value);
      const blob = await response.blob();
      const name = `${path.join("-") || "image"}.${imageExtension(blob.type)}`;
      const target = ref(mediaStorage, `users/${userId}/media/${key}/${item.id}/${revision}/${name}`);
      await uploadBytes(target, blob, { contentType: blob.type || "image/jpeg" });
      const url = await getDownloadURL(target);
      syncLog("image-uploaded", { userId, key, id: item.id, path: path.join(".") });
      return url;
    }
    if (Array.isArray(value)) return Promise.all(value.map((part, index) => walk(part, [...path, index])));
    if (value && typeof value === "object") {
      const copy = {};
      for (const [name, part] of Object.entries(value)) copy[name] = await walk(part, [...path, name]);
      return copy;
    }
    return value;
  };
  return walk(item);
}

async function readChunks(target, chunkCount, revision) {
  // revisionがある新形式では、画像ごとの本文を世代別に分離する。
  // 古いroot/chunksは移行済みデータを読むためだけに残す。
  const source = revision
    ? collection(target, "revisions", revision, "chunks")
    : collection(target, "chunks");
  const snapshots = await getDocsFromServer(source);
  const chunks = snapshots.docs
    .map(snapshot => snapshot.data())
    .filter(chunk => Number.isInteger(chunk.index) && chunk.index < chunkCount)
    .sort((a, b) => a.index - b.index);
  if (chunks.length !== chunkCount || chunks.some((chunk, index) => chunk.index !== index || typeof chunk.data !== "string")) {
    throw new Error(`画像投稿のチャンクが不足しています (${chunks.length}/${chunkCount})`);
  }
  return chunks.map(chunk => chunk.data).join("");
}

async function payloadFromSnapshot(snapshot) {
  const data = snapshot.data();
  if (typeof data.payload === "string") return JSON.parse(data.payload);
  if (data.chunkCount > 0) return JSON.parse(await readChunks(snapshot.ref, data.chunkCount, data.revision));
  return null;
}

async function readLegacyValue(userId, key) {
  const target = legacyRef(userId, key);
  const metadata = await getDocFromServer(target);
  if (!metadata.exists()) return null;
  const data = metadata.data();
  if (typeof data.value === "string") return data.value;
  if (!data.chunkCount) return null;
  return readChunks(target, data.chunkCount);
}

async function writeChunks(target, serialized, revision) {
  const chunks = [];
  for (let index = 0; index < serialized.length; index += CHUNK_SIZE) {
    chunks.push(serialized.slice(index, index + CHUNK_SIZE));
  }
  for (let start = 0; start < chunks.length; start += CHUNKS_PER_BATCH) {
    const batch = writeBatch(db);
    chunks.slice(start, start + CHUNKS_PER_BATCH).forEach((data, offset) => {
      const index = start + offset;
      // revisionを含むパスなので、古い端末が新しい画像のchunkを上書きできない。
      batch.set(doc(target, "revisions", revision, "chunks", String(index).padStart(6, "0")), { index, data }, { merge: true });
    });
    await batch.commit();
  }
  return chunks.length;
}

async function safelyWriteItem(userId, key, item, { migration = false, uploadImages = true } = {}) {
  if (!item?.id || item.isAll) return { accepted: false, item };
  const storedItem = uploadImages ? await uploadInlineImages(userId, key, item) : item;
  const target = itemRef(userId, key, storedItem.id);
  const serialized = JSON.stringify(storedItem);
  const proposedAt = clientUpdatedAt(storedItem);
  const large = serialized.length > CHUNK_SIZE;
  const clientId = getClientId();
  const revision = large ? `${proposedAt}-${clientId}-${Math.random().toString(36).slice(2, 10)}` : null;
  // 先に書かれた古い世代はmetadataが採用されない限り参照されない。ここで同一chunkを共有しない。
  const chunkCount = large ? await writeChunks(target, serialized, revision) : 0;

  const accepted = await runTransaction(db, async (transaction) => {
    const previous = await transaction.get(target);
    const existing = previous.exists() ? previous.data() : null;
    const existingAt = Number(existing?.clientUpdatedAt || 0);
    // 古い端末の内容では、新しいクラウド内容を更新しない。
    if (existingAt > proposedAt || (existingAt === proposedAt && existing?.clientId && existing.clientId !== clientId)) {
      return false;
    }
    transaction.set(target, {
      id: storedItem.id,
      payload: large ? deleteField() : serialized,
      chunkCount,
      revision: large ? revision : deleteField(),
      clientUpdatedAt: proposedAt,
      updatedAt: serverTimestamp(),
      clientId,
      deletedAt: deleteField(),
      migratedFromLegacy: migration || deleteField()
    }, { merge: true });
    return true;
  });

  syncLog(accepted ? "item-written" : "stale-write-skipped", {
    userId, key, id: storedItem.id, clientUpdatedAt: proposedAt, migration
  });
  void writeAuditLog(userId, accepted ? "item-written" : "stale-write-skipped", {
    key, id: storedItem.id, clientUpdatedAt: proposedAt, migration
  });
  return { accepted, item: storedItem };
}

async function safelyDeleteItem(userId, key, id) {
  if (!DATA_KEYS[key] || !id || id === "all") return false;
  const target = itemRef(userId, key, id);
  const proposedAt = Date.now();
  const clientId = getClientId();
  const accepted = await runTransaction(db, async (transaction) => {
    const previous = await transaction.get(target);
    const existing = previous.exists() ? previous.data() : null;
    if (Number(existing?.clientUpdatedAt || 0) > proposedAt) return false;
    transaction.set(target, {
      id,
      clientUpdatedAt: proposedAt,
      updatedAt: serverTimestamp(),
      clientId,
      deletedAt: serverTimestamp()
    }, { merge: true });
    return true;
  });
  syncLog(accepted ? "item-deleted" : "stale-delete-skipped", { userId, key, id, clientUpdatedAt: proposedAt });
  void writeAuditLog(userId, accepted ? "item-deleted" : "stale-delete-skipped", { key, id, clientUpdatedAt: proposedAt });
  return accepted;
}

async function safelyWritePreference(userId, key, value) {
  const target = preferenceRef(userId, key);
  const proposedAt = Date.now();
  const clientId = getClientId();
  const accepted = await runTransaction(db, async (transaction) => {
    const previous = await transaction.get(target);
    const existing = previous.exists() ? previous.data() : null;
    if (Number(existing?.clientUpdatedAt || 0) > proposedAt) return false;
    transaction.set(target, {
      value: JSON.parse(value), clientUpdatedAt: proposedAt, updatedAt: serverTimestamp(), clientId
    }, { merge: true });
    return true;
  });
  syncLog(accepted ? "preference-written" : "stale-preference-skipped", { userId, key, clientUpdatedAt: proposedAt });
  void writeAuditLog(userId, accepted ? "preference-written" : "stale-preference-skipped", { key, clientUpdatedAt: proposedAt });
  return accepted;
}

async function migrateLegacyFirestore(user) {
  if (user.isAnonymous) return;
  if (migrations.has(user.uid)) return migrations.get(user.uid);
  const task = (async () => {
    const marker = doc(db, "users", user.uid, "meta", "migration");
    const markerSnapshot = await getDocFromServer(marker);
    if (markerSnapshot.data()?.individualDocumentsV1) return;

    // すでに個別ドキュメントがあれば、重い旧形式データを起動時に再移行しない。
    // 旧画像の失敗が、正常な新データの読み込みまで止めることを防ぐ。
    const existingEntries = await getDocsFromServer(collectionRef(user.uid, "nb.entries"));
    if (!existingEntries.empty) {
      await setDoc(marker, {
        individualDocumentsV1: true, importedAt: serverTimestamp(), clientId: getClientId(), skippedLegacyImport: true
      }, { merge: true });
      syncLog("legacy-migration-skipped", { userId: user.uid, reason: "modern-documents-exist" });
      return;
    }

    // ブラウザー/PWAのlocalStorageは移行元にしない。旧Firestoreデータだけを一度だけ取り込む。
    for (const key of Object.keys(DATA_KEYS)) {
      try {
        const raw = await readLegacyValue(user.uid, key);
        if (!raw) continue;
        const values = JSON.parse(raw);
        if (Array.isArray(values)) {
          for (const value of values) await safelyWriteItem(user.uid, key, value, { migration: true, uploadImages: false });
        }
      } catch (error) {
        syncLog("legacy-migration-invalid", { userId: user.uid, key, message: error.message });
      }
    }
    for (const key of PREFERENCE_KEYS) {
      try {
        const raw = await readLegacyValue(user.uid, key);
        if (raw != null) await safelyWritePreference(user.uid, key, raw);
      } catch (error) {
        syncLog("legacy-preference-migration-failed", { userId: user.uid, key, message: error.message });
      }
    }
    await setDoc(marker, {
      individualDocumentsV1: true, importedAt: serverTimestamp(), clientId: getClientId()
    }, { merge: true });
    syncLog("legacy-migration-complete", { userId: user.uid });
  })();
  migrations.set(user.uid, task);
  try { await task; } finally { migrations.delete(user.uid); }
}

function createFirebaseStorageAdapter() {
  const listeners = new Map();
  const watchers = new Map();
  const known = new Map();
  const refreshQueues = new Map();
  const notify = (key, value) => listeners.get(key)?.forEach(listener => listener(value));
  const knownFor = (userId, key) => {
    const id = `${userId}:${key}`;
    if (!known.has(id)) known.set(id, new Map());
    return known.get(id);
  };

  async function mergeItemSnapshots(user, key, snapshots, { initial = false } = {}) {
    const incoming = await Promise.all(snapshots.map(async snapshot => {
      const data = snapshot.data();
      const version = Number(data.clientUpdatedAt || 0);
      if (data.deletedAt) return { id: snapshot.id, version, deleted: true };
      try {
        const value = await payloadFromSnapshot(snapshot);
        if (!value?.id) throw new Error("投稿データの形式が不正です");
        return { id: snapshot.id, version, deleted: false, value, signature: stable(value) };
      } catch (error) {
        syncLog("item-read-failed", { userId: user.uid, key, id: snapshot.id, message: error.message });
        // 1件の壊れた画像投稿で、他の投稿や全端末を接続エラーにしない。
        void writeAuditLog(user.uid, "item-quarantined", { key, id: snapshot.id, message: error.message });
        return { id: snapshot.id, version, deleted: false, quarantined: true };
      }
    }));
    const map = knownFor(user.uid, key);
    if (initial) map.clear();
    // 「今回の一覧に無い」ことは削除ではない。削除はdeletedAtを持つ当該ドキュメントだけで確定する。
    incoming.forEach(record => {
      const previous = map.get(record.id);
      if (record.quarantined) {
        // 既に読めている内容は保ち、初回に読めない投稿だけを非表示で隔離する。
        if (!previous) map.set(record.id, { ...record, clientUpdatedAt: record.version });
        syncLog("quarantined-entry-skipped", { userId: user.uid, key, id: record.id });
        return;
      }
      if (!previous || record.version >= previous.clientUpdatedAt) {
        map.set(record.id, {
          ...record,
          clientUpdatedAt: record.version
        });
      } else {
        syncLog("older-server-snapshot-ignored", {
          userId: user.uid, key, id: record.id,
          incomingClientUpdatedAt: record.version,
          knownClientUpdatedAt: previous.clientUpdatedAt
        });
      }
    });
    return [...map.values()].filter(record => !record.deleted && !record.quarantined && record.value).map(record => record.value);
  }

  async function loadItemsFromServer(user, key, { initial = false } = {}) {
    const snapshots = await getDocsFromServer(collectionRef(user.uid, key));
    return mergeItemSnapshots(user, key, snapshots.docs, { initial });
  }

  async function loadPreferenceFromServer(user, key) {
    const snapshot = await getDocFromServer(preferenceRef(user.uid, key));
    return snapshot.exists() ? JSON.stringify(snapshot.data().value) : null;
  }

  function watch(user, key) {
    if (user.isAnonymous || watchers.has(`${user.uid}:${key}`)) return;
    const id = `${user.uid}:${key}`;
    const target = DATA_KEYS[key] ? collectionRef(user.uid, key) : preferenceRef(user.uid, key);
    const unsubscribe = onSnapshot(target, { includeMetadataChanges: true }, async (snapshot) => {
      // PWAに残るFirestore IndexedDBキャッシュを正としない。サーバー確定のスナップショットだけ使う。
      if (snapshot.metadata.fromCache || snapshot.metadata.hasPendingWrites) {
        syncLog("cached-snapshot-ignored", { userId: user.uid, key });
        return;
      }
      // 連続するFirestore通知は順番に処理する。古い読み込みの完了が新しい結果を巻き戻さない。
      const previousRefresh = refreshQueues.get(id) || Promise.resolve();
      const refresh = previousRefresh.catch(() => {}).then(async () => {
        const value = DATA_KEYS[key]
          // 監視通知のたびに全件を再取得しない。変化したドキュメントだけを統合する。
          ? JSON.stringify(await mergeItemSnapshots(user, key, snapshot.docChanges().map(change => change.doc)))
          : (snapshot.exists() ? JSON.stringify(snapshot.data().value) : null);
        if (value != null) notify(key, value);
        reportSync("connected");
        syncLog("server-snapshot-applied", { userId: user.uid, key });
      });
      refreshQueues.set(id, refresh);
      try { await refresh; } catch (error) {
        reportSync("error", error);
        syncLog("server-snapshot-failed", { userId: user.uid, key, message: error.message });
      }
    }, error => {
      reportSync("error", error);
      syncLog("snapshot-error", { userId: user.uid, key, message: error.message });
    });
    watchers.set(id, unsubscribe);
  }

  return {
    async get(key) {
      const user = await getFirebaseUser();
      if (user.isAnonymous || key === "nb.auth") return localStorageAdapter.get(key);
      if (!DATA_KEYS[key] && !PREFERENCE_KEYS.has(key)) return localStorageAdapter.get(key);
      try {
        // 起動・再読み込みでは、必ずFirestoreサーバーを先に読む。端末キャッシュは復元元にしない。
        await migrateLegacyFirestore(user);
        const value = DATA_KEYS[key]
          ? JSON.stringify(await loadItemsFromServer(user, key, { initial: true }))
          : await loadPreferenceFromServer(user, key);
        watch(user, key);
        reportSync("connected");
        syncLog("server-first-load", { userId: user.uid, key });
        return value == null ? null : { value };
      } catch (error) {
        reportSync("error", error);
        syncLog("server-first-load-failed", { userId: user.uid, key, message: error.message });
        throw error;
      }
    },
    async set(key, value) {
      await localStorageAdapter.set(key, value);
      const user = await getFirebaseUser();
      if (user.isAnonymous || key === "nb.auth") return;
      if (PREFERENCE_KEYS.has(key)) {
        await safelyWritePreference(user.uid, key, value);
        reportSync("connected");
        return;
      }
      if (!DATA_KEYS[key]) return;
      let values;
      try { values = JSON.parse(value); } catch (_) { return; }
      if (!Array.isArray(values)) return;
      // 空のローカル状態はクラウドを空にしない。削除はdeleteItemの明示操作だけ。
      if (values.length === 0) {
        syncLog("empty-local-write-blocked", { userId: user.uid, key });
        return;
      }
      const map = knownFor(user.uid, key);
      for (const item of values) {
        if (!item?.id || item.isAll || map.get(item.id)?.signature === stable(item)) continue;
        const result = await safelyWriteItem(user.uid, key, item);
        if (result.accepted) map.set(result.item.id, {
          id: result.item.id,
          value: result.item,
          signature: stable(result.item),
          deleted: false,
          clientUpdatedAt: clientUpdatedAt(result.item)
        });
      }
      reportSync("connected");
    },
    // 新規・編集の投稿は配列同期を経由せず、1ドキュメントの確定を待ってからUIに反映する。
    async saveItem(key, item) {
      try {
        const user = await getFirebaseUser();
        if (user.isAnonymous) return { ok: true };
        if (!DATA_KEYS[key]) return { ok: false, error: new Error("保存先が不正です") };
        const result = await safelyWriteItem(user.uid, key, item);
        if (!result.accepted) {
          const error = new Error("この記録は別の端末で更新されています。再読み込みして内容を確認してください。");
          reportSync("error", error);
          return { ok: false, error };
        }
        knownFor(user.uid, key).set(result.item.id, {
          id: result.item.id,
          value: result.item,
          signature: stable(result.item),
          deleted: false,
          clientUpdatedAt: clientUpdatedAt(result.item)
        });
        reportSync("connected");
        return { ok: true, item: result.item };
      } catch (error) {
        reportSync("error", error);
        syncLog("item-save-failed", { key, id: item?.id, message: error.message });
        return { ok: false, error };
      }
    },
    async delete(key) {
      await localStorageAdapter.delete(key);
    },
    async deleteItem(key, id) {
      try {
        const user = await getFirebaseUser();
        if (user.isAnonymous) return { ok: true };
        const accepted = await safelyDeleteItem(user.uid, key, id);
        if (!accepted) return { ok: false, error: new Error("この記録は別の端末で更新されています") };
        knownFor(user.uid, key).set(id, { id, deleted: true, clientUpdatedAt: Date.now() });
        reportSync("connected");
        return { ok: true };
      } catch (error) {
        reportSync("error", error);
        syncLog("item-delete-failed", { key, id, message: error.message });
        return { ok: false, error };
      }
    },
    subscribe(key, listener) {
      const set = listeners.get(key) || new Set();
      set.add(listener);
      listeners.set(key, set);
      return () => {
        set.delete(listener);
        if (set.size === 0) listeners.delete(key);
      };
    }
  };
}

async function createNativeStorageAdapter() {
  try {
    const status = await LoofCloud.isAvailable();
    if (!status.available) return localStorageAdapter;
  } catch (_) { return localStorageAdapter; }
  return {
    async get(key) {
      try {
        const result = await LoofCloud.get({ key });
        if (result?.value == null) return localStorageAdapter.get(key);
        return { value: result.value };
      } catch (_) { return localStorageAdapter.get(key); }
    },
    async set(key, value) {
      await localStorageAdapter.set(key, value);
      try { await LoofCloud.set({ key, value }); } catch (_) {}
    },
    async delete(key) {
      await localStorageAdapter.delete(key);
      try { await LoofCloud.delete({ key }); } catch (_) {}
    },
    async saveItem() { return { ok: true }; },
    async deleteItem() {},
    subscribe() { return () => {}; }
  };
}

if (typeof window !== "undefined" && !window.storage) {
  const adapterPromise = Capacitor.isNativePlatform()
    ? createNativeStorageAdapter()
    : Promise.resolve(createFirebaseStorageAdapter());
  window.storage = {
    async get(key) { return (await adapterPromise).get(key); },
    async set(key, value) { return (await adapterPromise).set(key, value); },
    async delete(key) { return (await adapterPromise).delete(key); },
    async deleteItem(key, id) { return (await adapterPromise).deleteItem?.(key, id); },
    async saveItem(key, item) { return (await adapterPromise).saveItem?.(key, item); },
    subscribe(key, listener) {
      let alive = true;
      let unsubscribe = () => {};
      adapterPromise.then(adapter => { if (alive && adapter.subscribe) unsubscribe = adapter.subscribe(key, listener); });
      return () => { alive = false; unsubscribe(); };
    }
  };
}
