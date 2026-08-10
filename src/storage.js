import { Capacitor, registerPlugin } from "@capacitor/core";
import {
  addDoc, collection, deleteField, doc, getDocFromServer, getDocsFromServer,
  limit, onSnapshot, orderBy, query, runTransaction, serverTimestamp, setDoc, writeBatch
} from "firebase/firestore";
import { deleteObject, getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { db, getFirebaseUser, mediaStorage } from "./firebase.js";
import { isRetryableStorageError } from "./media-utils.js";
import { storedArray, upsertStoredItem } from "./storage-utils.js";

const DATA_KEYS = {
  "nb.accounts": "accounts",
  "nb.entries": "entries",
  "nb.collections": "collections"
};
const PREFERENCE_KEYS = new Set(["nb.current", "nb.icloud"]);
// Firestoreは1ドキュメント1MiB・1バッチ10MiBまで。複数画像でも余裕を持たせる。
const CHUNK_SIZE = 400_000;
const CHUNKS_PER_BATCH = 8;
const INITIAL_ENTRY_LIMIT = 100;
const DISPLAY_CACHE_LIMIT = 100;
const DISPLAY_CACHE_PREFIX = "loof.server-cache";
const ENABLE_REALTIME_SNAPSHOTS = false;
const ENABLE_FIRESTORE_AUDIT_LOGS = false;
const LoofCloud = registerPlugin("LoofCloud");
const migrations = new Map();
const migratedUsers = new Set();

function displayCacheKey(userId, key) {
  return `${DISPLAY_CACHE_PREFIX}:${userId}:${key}`;
}

function recentItemsForCache(key, values) {
  if (key !== "nb.entries") return values;
  return [...values]
    .sort((a, b) => String(b?.createdAt || "").localeCompare(String(a?.createdAt || "")))
    .slice(0, DISPLAY_CACHE_LIMIT);
}

function readDisplayCache(userId, key) {
  try {
    const raw = window.localStorage.getItem(displayCacheKey(userId, key));
    if (raw == null) return null;
    const values = storedArray(raw, { strict: true });
    if (key === "nb.accounts" && values.length === 0) return null;
    return values;
  } catch (_) {
    return null;
  }
}

function writeDisplayCache(userId, key, values) {
  try {
    window.localStorage.setItem(
      displayCacheKey(userId, key),
      JSON.stringify(recentItemsForCache(key, values))
    );
  } catch (error) {
    syncLog("display-cache-write-skipped", { userId, key, message: error.message });
  }
}

function readPreferenceDisplayCache(userId, key) {
  try {
    return window.localStorage.getItem(displayCacheKey(userId, key));
  } catch (_) {
    return null;
  }
}

function writePreferenceDisplayCache(userId, key, value) {
  try {
    if (value == null) window.localStorage.removeItem(displayCacheKey(userId, key));
    else window.localStorage.setItem(displayCacheKey(userId, key), value);
  } catch (_) {}
}

const localStorageAdapter = {
  async get(key) {
    const value = window.localStorage.getItem(key);
    return value == null ? null : { value };
  },
  async set(key, value) { window.localStorage.setItem(key, value); },
  async delete(key) { window.localStorage.removeItem(key); },
  async saveItem(key, item) {
    if (!DATA_KEYS[key] || !item?.id || item.isAll) {
      return { ok: false, error: new Error("保存先が不正です") };
    }
    try {
      const next = upsertStoredItem(storedArray(window.localStorage.getItem(key), { strict: true }), item);
      window.localStorage.setItem(key, JSON.stringify(next));
      return { ok: true, item };
    } catch (error) {
      return { ok: false, error };
    }
  },
  async deleteItem(key, id) {
    if (!DATA_KEYS[key] || !id || id === "all") {
      return { ok: false, error: new Error("削除先が不正です") };
    }
    try {
      const next = storedArray(window.localStorage.getItem(key), { strict: true }).filter(item => item?.id !== id);
      window.localStorage.setItem(key, JSON.stringify(next));
      return { ok: true };
    } catch (error) {
      return { ok: false, error };
    }
  },
  subscribe() { return () => {}; }
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
  if (!ENABLE_FIRESTORE_AUDIT_LOGS) return;
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

function managedMediaRef(userId, value) {
  if (typeof value !== "string" || (!value.startsWith("gs://") && !value.startsWith("https://"))) return null;
  try {
    const target = ref(mediaStorage, value);
    return target.fullPath.startsWith(`users/${userId}/media/`) ? target : null;
  } catch (_) {
    return null;
  }
}

function collectManagedMediaRefs(userId, value, refs = new Map()) {
  if (typeof value === "string") {
    const target = managedMediaRef(userId, value);
    if (target) refs.set(target.fullPath, target);
    return refs;
  }
  if (Array.isArray(value)) {
    value.forEach(part => collectManagedMediaRefs(userId, part, refs));
    return refs;
  }
  if (value && typeof value === "object") {
    Object.values(value).forEach(part => collectManagedMediaRefs(userId, part, refs));
  }
  return refs;
}

async function retryStorageOperation(operation, attempts = 3) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (attempt === attempts || !isRetryableStorageError(error)) throw error;
      await new Promise(resolve => setTimeout(resolve, attempt * 300));
    }
  }
  throw lastError;
}

async function deleteManagedMediaTargets(targets, detail = {}) {
  for (const target of targets) {
    try {
      await retryStorageOperation(() => deleteObject(target), 2);
      syncLog("image-deleted", { ...detail, path: target.fullPath });
    } catch (error) {
      if (error?.code === "storage/object-not-found") continue;
      console.warn("[loof sync] image-delete-failed", { ...detail, path: target.fullPath, error });
    }
  }
}

async function uploadInlineImages(userId, key, item) {
  // Firestoreにはdata URLを残さない。画像本体はFirebase Storage、投稿にはURLだけを保存する。
  const revision = `${Date.now()}-${getClientId()}-${Math.random().toString(36).slice(2, 8)}`;
  const uploadedTargets = [];
  const walk = async (value, path = []) => {
    if (typeof value === "string" && value.startsWith("data:image/")) {
      const response = await fetch(value);
      const blob = await response.blob();
      const name = `${path.join("-") || "image"}.${imageExtension(blob.type)}`;
      const target = ref(mediaStorage, `users/${userId}/media/${key}/${item.id}/${revision}/${name}`);
      await retryStorageOperation(() => uploadBytes(target, blob, { contentType: blob.type || "image/jpeg" }));
      uploadedTargets.push(target);
      const url = await retryStorageOperation(() => getDownloadURL(target));
      syncLog("image-uploaded", { userId, key, id: item.id, path: path.join(".") });
      return url;
    }
    if (Array.isArray(value)) {
      const copy = [];
      for (let index = 0; index < value.length; index += 1) copy.push(await walk(value[index], [...path, index]));
      return copy;
    }
    if (value && typeof value === "object") {
      const copy = {};
      for (const [name, part] of Object.entries(value)) copy[name] = await walk(part, [...path, name]);
      return copy;
    }
    return value;
  };
  try {
    return { item: await walk(item), uploadedTargets };
  } catch (error) {
    await deleteManagedMediaTargets(uploadedTargets, { userId, key, id: item.id, reason: "upload-failed" });
    throw error;
  }
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
  if (data.chunkCount > 0) {
    return JSON.parse(await readChunks(snapshot.ref, data.chunkCount, data.revision));
  }
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

async function safelyWriteItem(userId, key, item, { migration = false, uploadImages = true, previousItem = null } = {}) {
  if (!item?.id || item.isAll) return { accepted: false, item };
  const uploadResult = uploadImages
    ? await uploadInlineImages(userId, key, item)
    : { item, uploadedTargets: [] };
  const storedItem = uploadResult.item;
  const uploadedTargets = uploadResult.uploadedTargets;
  const target = itemRef(userId, key, storedItem.id);
  const serialized = JSON.stringify(storedItem);
  const proposedAt = clientUpdatedAt(storedItem);
  const large = serialized.length > CHUNK_SIZE;
  const clientId = getClientId();
  const revision = large ? `${proposedAt}-${clientId}-${Math.random().toString(36).slice(2, 10)}` : null;
  let accepted;
  try {
    // 先に書かれた古い世代はmetadataが採用されない限り参照されない。ここで同一chunkを共有しない。
    const chunkCount = large ? await writeChunks(target, serialized, revision) : 0;

    accepted = await runTransaction(db, async (transaction) => {
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
  } catch (error) {
    await deleteManagedMediaTargets(uploadedTargets, { userId, key, id: item.id, reason: "item-write-failed" });
    throw error;
  }

  if (!accepted) {
    await deleteManagedMediaTargets(uploadedTargets, { userId, key, id: item.id, reason: "stale-write" });
  } else if (previousItem) {
    const previousRefs = collectManagedMediaRefs(userId, previousItem);
    const currentRefs = collectManagedMediaRefs(userId, storedItem);
    const removedTargets = [...previousRefs.entries()]
      .filter(([path]) => !currentRefs.has(path))
      .map(([, mediaRef]) => mediaRef);
    await deleteManagedMediaTargets(removedTargets, { userId, key, id: item.id, reason: "replaced" });
  }

  syncLog(accepted ? "item-written" : "stale-write-skipped", {
    userId, key, id: storedItem.id, clientUpdatedAt: proposedAt, migration
  });
  void writeAuditLog(userId, accepted ? "item-written" : "stale-write-skipped", {
    key, id: storedItem.id, clientUpdatedAt: proposedAt, migration
  });
  return { accepted, item: storedItem };
}

async function safelyDeleteItem(userId, key, id, previousItem = null) {
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
  if (accepted && previousItem) {
    await deleteManagedMediaTargets([...collectManagedMediaRefs(userId, previousItem).values()], {
      userId, key, id, reason: "item-deleted"
    });
  }
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
  if (migratedUsers.has(user.uid)) return;
  if (migrations.has(user.uid)) return migrations.get(user.uid);
  const task = (async () => {
    const marker = doc(db, "users", user.uid, "meta", "migration");
    const markerSnapshot = await getDocFromServer(marker);
    if (markerSnapshot.data()?.legacyRecoveryV2) {
      migratedUsers.add(user.uid);
      return;
    }

    // V1が途中で止まったユーザーも含め、旧Firestoreに残る配列を不足分だけ再統合する。
    // safelyWriteItemが更新日時を比較するため、現在の個別ドキュメントを古い内容で上書きしない。
    const failures = [];
    for (const key of Object.keys(DATA_KEYS)) {
      try {
        const raw = await readLegacyValue(user.uid, key);
        if (!raw) continue;
        const values = JSON.parse(raw);
        if (Array.isArray(values)) {
          for (const value of values) await safelyWriteItem(user.uid, key, value, { migration: true, uploadImages: false });
        }
      } catch (error) {
        failures.push({ key, message: error.message });
        syncLog("legacy-migration-invalid", { userId: user.uid, key, message: error.message });
      }
    }
    for (const key of PREFERENCE_KEYS) {
      try {
        // 現行設定があれば、旧設定では巻き戻さない。
        const current = await getDocFromServer(preferenceRef(user.uid, key));
        if (current.exists()) continue;
        const raw = await readLegacyValue(user.uid, key);
        if (raw != null) await safelyWritePreference(user.uid, key, raw);
      } catch (error) {
        failures.push({ key, message: error.message });
        syncLog("legacy-preference-migration-failed", { userId: user.uid, key, message: error.message });
      }
    }
    const completed = failures.length === 0;
    await setDoc(marker, completed ? {
      individualDocumentsV1: true,
      legacyRecoveryV2: true,
      recoveryImportedAt: serverTimestamp(),
      recoveryFailures: deleteField(),
      clientId: getClientId()
    } : {
      recoveryLastAttemptAt: serverTimestamp(),
      recoveryFailures: failures,
      clientId: getClientId()
    }, { merge: true });
    migratedUsers.add(user.uid);
    syncLog(completed ? "legacy-recovery-complete" : "legacy-recovery-incomplete", {
      userId: user.uid, failures
    });
  })();
  migrations.set(user.uid, task);
  try { await task; } finally { migrations.delete(user.uid); }
}

function createFirebaseStorageAdapter() {
  const listeners = new Map();
  const watchers = new Map();
  const known = new Map();
  const refreshQueues = new Map();
  const initialSyncs = new Map();
  const fullRefreshes = new Map();
  const preferenceRefreshes = new Map();
  const readyKeys = new Set();
  const requiredReadyKeys = new Set(["nb.accounts", "nb.entries"]);
  const notify = (key, value) => listeners.get(key)?.forEach(listener => listener(value));
  const knownFor = (userId, key) => {
    const id = `${userId}:${key}`;
    if (!known.has(id)) known.set(id, new Map());
    return known.get(id);
  };

  function primeKnownFromCache(user, key, values) {
    const map = knownFor(user.uid, key);
    if (map.size > 0) return;
    values.forEach(value => {
      if (!value?.id || value.isAll) return;
      map.set(value.id, {
        id: value.id,
        value,
        signature: stable(value),
        deleted: false,
        clientUpdatedAt: clientUpdatedAt(value)
      });
    });
  }

  function markInitialReady(key) {
    readyKeys.add(key);
    reportCurrentSyncStatus();
  }

  function reportCurrentSyncStatus() {
    if (![...requiredReadyKeys].every(requiredKey => readyKeys.has(requiredKey))) {
      reportSync("syncing");
    } else if (fullRefreshes.size > 0) {
      reportSync("background");
    } else {
      reportSync("connected");
    }
  }

  async function getStorageUser() {
    try {
      return await getFirebaseUser();
    } catch (error) {
      // 匿名認証が無効・一時停止中でも、ゲスト利用は端末保存で継続する。
      syncLog("auth-unavailable-local-fallback", { message: error.message });
      return null;
    }
  }

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

  async function loadItemsFromServer(user, key, { initial = false, firstPage = false } = {}) {
    const source = key === "nb.entries" && firstPage
      ? query(collectionRef(user.uid, key), orderBy("clientUpdatedAt", "desc"), limit(INITIAL_ENTRY_LIMIT))
      : collectionRef(user.uid, key);
    const snapshots = await getDocsFromServer(source);
    return mergeItemSnapshots(user, key, snapshots.docs, { initial });
  }

  async function loadPreferenceFromServer(user, key) {
    const snapshot = await getDocFromServer(preferenceRef(user.uid, key));
    return snapshot.exists() ? JSON.stringify(snapshot.data().value) : null;
  }

  function watch(user, key) {
    if (!ENABLE_REALTIME_SNAPSHOTS) return;
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
        reportCurrentSyncStatus();
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
    watchers.set(id, { unsubscribe, userId: user.uid, key });
  }

  function releaseWatchersForKey(key) {
    for (const [id, watcher] of watchers.entries()) {
      if (watcher.key !== key) continue;
      watcher.unsubscribe?.();
      watchers.delete(id);
      refreshQueues.delete(id);
      syncLog("snapshot-unsubscribed", { userId: watcher.userId, key });
    }
  }

  function refreshFullHistory(user, key) {
    if (key !== "nb.entries") return Promise.resolve();
    const id = `${user.uid}:${key}`;
    if (fullRefreshes.has(id)) return fullRefreshes.get(id);
    const task = (async () => {
      let succeeded = false;
      try {
        reportSync("background");
        // 旧データ回復と全履歴取得は初期画面を表示した後に行う。
        await migrateLegacyFirestore(user);
        const values = await loadItemsFromServer(user, key);
        writeDisplayCache(user.uid, key, values);
        notify(key, JSON.stringify(values));
        syncLog("server-full-history-loaded", { userId: user.uid, key, count: values.length });
        succeeded = true;
      } catch (error) {
        reportSync("partial", error);
        syncLog("server-full-history-failed", { userId: user.uid, key, message: error.message });
      } finally {
        fullRefreshes.delete(id);
        if (succeeded) reportCurrentSyncStatus();
      }
    })();
    fullRefreshes.set(id, task);
    return task;
  }

  function syncInitialPage(user, key, { cached = false } = {}) {
    const id = `${user.uid}:${key}`;
    if (initialSyncs.has(id)) return initialSyncs.get(id);
    const task = (async () => {
      try {
        reportSync("syncing");
        const values = await loadItemsFromServer(user, key, {
          initial: !cached,
          firstPage: key === "nb.entries"
        });
        writeDisplayCache(user.uid, key, values);
        notify(key, JSON.stringify(values));
        watch(user, key);
        markInitialReady(key);
        syncLog("server-initial-page-loaded", { userId: user.uid, key, count: values.length });
        void refreshFullHistory(user, key);
        return values;
      } catch (error) {
        reportSync("error", error);
        syncLog("server-initial-page-failed", { userId: user.uid, key, message: error.message });
        throw error;
      } finally {
        initialSyncs.delete(id);
      }
    })();
    initialSyncs.set(id, task);
    return task;
  }

  function refreshPreference(user, key) {
    const id = `${user.uid}:${key}`;
    if (preferenceRefreshes.has(id)) return preferenceRefreshes.get(id);
    const task = (async () => {
      try {
        const value = await loadPreferenceFromServer(user, key);
        writePreferenceDisplayCache(user.uid, key, value);
        if (value != null) notify(key, value);
        watch(user, key);
      } catch (error) {
        syncLog("preference-refresh-failed", { userId: user.uid, key, message: error.message });
      } finally {
        preferenceRefreshes.delete(id);
      }
    })();
    preferenceRefreshes.set(id, task);
    return task;
  }

  return {
    async get(key) {
      if (key === "nb.auth") return localStorageAdapter.get(key);
      const user = await getStorageUser();
      if (!user || user.isAnonymous) return localStorageAdapter.get(key);
      if (!DATA_KEYS[key] && !PREFERENCE_KEYS.has(key)) return localStorageAdapter.get(key);
      try {
        if (DATA_KEYS[key]) {
          const cached = readDisplayCache(user.uid, key);
          if (cached) {
            primeKnownFromCache(user, key, cached);
            void syncInitialPage(user, key, { cached: true }).catch(() => {});
            syncLog("display-cache-used", { userId: user.uid, key, count: cached.length });
            return { value: JSON.stringify(cached) };
          }
          const values = await syncInitialPage(user, key);
          return { value: JSON.stringify(values) };
        }
        // 選択中ノートも表示専用キャッシュを先に使い、起動直後のノート切り替わりを防ぐ。
        const cachedPreference = readPreferenceDisplayCache(user.uid, key);
        if (cachedPreference != null) {
          void refreshPreference(user, key);
          return { value: cachedPreference };
        }
        const value = await loadPreferenceFromServer(user, key);
        writePreferenceDisplayCache(user.uid, key, value);
        watch(user, key);
        return value == null ? null : { value };
      } catch (error) {
        reportSync("error", error);
        syncLog("server-first-load-failed", { userId: user.uid, key, message: error.message });
        throw error;
      }
    },
    async set(key, value) {
      await localStorageAdapter.set(key, value);
      if (key === "nb.auth") return;
      const user = await getStorageUser();
      if (!user || user.isAnonymous) return;
      if (PREFERENCE_KEYS.has(key)) {
        await safelyWritePreference(user.uid, key, value);
        writePreferenceDisplayCache(user.uid, key, value);
        reportCurrentSyncStatus();
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
        const result = await safelyWriteItem(user.uid, key, item, { previousItem: map.get(item.id)?.value || null });
        if (result.accepted) map.set(result.item.id, {
          id: result.item.id,
          value: result.item,
          signature: stable(result.item),
          deleted: false,
          clientUpdatedAt: clientUpdatedAt(result.item)
        });
      }
      reportCurrentSyncStatus();
    },
    // 新規・編集の投稿は配列同期を経由せず、1ドキュメントの確定を待ってからUIに反映する。
    async saveItem(key, item) {
      try {
        const user = await getStorageUser();
        if (!user || user.isAnonymous) return localStorageAdapter.saveItem(key, item);
        if (!DATA_KEYS[key]) return { ok: false, error: new Error("保存先が不正です") };
        if (!readyKeys.has(key)) {
          return { ok: false, error: new Error("最新データを確認中です。同期完了後にもう一度お試しください") };
        }
        const map = knownFor(user.uid, key);
        const result = await safelyWriteItem(user.uid, key, item, { previousItem: map.get(item.id)?.value || null });
        if (!result.accepted) {
          const error = new Error("この記録は別の端末で更新されています。再読み込みして内容を確認してください。");
          reportSync("error", error);
          return { ok: false, error };
        }
        map.set(result.item.id, {
          id: result.item.id,
          value: result.item,
          signature: stable(result.item),
          deleted: false,
          clientUpdatedAt: clientUpdatedAt(result.item)
        });
        reportCurrentSyncStatus();
        return { ok: true, item: result.item };
      } catch (error) {
        reportSync("error", error);
        syncLog("item-save-failed", { key, id: item?.id, message: error.message });
        console.error(`[loof sync] item-save-failed key=${key} id=${item?.id || "unknown"} code=${error?.code || "unknown"} message=${error?.message || String(error)}`, error);
        return { ok: false, error };
      }
    },
    async delete(key) {
      await localStorageAdapter.delete(key);
    },
    async deleteItem(key, id) {
      try {
        const user = await getStorageUser();
        if (!user || user.isAnonymous) return localStorageAdapter.deleteItem(key, id);
        if (!readyKeys.has(key)) {
          return { ok: false, error: new Error("最新データを確認中です。同期完了後にもう一度お試しください") };
        }
        const map = knownFor(user.uid, key);
        const accepted = await safelyDeleteItem(user.uid, key, id, map.get(id)?.value || null);
        if (!accepted) return { ok: false, error: new Error("この記録は別の端末で更新されています") };
        map.set(id, { id, deleted: true, clientUpdatedAt: Date.now() });
        reportCurrentSyncStatus();
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
        if (set.size === 0) {
          listeners.delete(key);
          releaseWatchersForKey(key);
        }
      };
    }
  };
}

function createNativeStorageAdapter() {
  const listeners = new Map();
  const refreshes = new Map();
  let mutationQueue = Promise.resolve();
  const availability = LoofCloud.isAvailable()
    .then(status => Boolean(status.available))
    .catch(() => false);
  const notify = (key, value) => listeners.get(key)?.forEach(listener => listener(value));

  async function readNativeValue(key, { fallbackOnError = true } = {}) {
    const available = await availability;
    if (!available) return localStorageAdapter.get(key);
    try {
      const result = await LoofCloud.get({ key });
      if (result?.value == null) {
        const local = await localStorageAdapter.get(key);
        // 初回CloudKit利用時は、端末に残る既存データをクラウドへ引き継ぐ。
        if (local?.value != null) {
          try { await LoofCloud.set({ key, value: local.value }); } catch (_) {}
        }
        return local;
      }
      await localStorageAdapter.set(key, result.value);
      return { value: result.value };
    } catch (error) {
      if (fallbackOnError) return localStorageAdapter.get(key);
      throw error;
    }
  }

  function refreshNativeValue(key) {
    if (key === "nb.auth" || refreshes.has(key)) return refreshes.get(key);
    const task = (async () => {
      try {
        const previous = await localStorageAdapter.get(key);
        const current = await readNativeValue(key);
        if (current?.value != null && current.value !== previous?.value) {
          notify(key, current.value);
        }
      } finally {
        refreshes.delete(key);
      }
    })();
    refreshes.set(key, task);
    return task;
  }

  function mutateItems(key, mutation, item, deleteId = null) {
    const task = mutationQueue.catch(() => {}).then(async () => {
      if (!DATA_KEYS[key]) throw new Error("保存先が不正です");
      const available = await availability;
      if (!available) {
        return deleteId
          ? localStorageAdapter.deleteItem(key, deleteId)
          : localStorageAdapter.saveItem(key, item);
      }
      // 読み込みに失敗した場合は古い端末キャッシュでCloudKitを上書きせず、保存自体を失敗させる。
      const current = await readNativeValue(key, { fallbackOnError: false });
      const next = mutation(storedArray(current?.value, { strict: true }));
      const value = JSON.stringify(next);
      // CloudKitへの保存が確定してからローカルキャッシュとUIを更新する。
      await LoofCloud.set({ key, value });
      await localStorageAdapter.set(key, value);
      return deleteId ? { ok: true } : { ok: true, item };
    });
    mutationQueue = task.then(() => undefined, () => undefined);
    return task.catch(error => ({ ok: false, error }));
  }

  return {
    async get(key) {
      if (key === "nb.auth") return localStorageAdapter.get(key);
      const local = await localStorageAdapter.get(key);
      if (local?.value != null) {
        // 前回同期済みデータを即表示し、CloudKitの確認はバックグラウンドで行う。
        void refreshNativeValue(key);
        return local;
      }
      // 初回だけは空のローカル状態でクラウドを上書きしないよう、CloudKitの結果を待つ。
      return readNativeValue(key);
    },
    async set(key, value) {
      if (key === "nb.auth") {
        await localStorageAdapter.set(key, value);
        return;
      }
      if (await availability) await LoofCloud.set({ key, value });
      await localStorageAdapter.set(key, value);
    },
    async delete(key) {
      await localStorageAdapter.delete(key);
      try { await LoofCloud.delete({ key }); } catch (_) {}
    },
    async saveItem(key, item) {
      if (!item?.id || item.isAll) return { ok: false, error: new Error("保存内容が不正です") };
      return mutateItems(key, values => upsertStoredItem(values, item), item);
    },
    async deleteItem(key, id) {
      if (!id || id === "all") return { ok: false, error: new Error("削除内容が不正です") };
      return mutateItems(key, values => values.filter(item => item?.id !== id), null, id);
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

if (typeof window !== "undefined" && !window.storage) {
  const adapterPromise = Capacitor.isNativePlatform()
    ? Promise.resolve(createNativeStorageAdapter())
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
