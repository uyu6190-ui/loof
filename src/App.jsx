import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { createPortal } from "react-dom";
import { getFirebaseUser, isGoogleUser, signInWithGoogle, signOutFirebaseUser, subscribeToFirebaseUser } from "./firebase.js";
import { imageOutputType, storageErrorMessage, validateImageFile } from "./media-utils.js";
import { canEditAccount, saveProfile } from "./profile-utils.js";

/* ============================================================
   Myposts — 書いて、貼って、読み返す。
   ・1日単位でまとまるスレッド型タイムライン
   ・本文の好きな位置に画像を差し込めるブロック式エディタ（Notion風）
   ・複数アカウント（テーマ）切り替えでジャンル分け（タグなし）
   ・読み返す / その場で書き直す / 1日まとめてコピー
   ============================================================ */

const BG    = "#F5F5F6";
const PAPER = "#FFFFFF";
const INK   = "#18181B";
const SUB   = "#86868C";
const FAINT = "#B7B7BD";
const LINE  = "#ECECEE";
const LINE2 = "#F3F3F4";

/* X (Twitter) palette for faithful post rendering */
const TXT = "#0F1419";   // primary text
const MUT = "#536471";   // secondary (handle, time, icons)
const LK  = "#F91880";   // X like
const RTC = "#00BA7C";   // X repost
const BL  = "#1D9BF0";   // X accent
const COVERBG = "#E4E4E6"; // neutral grey cover
const BRD2 = "#D6D6DB";    // neutral border
const RED = "#F4212E";     // destructive

const DEFAULT_AVATAR = "data:image/jpeg;base64,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";

/* ---------- persisted storage (artifact window.storage) ---------- */
function usePersisted(key, init, { autoSave = false, enabled = true } = {}) {
  const [val, setVal] = useState(init);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(null);
  const writeQueue = useRef(Promise.resolve());
  useEffect(() => {
    if (!enabled) return undefined;
    let alive = true;
    (async () => {
      try {
        if (window.storage) {
          const r = await window.storage.get(key);
          if (alive && r?.value != null) setVal(JSON.parse(r.value));
        }
      } catch (error) {
        if (alive) setError(error);
      }
      // 読み込み失敗でも待機状態は終える。Google利用時は接続エラー画面へ、
      // ゲスト利用時は端末内の空データから起動できるようにする。
      if (alive) setLoaded(true);
    })();
    return () => { alive = false; };
  }, [key, enabled]);
  useEffect(() => {
    if (!enabled || !window.storage?.subscribe) return undefined;
    return window.storage.subscribe(key, (value) => {
      try {
        setVal((previous) => JSON.stringify(previous) === value ? previous : JSON.parse(value));
      } catch (_) {}
    });
  }, [key, enabled]);
  useEffect(() => {
    if (!enabled || !autoSave || !loaded) return;
    const serialized = JSON.stringify(val);
    // Firestoreデータは自動保存しない。ログイン状態など端末ローカルだけ必要なものに限定する。
    writeQueue.current = writeQueue.current.catch(() => {}).then(async () => {
      try {
        if (window.storage) await window.storage.set(key, serialized);
        setError(null);
      } catch (writeError) {
        console.error("[loof sync] write-failed", { key, error: writeError });
        setError(writeError);
        window.dispatchEvent(new CustomEvent("loof:sync-status", {
          detail: { status: "error", message: writeError?.message || "保存に失敗しました" }
        }));
      }
    });
  }, [key, val, loaded, autoSave, enabled]);
  return [val, setVal, loaded, error];
}

/* ---------- date helpers ---------- */
const pad = n => String(n).padStart(2, "0");
const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const DOW = ["日", "月", "火", "水", "木", "金", "土"];
function fmtTime(iso) { const d = new Date(iso); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; }
function fmtDayHead(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dow = DOW[new Date(y, m - 1, d).getDay()];
  return { big: `${m}月${d}日`, sub: `${y}・${dow}曜日` };
}
function relDay(iso) {
  const d = new Date(iso); d.setHours(0,0,0,0);
  const t = new Date(); t.setHours(0,0,0,0);
  const diff = Math.round((t - d) / 86400000);
  if (diff === 0) return "今日";
  if (diff === 1) return "昨日";
  if (diff < 7) return DOW[new Date(iso).getDay()] + "曜";
  return `${d.getMonth() + 1}/${d.getDate()}`;
}
function relShort(iso) {
  const now = Date.now(), then = new Date(iso).getTime();
  const s = Math.max(0, Math.round((now - then) / 1000));
  if (s < 60) return s <= 1 ? "now" : `${s}s`;
  const m = Math.floor(s / 60); if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60); if (h < 24) return `${h}h`;
  const d = new Date(iso), n = new Date();
  if (d.getFullYear() === n.getFullYear()) return `${d.getMonth() + 1}月${d.getDate()}日`;
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}

/* ---------- image compression ---------- */
function compressImage(file, maxSide = 1280, quality = 0.82) {
  const validationError = validateImageFile(file);
  if (validationError) return Promise.reject(new Error(validationError));
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      const img = new Image();
      img.onload = () => {
        try {
          let { width, height } = img;
          if (!width || !height) throw new Error("画像のサイズを読み取れませんでした。");
          if (file.type === "image/gif") {
            resolve({ src: r.result, w: width, h: height, contentType: file.type });
            return;
          }
          if (width > maxSide || height > maxSide) {
            const s = maxSide / Math.max(width, height);
            width = Math.round(width * s); height = Math.round(height * s);
          }
          const c = document.createElement("canvas");
          c.width = width; c.height = height;
          const context = c.getContext("2d");
          if (!context) throw new Error("この端末では画像を処理できませんでした。");
          context.drawImage(img, 0, 0, width, height);
          const contentType = imageOutputType(file.type);
          const src = c.toDataURL(contentType, quality);
          if (!src || src === "data:,") throw new Error("画像の変換に失敗しました。");
          resolve({ src, w: width, h: height, contentType });
        } catch (error) {
          reject(error);
        }
      };
      img.onerror = () => reject(new Error("この画像形式は端末で読み込めません。JPEG、PNG、WebP、GIFをお試しください。"));
      img.src = r.result;
    };
    r.onerror = () => reject(new Error("画像ファイルを読み込めませんでした。"));
    r.readAsDataURL(file);
  });
}

async function copyText(text) {
  try { if (navigator.clipboard && window.isSecureContext) { await navigator.clipboard.writeText(text); return true; } } catch (_) {}
  try {
    const ta = document.createElement("textarea");
    ta.value = text; ta.style.cssText = "position:fixed;opacity:0";
    document.body.appendChild(ta); ta.select(); document.execCommand("copy");
    document.body.removeChild(ta); return true;
  } catch (_) { return false; }
}

/* ---------- in-app confirm / alert (window.confirm is blocked in the sandbox) ---------- */
let _ask = null;
function ConfirmHost() {
  const [st, setSt] = useState(null);
  useEffect(() => { _ask = (o) => new Promise(res => setSt({ ...o, resolve: res })); return () => { _ask = null; }; }, []);
  if (!st) return null;
  const done = v => { const r = st.resolve; setSt(null); r(v); };
  return (
    <div className="overlay center" onClick={() => done(false)}>
      <div className="confirmBox" onClick={e => e.stopPropagation()}>
        <div className="confirmMsg">{st.message}</div>
        <div className="confirmBtns">
          {!st.okOnly && <button className="cfBtn" onClick={() => done(false)}>{st.cancelText || "キャンセル"}</button>}
          <button className={"cfBtn " + (st.danger ? "cfDanger" : "cfPrimary")} onClick={() => done(true)}>{st.okText || "OK"}</button>
        </div>
      </div>
    </div>
  );
}
const askConfirm = (message, o = {}) => _ask ? _ask({ message, ...o }) : Promise.resolve(true);
const askAlert = (message) => _ask ? _ask({ message, okOnly: true }) : Promise.resolve(true);

const isInteractivePress = target => Boolean(
  target?.closest?.("button,a,input,textarea,select,label,[role='button'],[contenteditable='true']")
);

/* ---------- native-feeling route / sheet gestures ---------- */
function RouteStage({ children, motion = "none", canGoBack = false, onBack, className = "" }) {
  const [drag, setDrag] = useState(0);
  const [settling, setSettling] = useState(false);
  const gesture = useRef({ active: false, axis: null, sx: 0, sy: 0, x: 0, t: 0, vx: 0, dx: 0 });
  const timer = useRef(null);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const onDown = e => {
    if (!canGoBack || e.clientX > 28 || settling || isInteractivePress(e.target)) return;
    gesture.current = { active: true, axis: null, captured: false, sx: e.clientX, sy: e.clientY, x: e.clientX, t: performance.now(), vx: 0, dx: 0 };
  };
  const onMove = e => {
    const g = gesture.current;
    if (!g.active) return;
    const dx = Math.max(0, e.clientX - g.sx), dy = e.clientY - g.sy;
    if (!g.axis) {
      if (Math.abs(dx) < 7 && Math.abs(dy) < 7) return;
      g.axis = Math.abs(dx) > Math.abs(dy) * 1.15 ? "x" : "y";
    }
    if (g.axis !== "x") return;
    if (!g.captured) {
      e.currentTarget.setPointerCapture?.(e.pointerId);
      g.captured = true;
    }
    const now = performance.now(), dt = Math.max(1, now - g.t);
    g.vx = (e.clientX - g.x) / dt;
    g.x = e.clientX; g.t = now;
    const width = window.innerWidth || 390;
    g.dx = Math.min(dx, width * .78);
    setDrag(g.dx);
  };
  const finish = () => {
    const g = gesture.current;
    if (!g.active) return;
    g.active = false;
    if (g.axis !== "x") { g.axis = null; return; }
    const shouldBack = g.dx > Math.min(92, (window.innerWidth || 390) * .24) || (g.dx > 34 && g.vx > .48);
    setSettling(true);
    setDrag(shouldBack ? (window.innerWidth || 390) : 0);
    timer.current = window.setTimeout(() => {
      setSettling(false);
      if (shouldBack) onBack?.();
    }, shouldBack ? 190 : 220);
    g.axis = null;
  };
  const progress = Math.min(1, drag / Math.max(1, window.innerWidth || 390));
  return (
    <div
      className={`routeStage motion-${motion}${drag ? " routeDragging" : ""}${settling ? " routeSettling" : ""}${className ? ` ${className}` : ""}`}
      style={{ transform: drag ? `translate3d(${drag}px,0,0)` : undefined, "--route-progress": progress }}
      onClick={e => e.stopPropagation()}
      onPointerDown={onDown} onPointerMove={onMove} onPointerUp={finish} onPointerCancel={finish}
    >
      {canGoBack && <span className="edgeBackCue" aria-hidden="true"><Back /></span>}
      {children}
    </div>
  );
}

function SwipeSheet({ children, onClose, className = "" }) {
  const [drag, setDrag] = useState(0);
  const [closing, setClosing] = useState(false);
  const gesture = useRef({ active: false, sy: 0, y: 0, t: 0, vy: 0, dy: 0 });
  const timer = useRef(null);
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { window.clearTimeout(timer.current); document.body.style.overflow = previous; };
  }, []);
  const dismiss = () => {
    if (closing) return;
    setClosing(true);
    setDrag(window.innerHeight || 900);
    timer.current = window.setTimeout(() => onClose?.(), 220);
  };
  const onDown = e => {
    if (closing || !e.target.closest?.(".sheetDragZone")) return;
    gesture.current = { active: true, sy: e.clientY, y: e.clientY, t: performance.now(), vy: 0, dy: 0 };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const onMove = e => {
    const g = gesture.current; if (!g.active) return;
    const now = performance.now(), dt = Math.max(1, now - g.t);
    g.vy = (e.clientY - g.y) / dt;
    g.y = e.clientY; g.t = now;
    g.dy = Math.max(0, e.clientY - g.sy);
    setDrag(g.dy);
  };
  const finish = () => {
    const g = gesture.current; if (!g.active) return;
    g.active = false;
    if (g.dy > 92 || (g.dy > 24 && g.vy > .52)) dismiss();
    else setDrag(0);
  };
  const sheet = (
    <div className={`overlay swipeOverlay${closing ? " closing" : ""}`} onClick={dismiss}>
      <div
        className={`sheet swipeSheet${closing ? " closing" : ""}${className ? ` ${className}` : ""}`}
        style={{ transform: drag ? `translate3d(0,${drag}px,0)` : undefined }}
        role="dialog" aria-modal="true" onClick={e => e.stopPropagation()}
        onPointerDown={onDown} onPointerMove={onMove} onPointerUp={finish} onPointerCancel={finish}
      >
        <div className="sheetDragZone">
          <div className="grab" />
        </div>
        {children}
      </div>
    </div>
  );
  return typeof document === "undefined" ? sheet : createPortal(sheet, document.body);
}

/* ---------- model ---------- */
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const newAccount = (name) => ({ id: uid(), name, handle: "", icon: "", bio: "", cover: "", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
const ALL_ID = "all";
const makeAll = () => ({ id: ALL_ID, isAll: true, name: "", handle: "", icon: "", bio: "すべての記録", cover: "", createdAt: new Date().toISOString() });
const blankBlocks = () => [{ id: uid(), type: "text", value: "" }];
const newEntry = (accountId) => ({
  id: uid(), accountId, createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(), blocks: blankBlocks(),
});
const entryPlainText = (e) =>
  e.blocks.filter(b => b.type === "text").map(b => b.value).join("\n\n").trim();
const entryHasImage = (e) => e.blocks.some(b => b.type === "image");
const entryHasQuote = (e) => e.blocks.some(b => b.type === "quote");
const entryEmpty = (e) => !entryPlainText(e) && !entryHasImage(e) && !entryHasQuote(e);

const quoteBlockFrom = (entry, acc) => {
  const firstImg = entry.blocks.find(b => b.type === "image");
  return {
    id: uid(), type: "quote", srcId: entry.id,
    name: accLabel(acc), handle: acc?.handle || "", icon: acc?.icon || "",
    text: entryPlainText(entry).slice(0, 220), img: firstImg ? firstImg.src : "",
    createdAt: entry.createdAt,
  };
};

const SEED_ACCOUNTS = [{ name: "", bio: "英語日記" }, { name: "", bio: "創作" }];
// display label: use name, else first line of bio, else fallback
const accLabel = (a) => (a?.name || "").trim() || ((a?.bio || "").split("\n")[0].trim()) || "ノート";

/* ============================================================ */
export default function App() {
  const [accounts, setAccounts, accLoaded, accountsError] = usePersisted("nb.accounts", []);
  const [entries, setEntries, entriesLoaded, entriesError] = usePersisted("nb.entries", []);
  const [currentId, setCurrentId, currentLoaded, currentError] = usePersisted("nb.current", "");

  const [view, setView] = useState("timeline"); // timeline | compose | accounts
  const viewRef = useRef("timeline");
  const routeStack = useRef([]);
  const [routeMotion, setRouteMotion] = useState("none");
  const [routeRevision, setRouteRevision] = useState(0);
  const [editId, setEditId] = useState(null);
  const [draft, setDraft] = useState(null);
  const [cpFor, setCpFor] = useState(null); // entry to add to a commonplace
  const [dayView, setDayView] = useState(null); // {date}
  const [secondaryLoad, setSecondaryLoad] = useState(false);
  const primaryLoaded = accLoaded && entriesLoaded;
  const secondaryEnabled = secondaryLoad || view === "commonplace" || Boolean(cpFor);
  const [collections, setCollections, collectionsLoaded, collectionsError] = usePersisted("nb.collections", [], { enabled: secondaryEnabled });
  const [icloud, setIcloud, icloudLoaded, icloudError] = usePersisted("nb.icloud", false, { enabled: secondaryLoad || view === "about" });

  const commitRoute = useCallback((next, motion) => {
    viewRef.current = next;
    setRouteMotion(motion);
    setRouteRevision(n => n + 1);
    setView(next);
  }, []);
  const navigate = useCallback((next, { tab = false, replace = false } = {}) => {
    const current = viewRef.current;
    if (current === next) return;
    if (tab) routeStack.current = [];
    else if (!replace) routeStack.current.push(current);
    commitRoute(next, tab ? "tab" : replace ? "back" : "forward");
  }, [commitRoute]);
  const goBack = useCallback((fallback = "timeline") => {
    const next = routeStack.current.pop() || fallback;
    commitRoute(next, "back");
  }, [commitRoute]);
  useEffect(() => {
    const onKeyDown = e => {
      if (e.key !== "Escape") return;
      if (cpFor) { setCpFor(null); return; }
      if (dayView) { setDayView(null); return; }
      if (routeStack.current.length > 0) {
        if (viewRef.current === "compose") setDraft(null);
        goBack("timeline");
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [cpFor, dayView, goBack]);

  const account = accounts.find(a => a.id === currentId)
    || accounts.find(a => !a.isAll)
    || accounts[0]
    || null;
  const accEntries = useMemo(
    () => (account?.isAll ? [...entries] : entries.filter(e => e.accountId === currentId))
      .sort((a, b) => a.createdAt < b.createdAt ? 1 : -1),
    [entries, currentId, account]
  );

  const upsert = useCallback(async (entry) => {
    const next = { ...entry, updatedAt: new Date().toISOString() };
    const result = await window.storage?.saveItem?.("nb.entries", next);
    if (result && !result.ok) return { ok: false, error: result.error };
    const stored = result?.item || next;
    setEntries(es => {
      const i = es.findIndex(e => e.id === stored.id);
      if (i === -1) return [stored, ...es];
      const copy = es.slice(); copy[i] = stored; return copy;
    });
    return { ok: true, item: stored };
  }, [setEntries]);
  const remove = useCallback(async (id) => {
    // 配列の欠落を削除扱いにしない。サーバーで1件のtombstoneが確定してから表示から外す。
    const result = await window.storage?.deleteItem?.("nb.entries", id);
    if (result && !result.ok) return false;
    setEntries(es => es.filter(e => e.id !== id));
    return true;
  }, [setEntries]);
  const patch = useCallback(async (id, p) => {
    const entry = entries.find(e => e.id === id);
    if (!entry) return false;
    const result = await upsert({ ...entry, ...p, updatedAt: new Date().toISOString() });
    return result.ok;
  }, [entries, upsert]);
  const [aboutBack, setAboutBack] = useState("accounts");
  const openAbout = (from) => { setAboutBack(from); navigate("about"); };
  const [auth, setAuth] = usePersisted("nb.auth", null, { autoSave: true });
  const [firebaseUser, setFirebaseUser] = useState(undefined);
  const [authBusy, setAuthBusy] = useState(false);
  const [syncStatus, setSyncStatus] = useState("loading");
  const [syncMessage, setSyncMessage] = useState("");
  const writeReady = !isGoogleUser(firebaseUser) || ["background", "connected", "partial"].includes(syncStatus);

  useEffect(() => subscribeToFirebaseUser(setFirebaseUser), []);
  useEffect(() => {
    const onStatus = (event) => {
      setSyncStatus(event.detail.status);
      setSyncMessage(event.detail.message || "");
    };
    window.addEventListener("loof:sync-status", onStatus);
    return () => window.removeEventListener("loof:sync-status", onStatus);
  }, []);
  useEffect(() => {
    if (!primaryLoaded) return undefined;
    const timer = window.setTimeout(() => setSecondaryLoad(true), 1200);
    return () => window.clearTimeout(timer);
  }, [primaryLoaded]);
  const saveStoredItem = useCallback(async (key, item) => {
    const result = await window.storage?.saveItem?.(key, item);
    if (result && !result.ok) return { ok: false, item, error: result.error };
    return { ok: true, item: result?.item || item };
  }, []);
  const saveStoredPreference = useCallback(async (key, value) => {
    try {
      await window.storage?.set?.(key, JSON.stringify(value));
      return true;
    } catch (_) {
      return false;
    }
  }, []);
  const setCurrentIdPersisted = useCallback((next) => {
    setCurrentId(previous => {
      const resolved = typeof next === "function" ? next(previous) : next;
      void saveStoredPreference("nb.current", resolved);
      return resolved;
    });
  }, [saveStoredPreference, setCurrentId]);
  const setIcloudPersisted = useCallback((next) => {
    setIcloud(previous => {
      const resolved = typeof next === "function" ? next(previous) : next;
      void saveStoredPreference("nb.icloud", resolved);
      return resolved;
    });
  }, [saveStoredPreference, setIcloud]);

  // seed default accounts on first run
  useEffect(() => {
    // 起動を止めないため、現在選択中のノート設定は後から来てもよい。
    if (!accLoaded) return;
    if (accounts.length === 0) {
      const seeded = SEED_ACCOUNTS.map(s => ({ ...newAccount(s.name), bio: s.bio }));
      setAccounts([makeAll(), ...seeded]);
      seeded.forEach(account => { void saveStoredItem("nb.accounts", account); });
      setCurrentIdPersisted(seeded[0].id);
      return;
    }
    if (!accounts.find(a => a.isAll)) {
      setAccounts(as => [makeAll(), ...as.filter(a => !a.isAll)]);
    }
    if (currentLoaded && !accounts.find(a => a.id === currentId)) {
      setCurrentIdPersisted((accounts.find(a => !a.isAll) || accounts[0]).id);
    }
  }, [accLoaded, currentLoaded]); // eslint-disable-line

  useEffect(() => {
    if (!firebaseUser) return;
    // Googleの認証状態を正とし、端末に残った過去のログイン状態は引き継がない。
    if (isGoogleUser(firebaseUser) && auth?.mode !== "google") {
      setAuth({ mode: "google", at: Date.now() });
    } else if (!isGoogleUser(firebaseUser) && auth?.mode === "google") {
      setAuth(null);
    }
  }, [firebaseUser, auth, setAuth]);

  const beginGuest = async () => {
    setAuthBusy(true);
    try {
      await getFirebaseUser();
      setAuth({ mode: "guest", at: Date.now() });
    } catch (_) {
      // Firebase が一時的に利用できなくても、端末保存のノートとして開けるようにする。
      setAuth({ mode: "guest", at: Date.now() });
    } finally {
      setAuthBusy(false);
    }
  };

  const beginGoogle = async () => {
    setAuthBusy(true);
    try {
      await signInWithGoogle();
      const nextAuth = { mode: "google", at: Date.now() };
      // ログイン前のPWA/ゲスト状態はGoogleの記録に混ぜず、必ずサーバー先読みの新セッションで開く。
      window.localStorage.setItem("nb.auth", JSON.stringify(nextAuth));
      window.location.reload();
    } catch (error) {
      if (error.code !== "auth/popup-closed-by-user") {
        const detail = error.code === "auth/unauthorized-domain"
          ? "Firebase Console の Authentication で、この Vercel ドメインを承認済みドメインに追加してください。"
          : "Google ログインに失敗しました。Firebase の Google ログイン設定を確認して、もう一度お試しください。";
        await askAlert(detail);
      }
    } finally {
      setAuthBusy(false);
    }
  };

  const logout = async () => {
    setAuthBusy(true);
    try {
      await signOutFirebaseUser();
      setAuth(null);
      routeStack.current = [];
      commitRoute("timeline", "back");
    } catch (_) {
      await askAlert("ログアウトできませんでした。もう一度お試しください。");
    } finally {
      setAuthBusy(false);
    }
  };

  const realFirst = () => accounts.find(a => !a.isAll) || account;
  const explainSyncWait = () => { void askAlert("最新の記録を確認中です。同期が終わるまで閲覧のみ利用できます。"); };
  const startCompose = () => {
    if (!writeReady) { explainSyncWait(); return; }
    setEditId(null); setDraft(account?.isAll ? newEntry(realFirst().id) : null); navigate("compose");
  };
  const openEntry = (id) => {
    if (!writeReady) { explainSyncWait(); return; }
    setDraft(null); setEditId(id); navigate("compose");
  };
  const quote = (entry) => {
    if (!writeReady) { explainSyncWait(); return; }
    const acc = accounts.find(a => a.id === entry.accountId) || account;
    const target = account?.isAll ? realFirst().id : currentId;
    setDraft({ ...newEntry(target), blocks: [{ id: uid(), type: "text", value: "" }, quoteBlockFrom(entry, acc)] });
    setEditId(null); navigate("compose");
  };
  const saveAccount = async (acc) => {
    const next = { ...acc, updatedAt: new Date().toISOString() };
    const result = await saveStoredItem("nb.accounts", next);
    if (!result.ok) {
      console.error(`[loof profile] save-result-failed accountId=${next.id} message=${result.error?.message || String(result.error || "保存に失敗しました")}`);
      await askAlert(storageErrorMessage(result.error, "プロフィールを保存できませんでした。もう一度お試しください。"));
      return false;
    }
    const stored = result.item;
    setAccounts(as => as.map(a => a.id === stored.id ? { ...a, ...stored } : a));
    return true;
  };
  const addToCollection = (colId, entryId) =>
    setCollections(cs => {
      let changed = null;
      const next = cs.map(c => {
        if (c.id !== colId) return c;
        changed = { ...c, itemIds: [...new Set([...(c.itemIds || []), entryId])], updatedAt: new Date().toISOString() };
        return changed;
      });
      if (changed) void saveStoredItem("nb.collections", changed);
      return next;
    });
  const createCollection = (name, query = "") => {
    const c = { id: uid(), name: name.trim() || "コモンプレイス", query: query.trim(), itemIds: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    void saveStoredItem("nb.collections", c);
    setCollections(cs => [c, ...cs]); return c;
  };

  const editing = editId ? entries.find(e => e.id === editId) : null;

  // Firestoreの読み込み完了ではなく、Firebase Authenticationの実際の状態で判断する。
  const loggedInWithGoogle = isGoogleUser(firebaseUser);
  // 匿名認証がオフラインで失敗しても、明示的に選んだゲストモードは端末保存で開ける。
  const usingGuestMode = auth?.mode === "guest" && !loggedInWithGoogle;
  if (!loggedInWithGoogle && !usingGuestMode) return (
    <div style={S.root} className="root">
      <style>{CSS}</style>
      <ConfirmHost />
      <Login
        onGoogle={beginGoogle}
        onGuest={beginGuest}
        busy={authBusy}
      />
    </div>
  );

  const initialLoadError = accountsError || entriesError;
  if (loggedInWithGoogle && initialLoadError) return (
    <div style={S.root} className="root">
      <style>{CSS}</style>
      <ConfirmHost />
      <div className="syncError">
        <div className="syncErrorTitle">Firestore に接続できません</div>
        <div className="syncErrorText">{initialLoadError?.message || syncMessage || "Firebase Consoleで Firestore Database とルールを確認してから、もう一度開いてください。"}</div>
        <button className="primary" onClick={() => window.location.reload()}>再読み込み</button>
      </div>
    </div>
  );

  const dataReady = primaryLoaded;
  // entries の初回サーバー読み込みが終わる前に編集できると、遅れて届いた初期一覧が新規投稿を戻してしまう。
  if (!dataReady || !account) return <div style={S.root}><style>{CSS}</style><ConfirmHost /><div style={{padding:40,color:SUB}}>Firestoreから記録を復元中…</div></div>;

  return (
    <div style={S.root} className="root">
      <style>{CSS}</style>
      <ConfirmHost />
      {loggedInWithGoogle && syncStatus !== "connected" && (
        <div className={`syncPill${syncStatus === "partial" || syncStatus === "error" ? " warn" : ""}`}>
          {syncStatus === "background"
            ? "☁ 過去の記録を読み込み中…"
            : syncStatus === "partial"
              ? "☁ 一部の履歴を同期できません"
              : syncStatus === "error"
                ? "☁ 同期できません"
                : "☁ 最新の記録を確認中（閲覧のみ）"}
        </div>
      )}

      <Navigation
        account={account}
        view={view}
        onTimeline={() => navigate("timeline", { tab: true })}
        onProfile={() => navigate("profile", { tab: true })}
        onCommonplace={() => navigate("commonplace", { tab: true })}
        onAccounts={() => navigate("accounts", { tab: true })}
        onCompose={startCompose}
        writeReady={writeReady}
      />

      <div className="mainCol">
      <RouteStage
        key={routeRevision}
        motion={routeMotion}
        canGoBack={routeStack.current.length > 0 && !dayView && !cpFor}
        onBack={() => { if (view === "compose") setDraft(null); goBack("timeline"); }}
      >
      {view === "timeline" && (
        <Timeline
          account={account}
          accounts={accounts}
          entries={accEntries}
          onCompose={startCompose}
          writeReady={writeReady}
          onOpen={openEntry}
          onPatch={patch}
          onPostDelete={remove}
          onQuote={quote}
          onAddCommonplace={setCpFor}
          onSwitch={() => navigate("accounts")}
          onProfile={() => navigate("profile")}
          onCommonplace={() => navigate("commonplace")}
          onCopyDay={(items) => copyText(items.map(entryPlainText).filter(Boolean).join("\n\n— — —\n\n"))}
        />
      )}

      {view === "compose" && (
        <Composer
          key={editing ? editing.id : (draft ? draft.id : "new")}
          accounts={accounts}
          initial={editing || draft || newEntry(currentId)}
          isNew={!editing}
          onSave={async (e) => {
            if (entryEmpty(e)) { setDraft(null); goBack("timeline"); return true; }
            const result = await upsert(e);
            if (result.ok) { setDraft(null); goBack("timeline"); }
            return result;
          }}
          onCancel={() => { setDraft(null); goBack("timeline"); }}
          onDelete={editing ? async () => { if (await remove(editing.id)) goBack("timeline"); } : null}
          onCopy={(e) => copyText(entryPlainText(e))}
        />
      )}

      {view === "accounts" && (
        <Accounts
          accounts={accounts} setAccounts={setAccounts}
          currentId={currentId} setCurrentId={setCurrentIdPersisted}
          entries={entries} setEntries={setEntries}
          onProfile={() => navigate("profile", { tab: true })}
          onAbout={() => openAbout("accounts")}
          onClose={() => goBack("timeline")}
        />
      )}

      {view === "about" && (
        <About icloud={icloud} setIcloud={setIcloudPersisted} user={firebaseUser} onGoogle={beginGoogle} onLogout={logout} busy={authBusy} onClose={() => goBack(aboutBack)} />
      )}

      {view === "profile" && (
        <Profile
          account={account}
          accounts={accounts}
          entries={accEntries}
          onSave={saveAccount}
          onOpen={openEntry}
          onAbout={() => openAbout("profile")}
          onPatch={patch} onPostDelete={remove} onQuote={quote} onAddCommonplace={setCpFor}
          onClose={() => goBack("timeline")}
        />
      )}

      {view === "commonplace" && (
        <Commonplace
          accounts={accounts} entries={entries} collections={collections} setCollections={setCollections}
          onCreate={createCollection}
          onOpenEntry={openEntry} onPatch={patch} onPostDelete={remove} onQuote={quote} onAddCommonplace={setCpFor}
          onOpenDay={(date) => setDayView({ date })}
          onClose={() => goBack("timeline")}
        />
      )}
      </RouteStage>
      </div>

      <Sidebar account={account} entries={account?.isAll ? entries : entries.filter(e => e.accountId === currentId)} allEntries={entries} onOpenEntry={openEntry} />

      {view !== "compose" && (
        <MobileNavigation
          view={view}
          onTimeline={() => navigate("timeline", { tab: true })}
          onProfile={() => navigate("profile", { tab: true })}
          onCommonplace={() => navigate("commonplace", { tab: true })}
          onAccounts={() => navigate("accounts", { tab: true })}
        />
      )}

      {dayView && (
        <DayView
          date={dayView.date} accounts={accounts} entries={entries} currentId={currentId}
          onOpenEntry={(id) => { setDayView(null); openEntry(id); }}
          onPatch={patch} onPostDelete={remove} onQuote={quote} onAddCommonplace={setCpFor}
          onClose={() => setDayView(null)}
        />
      )}

      {cpFor && (
        <CommonplacePicker
          entry={cpFor} collections={collections}
          onAdd={(colId) => { addToCollection(colId, cpFor.id); setCpFor(null); }}
          onCreate={(name) => { const c = createCollection(name); addToCollection(c.id, cpFor.id); setCpFor(null); }}
          onClose={() => setCpFor(null)}
        />
      )}
    </div>
  );
}

/* ============================================================
   TIMELINE — day-grouped thread
   ============================================================ */
function Timeline({ account, accounts, entries, onCompose, writeReady, onOpen, onPatch, onPostDelete, onQuote, onAddCommonplace, onSwitch, onProfile, onCommonplace, onCopyDay }) {
  const [q, setQ] = useState("");
  const [jumpDate, setJumpDate] = useState(null);
  const [showAll, setShowAll] = useState(false);
  const dateRef = useRef(null);
  const acctFor = e => account?.isAll ? (accounts.find(a => a.id === e.accountId) || account) : account;
  const filtered = useMemo(() => {
    if (!q.trim()) return entries;
    const k = q.trim().toLowerCase();
    return entries.filter(e => entryPlainText(e).toLowerCase().includes(k));
  }, [entries, q]);

  const days = useMemo(() => {
    const map = {};
    filtered.forEach(e => { const d = e.createdAt.slice(0, 10); (map[d] ||= []).push(e); });
    return Object.keys(map).sort().reverse().map(date => ({
      date,
      items: map[date].sort((a, b) => a.createdAt < b.createdAt ? -1 : 1), // oldest→newest within a day
    }));
  }, [filtered]);
  const allItems = useMemo(
    () => [...filtered].sort((a, b) => a.createdAt < b.createdAt ? 1 : -1),
    [filtered]
  );
  const mediaCount = useMemo(() => entries.reduce((n, e) => n + e.blocks.filter(b => b.type === "image").length, 0), [entries]);
  const switchMode = next => {
    if (showAll === next) return;
    setShowAll(next);
    navigator.vibrate?.(4);
  };

  return (
    <div className="screen">
      <header className="topbar">
        <button className="avatarBtn mobileOnly" onClick={onProfile} aria-label="プロフィール"><Avatar account={account} size={32} /></button>
        <button className="acctBtn mobileOnly" onClick={onSwitch}>
          <span className="acctName">{accLabel(account)}</span>
          <Chevron />
        </button>
        <button className="timelineHeading desktopOnly" onClick={onSwitch}>
          <span>{accLabel(account)}</span>
          <small>{entries.length}件の記録</small>
        </button>
        <button className="iconBtn" onClick={onCommonplace} aria-label="コモンプレイス"><Layers /></button>
      </header>

      <div className="tlProfile">
        <div className="tlCover" style={account.cover ? { backgroundImage: `url(${account.cover})` } : null} />
        <div className="tlProfBody">
          <div className="tlProfRow1">
            <button className="tlAvatarWrap" onClick={onProfile} aria-label="プロフィール"><Avatar account={account} size={66} /></button>
            <button className="tlEditBtn" onClick={onProfile}>プロフィール</button>
          </div>
          <div className="tlProfName">{accLabel(account)} <Lock /></div>
          {account.handle && <div className="tlProfHandle">@{account.handle}</div>}
          {account.bio && <div className="tlProfBio">{account.bio}</div>}
          <div className="tlProfJoined"><Cal /> {new Date(account.createdAt).getFullYear()}年{new Date(account.createdAt).getMonth() + 1}月から</div>
          <div className="tlProfStats"><b>{entries.length}</b> ポスト <b>{mediaCount}</b> メディア</div>
        </div>
      </div>

      <nav className="timelineTabs" aria-label="タイムライン表示">
        <button className={!showAll ? "on" : ""} onClick={() => switchMode(false)} aria-selected={!showAll}><span>日ごと</span></button>
        <button className={showAll ? "on" : ""} onClick={() => switchMode(true)} aria-selected={showAll}><span>すべて</span></button>
      </nav>

      <div className="searchWrap">
        <div className="search">
          <SearchIcon />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="ポストを検索" aria-label="ポストを検索" />
          {q && <button className="clr" onClick={() => setQ("")}>✕</button>}
        </div>
        <label className="dateBtn" aria-label="日付で移動">
          <Cal />
          <input type="date" className="dateInput" onChange={e => { if (e.target.value) setJumpDate({ date: e.target.value, n: Date.now() }); }} />
        </label>
      </div>

      <div className="timelineContent" key={showAll ? "all" : q.trim() ? "search" : "days"}>
      {showAll ? (
        <main className="feed allPostsFeed">
          <div className="allPostsHead">
            <span>すべての記録</span>
            <div className="allPostsTools">
              <span>{allItems.length}件</span>
              {allItems.length > 0 && <button className="dayCopy" onClick={() => onCopyDay(allItems)}>表示中をコピー</button>}
            </div>
          </div>
          {allItems.length === 0
            ? <div className="empty">{q.trim() ? "見つかりませんでした。" : "まだ何もありません。"}</div>
            : allItems.map(e => <PostCard key={e.id} entry={e} account={acctFor(e)} onOpen={onOpen} onPatch={onPatch} onDelete={onPostDelete} onQuote={onQuote} onAddCommonplace={onAddCommonplace} />)}
          <div style={{ height: 96 }} />
        </main>
      ) : q.trim() ? (
        <main className="feed">
          {days.length === 0
            ? <div className="empty">見つかりませんでした。</div>
            : days.map(d => (
              <section className="day" key={d.date}>
                <div className="dayHead">
                  <div>
                    <div className="dayBig">{fmtDayHead(d.date).big}</div>
                    <div className="daySub">{fmtDayHead(d.date).sub}</div>
                  </div>
                  <button className="dayCopy" onClick={() => onCopyDay(d.items)}>1日分をコピー</button>
                </div>
                <div className="thread">
                  {d.items.map(e => <PostCard key={e.id} entry={e} account={acctFor(e)} onOpen={onOpen} onPatch={onPatch} onDelete={onPostDelete} onQuote={onQuote} onAddCommonplace={onAddCommonplace} />)}
                </div>
              </section>
            ))}
          <div style={{ height: 96 }} />
        </main>
      ) : days.length === 0 ? (
        <main className="feed">
          <div className="empty">
            まだ何もありません。<br />ポストボタンから書きはじめましょう。
          </div>
        </main>
      ) : (
        <DayPager days={days} acctFor={acctFor} jumpDate={jumpDate} onOpen={onOpen} onCopyDay={onCopyDay} onPatch={onPatch} onPostDelete={onPostDelete} onQuote={onQuote} onAddCommonplace={onAddCommonplace} />
      )}
      </div>

      <button className="fab" onClick={onCompose} disabled={!writeReady} aria-label={writeReady ? "書く" : "同期完了後に書くことができます"}><Plus /></button>
    </div>
  );
}

/* ---------- swipeable day pager ---------- */
function DayPager({ days, acctFor, jumpDate, onOpen, onCopyDay, onPatch, onPostDelete, onQuote, onAddCommonplace }) {
  const wrapRef = useRef(null);
  const [w, setW] = useState(0);
  const [index, setIndex] = useState(0);
  const [drag, setDrag] = useState(0);
  const [anim, setAnim] = useState(true);
  const g = useRef({ down: false, sx: 0, sy: 0, axis: null, x: 0, t: 0, vx: 0, dx: 0 });

  useEffect(() => {
    const el = wrapRef.current; if (!el) return;
    const upd = () => setW(el.clientWidth);
    upd();
    const ro = new ResizeObserver(upd); ro.observe(el);
    return () => ro.disconnect();
  }, []);
  useEffect(() => { if (index > days.length - 1) setIndex(Math.max(0, days.length - 1)); }, [days.length]); // eslint-disable-line
  useEffect(() => {
    if (!jumpDate) return;
    const d = jumpDate.date;
    let idx = days.findIndex(x => x.date === d);
    if (idx < 0) idx = days.findIndex(x => x.date <= d); // days sorted newest→oldest
    if (idx < 0) idx = days.length - 1;
    setAnim(true); setIndex(Math.max(0, Math.min(days.length - 1, idx)));
  }, [jumpDate]); // eslint-disable-line

  const clamp = i => Math.max(0, Math.min(days.length - 1, i));
  const go = i => { setAnim(true); setIndex(c => clamp(typeof i === "function" ? i(c) : i)); };

  const onDown = e => {
    if ((e.button != null && e.button !== 0) || isInteractivePress(e.target)) {
      g.current.down = false;
      return;
    }
    g.current = { down: true, captured: false, sx: e.clientX, sy: e.clientY, axis: null, x: e.clientX, t: performance.now(), vx: 0, dx: 0 };
    setAnim(false);
  };
  const onMove = e => {
    const s = g.current; if (!s.down) return;
    let dx = e.clientX - s.sx; const dy = e.clientY - s.sy;
    if (!s.axis) {
      if (Math.abs(dx) > 7 || Math.abs(dy) > 7) s.axis = Math.abs(dx) > Math.abs(dy) * 1.12 ? "x" : "y";
      else return;
    }
    if (s.axis === "y") return;
    if (!s.captured) {
      e.currentTarget.setPointerCapture?.(e.pointerId);
      s.captured = true;
    }
    const now = performance.now(), dt = Math.max(1, now - s.t);
    s.vx = (e.clientX - s.x) / dt;
    s.x = e.clientX; s.t = now;
    if ((index === 0 && dx > 0) || (index === days.length - 1 && dx < 0)) dx *= .28;
    s.dx = dx;
    setDrag(dx);
  };
  const end = () => {
    const s = g.current; if (!s.down) return; s.down = false; setAnim(true);
    let changed = false;
    if (s.axis === "x") {
      const th = Math.max(42, w * 0.14);
      if ((s.dx <= -th || (s.dx < -24 && s.vx < -.42)) && index < days.length - 1) { setIndex(i => clamp(i + 1)); changed = true; }
      else if ((s.dx >= th || (s.dx > 24 && s.vx > .42)) && index > 0) { setIndex(i => clamp(i - 1)); changed = true; }
    }
    if (changed) navigator.vibrate?.(5);
    setDrag(0); s.axis = null;
  };

  if (!days.length) return null;
  const cur = days[index] || days[0];
  const tx = -(index * w) + drag;

  return (
    <div className="pager" ref={wrapRef}>
      <div className="pagerHead">
        <button className="navArrow" disabled={index <= 0} onClick={() => go(i => i - 1)} aria-label="新しい日へ"><Back /></button>
        <div className="pagerDate">
          <div className="pgBig">{fmtDayHead(cur.date).big}</div>
          <div className="pgSub">{fmtDayHead(cur.date).sub} ・ {cur.items.length}件</div>
        </div>
        <button className="navArrow flip" disabled={index >= days.length - 1} onClick={() => go(i => i + 1)} aria-label="古い日へ"><Back /></button>
      </div>

      <div
        className="track"
        style={{ transform: `translate3d(${tx}px,0,0)`, transition: anim ? "transform .28s cubic-bezier(.2,.8,.2,1)" : "none" }}
        onPointerDown={onDown} onPointerMove={onMove} onPointerUp={end} onPointerCancel={end}
      >
        {days.map(d => (
          <div className="page" key={d.date}>
            <div className="pageScroll">
              <div className="pageCopyRow"><button className="dayCopy" onClick={() => onCopyDay(d.items)}>この日をコピー</button></div>
              {d.items.map(e => <PostCard key={e.id} entry={e} account={acctFor(e)} onOpen={onOpen} onPatch={onPatch} onDelete={onPostDelete} onQuote={onQuote} onAddCommonplace={onAddCommonplace} />)}
              <div style={{ height: 110 }} />
            </div>
          </div>
        ))}
      </div>

      <div className="dots">
        {days.length <= 14
          ? days.map((d, i) => <button key={d.date} className={"dot" + (i === index ? " on" : "")} onClick={() => go(i)} aria-label={`${fmtDayHead(d.date).big}へ移動`} aria-current={i === index ? "date" : undefined} />)
          : <span className="dotCount">{index + 1} / {days.length}</span>}
      </div>
    </div>
  );
}

function QuoteCard({ b, onRemove }) {
  return (
    <div className="quoteCard" onClick={e => e.stopPropagation()}>
      {onRemove && <button className="qDel" onClick={onRemove} aria-label="引用を外す">✕</button>}
      <div className="quoteHead">
        <span className="qAvatar"><Avatar account={{ name: b.name, handle: b.handle, icon: b.icon }} size={18} /></span>
        <span className="qName">{b.name || "記録"}</span>
        {b.handle && <span className="qHandle">@{b.handle}</span>}
        <span className="qDot">·</span>
        <span className="qTime">{relShort(b.createdAt)}</span>
      </div>
      {b.text && <div className="qText">{b.text}</div>}
      {b.img && <img className="qImg" src={b.img} alt="" loading="lazy" />}
    </div>
  );
}

function PostCard({ entry, account, onOpen, onPatch, onDelete, onQuote, onAddCommonplace, onOpenDay }) {
  const [menu, setMenu] = useState(null); // 'kebab' | 'rt' | null
  const close = () => setMenu(null);
  const liked = !!entry.liked, booked = !!entry.bookmarked, rt = !!entry.reposted;
  const stop = e => e.stopPropagation();

  return (
    <article className="xpost" onClick={() => onOpen(entry.id)}>
      <div className="xAvatar"><Avatar account={account} size={44} /></div>
      <div className="xMain">
        <div className="xHead">
          <span className="xName">{accLabel(account)}</span>
          <Lock />
          {account.handle && <span className="xHandle">@{account.handle}</span>}
          <span className="xDot">·</span>
          {onOpenDay
            ? <button className="xTime asLink" onClick={e => { e.stopPropagation(); onOpenDay(entry.createdAt.slice(0, 10)); }}>{relShort(entry.createdAt)}</button>
            : <span className="xTime">{relShort(entry.createdAt)}</span>}
          <span className="xHeadRight" onClick={stop}>
            <button className="xIcon" onClick={() => setMenu(menu === "kebab" ? null : "kebab")} aria-label="メニュー"><Dots /></button>
            {menu === "kebab" && (<>
              <div className="menuBackdrop" onClick={close} />
              <div className="menu kebabMenu">
                <button className="menuItem" onClick={() => { close(); onOpen(entry.id); }}><Pencil /> 編集</button>
                {onAddCommonplace && <button className="menuItem" onClick={() => { close(); onAddCommonplace(entry); }}><BookmarkPlus /> コモンプレイスに追加</button>}
                <button className="menuItem danger" onClick={async () => { close(); if (await askConfirm("この投稿を削除しますか？", { danger: true, okText: "削除" })) onDelete(entry.id); }}><Trash /> 削除</button>
              </div>
            </>)}
          </span>
        </div>

        <div className="xBody">
          {entry.blocks.map(b =>
            b.type === "text" ? (b.value.trim() ? <p key={b.id} className="xText">{b.value.trim()}</p> : null)
              : b.type === "image" ? <img key={b.id} className="xImg" src={b.src} alt="" loading="lazy" />
              : <QuoteCard key={b.id} b={b} />
          )}
          {entryEmpty(entry) && <p className="xText faint">（空のメモ）</p>}
        </div>

        <div className="xActions" onClick={stop}>
          <button className="xAct comment" aria-label="返信"><Comment /></button>
          <div className="xActWrap">
            <button className={"xAct" + (rt ? " rt" : "")} onClick={() => setMenu(menu === "rt" ? null : "rt")} aria-label="リポスト">
              <Retweet />{rt && <span className="xCnt">1</span>}
            </button>
            {menu === "rt" && (<>
              <div className="menuBackdrop" onClick={close} />
              <div className="menu rtMenu">
                <button className="menuItem" onClick={() => { close(); onPatch(entry.id, { reposted: !rt }); }}>
                  <Retweet /> {rt ? "リポストを取り消す" : "リポスト"}
                </button>
                <button className="menuItem" onClick={() => { close(); onQuote(entry); }}><Pencil /> 引用</button>
              </div>
            </>)}
          </div>
          <button className={"xAct" + (liked ? " like" : "")} onClick={() => onPatch(entry.id, { liked: !liked })} aria-label="いいね">
            {liked ? <HeartFill /> : <Heart />}{liked && <span className="xCnt">1</span>}
          </button>
          <button className="xAct views" aria-label="表示回数"><Views /></button>
          <span className="xSpacer" />
          <button className={"xAct" + (booked ? " bm" : "")} onClick={() => onPatch(entry.id, { bookmarked: !booked })} aria-label="ブックマーク">
            {booked ? <BookmarkFill /> : <Bookmark />}
          </button>
          <button className="xAct share" onClick={() => copyText(entryPlainText(entry))} aria-label="共有"><Share /></button>
        </div>
      </div>
    </article>
  );
}

/* ============================================================
   COMPOSER — block editor with inline images, edit in place
   ============================================================ */
function Composer({ accounts, initial, isNew, onSave, onCancel, onDelete, onCopy }) {
  const [blocks, setBlocks] = useState(initial.blocks?.length ? initial.blocks : blankBlocks());
  const [acctId, setAcctId] = useState(initial.accountId);
  const [pickAcct, setPickAcct] = useState(false);
  const [focusIdx, setFocusIdx] = useState(0);
  const fileRef = useRef(null);
  const toastTimer = useRef(null);
  const [toast, setToast] = useState("");
  const [saving, setSaving] = useState(false);
  const [imageBusy, setImageBusy] = useState(false);
  const [imageStatus, setImageStatus] = useState("");
  const account = accounts.find(a => a.id === acctId) || accounts[0];
  const canPost = blocks.some(b => b.type === "image" || b.type === "quote" || (b.type === "text" && b.value.trim()));

  useEffect(() => () => window.clearTimeout(toastTimer.current), []);
  const showToast = (m, duration = 3600) => {
    window.clearTimeout(toastTimer.current);
    setToast(m);
    toastTimer.current = window.setTimeout(() => setToast(""), duration);
  };

  const setText = (id, value) =>
    setBlocks(bs => bs.map(b => b.id === id ? { ...b, value } : b));

  const setCaption = (id, caption) =>
    setBlocks(bs => bs.map(b => b.id === id ? { ...b, caption } : b));

  const removeBlock = (id) =>
    setBlocks(bs => {
      const next = bs.filter(b => b.id !== id);
      return next.some(b => b.type === "text") ? next : [...next, { id: uid(), type: "text", value: "" }];
    });

  // insert image(s) after the currently focused block; keep a trailing text block
  const addImages = async (fileList) => {
    if (imageBusy) return;
    const remaining = Math.max(0, 20 - blocks.filter(block => block.type === "image").length);
    const files = [...fileList].slice(0, Math.min(8, remaining));
    if (!files.length) {
      showToast("画像は1つの投稿につき20枚までです。");
      return;
    }
    const made = [];
    const failures = [];
    setImageBusy(true);
    for (let index = 0; index < files.length; index += 1) {
      const file = files[index];
      setImageStatus(`画像を処理中… ${index + 1}/${files.length}`);
      try {
        const r = await compressImage(file);
        made.push({ id: uid(), type: "image", src: r.src, w: r.w, h: r.h, caption: "" });
      } catch (error) {
        failures.push(`${file.name || `画像${index + 1}`}: ${error?.message || "読み込めませんでした"}`);
      }
    }
    if (made.length) {
      setBlocks(bs => {
        const at = Math.min(Math.max(focusIdx, 0), bs.length - 1);
        const head = bs.slice(0, at + 1);
        const tail = bs.slice(at + 1);
        let next = [...head, ...made, ...tail];
        if (next[next.length - 1].type !== "text")
          next = [...next, { id: uid(), type: "text", value: "" }];
        return next;
      });
    }
    setImageBusy(false);
    setImageStatus("");
    if (failures.length) showToast(failures.slice(0, 2).join("\n"));
  };

  const onPick = (e) => { const files = [...(e.target.files || [])]; e.target.value = ""; if (files.length) void addImages(files); };

  const handlePaste = (e) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    const imgs = [...items].filter(it => it.type.startsWith("image/")).map(it => it.getAsFile()).filter(Boolean);
    if (imgs.length) { e.preventDefault(); void addImages(imgs); }
  };

  const save = async () => {
    if (saving || imageBusy) return;
    const trimmed = blocks
      .filter((b, i) => !(b.type === "text" && !b.value.trim()) || blocks.filter(x => x.type === "text").length === 1)
      .map(b => b.type === "text" ? { ...b, value: b.value.replace(/\s+$/,"") } : b);
    setSaving(true);
    let saved = false;
    let saveError;
    try {
      const result = await onSave({ ...initial, accountId: acctId, blocks: trimmed.length ? trimmed : blankBlocks(), updatedAt: new Date().toISOString() });
      saved = result === true || result?.ok === true;
      saveError = result?.error;
    } catch (error) {
      saved = false;
      saveError = error;
      console.error("[loof entry] save-failed", error);
    }
    if (!saved) {
      setSaving(false);
      showToast(storageErrorMessage(saveError));
    }
  };

  return (
    <div className="screen compose">
      <header className="topbar compTop">
        <button className="txtbtn composeCancel" onClick={onCancel}>キャンセル</button>
        <span style={{ flex: 1 }} />
        <button className="postBtn" disabled={saving || imageBusy || !canPost} onClick={save}>{imageBusy ? "画像処理中…" : saving ? "送信中…" : "ポスト"}</button>
      </header>

      <main className="editor" onPaste={handlePaste}>
        {!isNew && (
          <div className="editMeta">
            {new Date(initial.createdAt).getFullYear()}年{fmtDayHead(initial.createdAt.slice(0,10)).big} {fmtTime(initial.createdAt)} の記録を編集中
          </div>
        )}
        <div className="composeRow">
          <button className="composeAvatar" onClick={() => setPickAcct(true)} aria-label="保存先のノート"><Avatar account={account} size={44} /></button>
          <div className="composeCol">
            <button className="audience" onClick={() => setPickAcct(true)}>{accLabel(account)}<Chevron /></button>
            {blocks.map((b, i) => b.type === "text" ? (
              <AutoTextarea
                key={b.id}
                value={b.value}
                placeholder={i === 0 ? "いまどうしてる？" : "つづきを書く…"}
                onChange={v => setText(b.id, v)}
                onFocus={() => setFocusIdx(i)}
              />
            ) : b.type === "quote" ? (
              <QuoteCard key={b.id} b={b} onRemove={() => removeBlock(b.id)} />
            ) : (
              <figure className="imgBlock" key={b.id} onClick={() => setFocusIdx(i)}>
                <img src={b.src} alt="" />
                <button className="imgDel" onClick={() => removeBlock(b.id)} aria-label="画像を削除"><Trash /></button>
                <input
                  className="caption"
                  value={b.caption || ""}
                  placeholder="キャプション（任意）"
                  onChange={e => setCaption(b.id, e.target.value)}
                  onFocus={() => setFocusIdx(i)}
                />
              </figure>
            ))}
          </div>
        </div>
        <div style={{ height: 120 }} />
      </main>

      <div className="toolbar">
        <button className="tool" disabled={imageBusy} onClick={() => fileRef.current?.click()}><ImageIcon /> {imageStatus || "画像をここに差し込む"}</button>
        <input ref={fileRef} type="file" accept="image/*" multiple style={{ display: "none" }} onChange={onPick} />
        <div className="toolRight">
          <button className="tool ghost" onClick={async () => { if (await onCopy({ ...initial, blocks })) showToast("本文をコピーしました"); }}>全文コピー</button>
          {onDelete && <button className="tool danger" onClick={async () => { if (await askConfirm("この記録を削除しますか？", { danger: true, okText: "削除" })) await onDelete(); }}><Trash /></button>}
        </div>
      </div>

      {toast && <div className="toast" role="status" aria-live="polite">{toast}</div>}

      {pickAcct && (
        <SwipeSheet onClose={() => setPickAcct(false)}>
            <div className="sheetTitle">保存先のノート</div>
            <div className="sheetBody" style={{ paddingTop: 0 }}>
              {accounts.filter(a => !a.isAll).map(a => (
                <button key={a.id} className={"pickRow" + (a.id === acctId ? " on" : "")} onClick={() => { setAcctId(a.id); setPickAcct(false); }}>
                  <Avatar account={a} size={42} />
                  <span className="pickText">
                    <span className="pickName">{accLabel(a)}</span>
                    {a.bio && <span className="pickBio">{a.bio.split("\n")[0]}</span>}
                  </span>
                  {a.id === acctId && <span className="pickCheck">✓</span>}
                </button>
              ))}
              {!isNew && <div className="pickHint">保存先を変えると、この記録は選んだノートに移動します。</div>}
            </div>
        </SwipeSheet>
      )}
    </div>
  );
}

function AutoTextarea({ value, onChange, placeholder, onFocus }) {
  const ref = useRef(null);
  const resize = () => { const el = ref.current; if (!el) return; el.style.height = "auto"; el.style.height = el.scrollHeight + "px"; };
  useEffect(resize, [value]);
  return (
    <textarea
      ref={ref}
      className="ta"
      rows={1}
      value={value}
      placeholder={placeholder}
      onFocus={onFocus}
      onChange={e => { onChange(e.target.value); resize(); }}
    />
  );
}

/* ============================================================
   ACCOUNTS — switch / add / edit / delete (theme sorting)
   ============================================================ */
function Accounts({ accounts, setAccounts, currentId, setCurrentId, entries, setEntries, onProfile, onAbout, onClose }) {
  const [editing, setEditing] = useState(null); // account being edited, or {new:true}
  const counts = useMemo(() => {
    const m = {}; entries.forEach(e => { m[e.accountId] = (m[e.accountId] || 0) + 1; }); return m;
  }, [entries]);

  const pick = (id) => { setCurrentId(id); onClose(); };

  const save = async (acc) => {
    const next = { ...acc, updatedAt: new Date().toISOString() };
    const result = await window.storage?.saveItem?.("nb.accounts", next);
    if (result && !result.ok) {
      await askAlert(storageErrorMessage(result.error, "ノートを保存できませんでした。もう一度お試しください。"));
      return false;
    }
    const stored = result?.item || next;
    setAccounts(as => {
      const i = as.findIndex(a => a.id === stored.id);
      if (i === -1) return [...as, stored];
      const c = as.slice(); c[i] = stored; return c;
    });
    if (!accounts.find(a => a.id === acc.id)) setCurrentId(acc.id);
    setEditing(null);
    return true;
  };
  const del = async (acc) => {
    if (acc.isAll) { await askAlert("統合ノート（すべての記録）は削除できません。"); return; }
    const n = counts[acc.id] || 0;
    if (accounts.filter(a => !a.isAll).length <= 1) { await askAlert("最後のノートは削除できません。"); return; }
    if (!(await askConfirm(`「${acc.name}」を削除しますか？${n > 0 ? `\nこのノートの記録 ${n} 件もすべて削除されます。` : ""}`, { danger: true, okText: "削除" }))) return;
    // 明示削除だけをtombstoneとして送る。全件が確定するまで表示からは消さない。
    const targets = entries.filter(e => e.accountId === acc.id);
    const results = await Promise.all([
      ...targets.map(e => window.storage?.deleteItem?.("nb.entries", e.id)),
      window.storage?.deleteItem?.("nb.accounts", acc.id)
    ]);
    if (results.some(result => result && !result.ok)) {
      await askAlert("削除を保存できませんでした。記録はそのまま残しています。");
      return;
    }
    setEntries(es => es.filter(e => e.accountId !== acc.id));
    setAccounts(as => as.filter(a => a.id !== acc.id));
    if (currentId === acc.id) setCurrentId(accounts.find(a => a.id !== acc.id).id);
    setEditing(null);
  };

  return (
    <div className="screen">
      <header className="topbar">
        <button className="iconBtn" onClick={onClose}><Back /></button>
        <span className="topTitle">ノートを切り替え</span>
        <div style={{ width: 40 }} />
      </header>

      <main className="acctList">
        <p className="acctNote">テーマごとにノートを分けられます。タグではなく、ノートを切り替えて使い分けます。</p>
        {accounts.map(a => (
          <div className={"acctRow" + (a.id === currentId ? " on" : "")} key={a.id}>
            <button className="acctMain" onClick={() => pick(a.id)}>
              <Avatar account={a} size={44} />
              <span className="acctRowText">
                <span className="acctRowName">{accLabel(a)}</span>
                {a.bio && <span className="acctRowBio">{a.bio.split("\n")[0]}</span>}
                <span className="acctRowSub">{(a.isAll ? entries.length : (counts[a.id] || 0))} 件{a.id === currentId ? " ・ 使用中" : ""}</span>
              </span>
            </button>
            {canEditAccount(a) && <button className="iconBtn sm" onClick={() => setEditing(a)} aria-label="編集"><Pencil /></button>}
          </div>
        ))}
        <button className="addAcct" onClick={() => setEditing({ ...newAccount(""), _new: true })}>
          <span className="addPlus"><Plus /></span> 新しいノートを作る
        </button>

        <button className="aboutLink" onClick={onAbout}>about Myposts <span className="aboutChev">›</span></button>
      </main>

      {editing && (
        <AccountSheet
          account={editing}
          isNew={!!editing._new}
          onSave={save}
          onDelete={(editing._new || editing.isAll) ? null : () => del(editing)}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

function AccountSheet({ account, isNew, onSave, onDelete, onClose }) {
  const [name, setName] = useState(account.name || "");
  const [handle, setHandle] = useState(account.handle || "");
  const [icon, setIcon] = useState(account.icon || "");
  const [bio, setBio] = useState(account.bio || "");
  const [cover, setCover] = useState(account.cover || "");
  const [saving, setSaving] = useState(false);
  const [imageBusy, setImageBusy] = useState(false);
  const [imageError, setImageError] = useState("");
  const pickIcon = async (e) => {
    const f = e.target.files?.[0]; e.target.value = ""; if (!f) return;
    setImageBusy(true);
    setImageError("");
    try {
      const r = await compressImage(f, 300, 0.85);
      setIcon(r.src);
    } catch (error) {
      setImageError(error?.message || "画像を読み込めませんでした。別の画像を選んでください。");
    } finally {
      setImageBusy(false);
    }
  };
  const pickCover = async (e) => {
    const f = e.target.files?.[0]; e.target.value = ""; if (!f) return;
    setImageBusy(true);
    setImageError("");
    try {
      const r = await compressImage(f, 1000, 0.8);
      setCover(r.src);
    } catch (error) {
      setImageError(error?.message || "画像を読み込めませんでした。別の画像を選んでください。");
    } finally {
      setImageBusy(false);
    }
  };
  const submit = async () => {
    if (saving || imageBusy) return;
    setSaving(true);
    try {
      const ok = await onSave({ ...account, name: name.trim(), handle: handle.trim(), icon, bio, cover, _new: undefined });
      if (ok !== true) setSaving(false);
    } catch (error) {
      console.error("[loof profile] save-failed", error);
      setSaving(false);
      await askAlert(storageErrorMessage(error, "プロフィールを保存できませんでした。もう一度お試しください。"));
    }
  };
  return (
    <SwipeSheet onClose={onClose} className="accountEditSheet">
        <div className="sheetTitle">{isNew ? "新しいノート" : "プロフィールを編集"}</div>
        <div className="sheetBody">
          <label className="coverPick" style={cover ? { backgroundImage: `url(${cover})` } : null} aria-label="ヘッダー画像を変更">
            {!cover && <span className="coverHint">＋ ヘッダー画像</span>}
            <input className="filePick" type="file" accept="image/*" onChange={pickCover} />
          </label>
          <div className="iconPick">
            <label className="iconPreview" aria-label="アイコン画像を変更">
              <Avatar account={{ name, icon }} size={72} />
              <span className="iconEdit">変更</span>
              <input className="filePick" type="file" accept="image/*" onChange={pickIcon} />
            </label>
            {(icon || cover) && <button className="txtbtn" type="button" disabled={imageBusy} onClick={() => { setIcon(""); setCover(""); }}>画像をリセット</button>}
            {imageError && <div className="imageError" role="alert">{imageError}</div>}
          </div>
          <label className="fieldLabel">名前（空欄でもOK）</label>
          <input className="field" value={name} onChange={e => setName(e.target.value)} placeholder="あなたの名前（例：Teddy）" autoFocus={isNew} />
          <label className="fieldLabel">ユーザー名（任意）</label>
          <div className="handleRow">
            <span className="at">@</span>
            <input className="field flat" value={handle} onChange={e => setHandle(e.target.value.replace(/\s/g, ""))} placeholder="名前の横に出ます" />
          </div>
          <label className="fieldLabel">bio（カテゴリー・用途）</label>
          <textarea className="field" rows={4} value={bio} onChange={e => setBio(e.target.value)} placeholder={"このノートのカテゴリーや用途を書きます。\n例）英語日記 / 創作 / IELTS 備忘録"} style={{ lineHeight: 1.6, resize: "none" }} />
          <button className="primary" disabled={saving || imageBusy} onClick={submit}>
            {imageBusy ? "画像を処理中…" : saving ? "保存中…" : (isNew ? "作成する" : "保存する")}
          </button>
          {onDelete && <button className="deleteLink" onClick={onDelete}>このノートを削除</button>}
        </div>
    </SwipeSheet>
  );
}

/* ============================================================
   PROFILE — X-style profile with bio (purpose) + cover
   ============================================================ */
function Profile({ account, accounts, entries, onSave, onOpen, onAbout, onPatch, onPostDelete, onQuote, onAddCommonplace, onClose }) {
  const [edit, setEdit] = useState(false);
  const j = new Date(account.createdAt);
  const acctFor = e => account?.isAll ? ((accounts || []).find(a => a.id === e.accountId) || account) : account;
  return (
    <div className="screen">
      <header className="topbar profTop">
        <button className="iconBtn" onClick={onClose}><Back /></button>
        <div className="profTopName">
          <div className="profTopTitle">{accLabel(account)}</div>
          <div className="profTopSub">{entries.length} posts</div>
        </div>
        <button className="iconBtn" onClick={onAbout} aria-label="about Myposts"><Info /></button>
      </header>
      <div className="profScroll">
        <div className="cover" style={account.cover ? { backgroundImage: `url(${account.cover})` } : null} />
        <div className="profBody">
          <div className="profRow1">
            <span className="profAvatar"><Avatar account={account} size={84} /></span>
            {canEditAccount(account) && <button className="editProfile" onClick={() => setEdit(true)}>プロフィールを編集</button>}
          </div>
          <div className="profName">{accLabel(account)} <Lock /></div>
          {account.handle && <div className="profHandle">@{account.handle}</div>}
          {account.bio && <div className="profBio">{account.bio}</div>}
          <div className="profJoined"><Cal /> {j.getFullYear()}年{j.getMonth() + 1}月から</div>
        </div>
        <div className="profDivider" />
        <div className="profPosts">
          {entries.length === 0
            ? <div className="empty">まだ投稿がありません。</div>
            : entries.map(e => <PostCard key={e.id} entry={e} account={acctFor(e)} onOpen={onOpen} onPatch={onPatch} onDelete={onPostDelete} onQuote={onQuote} onAddCommonplace={onAddCommonplace} />)}
          <div style={{ height: 60 }} />
        </div>
      </div>
      {edit && <AccountSheet account={account} isNew={false} onSave={(a) => saveProfile(onSave, a, () => setEdit(false))} onDelete={null} onClose={() => setEdit(false)} />}
    </div>
  );
}

/* ============================================================
   COMMONPLACE — cross-account search + saved collections
   ============================================================ */
function Commonplace({ accounts, entries, collections, setCollections, onCreate, onOpenEntry, onPatch, onPostDelete, onQuote, onAddCommonplace, onOpenDay, onClose }) {
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(null);
  const accOf = id => accounts.find(a => a.id === id) || { name: "?", handle: "" };
  const byNew = arr => [...arr].sort((a, b) => a.createdAt < b.createdAt ? 1 : -1);
  const searchResults = useMemo(() => {
    const k = q.trim().toLowerCase(); if (!k) return [];
    return byNew(entries.filter(e => entryPlainText(e).toLowerCase().includes(k)));
  }, [q, entries]);
  const collItems = (c) => {
    const k = (c.query || "").trim().toLowerCase();
    const matched = k ? entries.filter(e => entryPlainText(e).toLowerCase().includes(k)) : [];
    const manual = (c.itemIds || []).map(id => entries.find(e => e.id === id)).filter(Boolean);
    const map = {}; [...matched, ...manual].forEach(e => { map[e.id] = e; });
    return byNew(Object.values(map));
  };
  const delCollection = async (c) => {
    if (await askConfirm(`「${c.name}」を削除しますか？\n（記録そのものは消えません）`, { danger: true, okText: "削除" })) {
      const result = await window.storage?.deleteItem?.("nb.collections", c.id);
      if (result && !result.ok) {
        await askAlert("削除を保存できませんでした。コレクションは残しています。");
        return;
      }
      setCollections(cs => cs.filter(x => x.id !== c.id)); setSel(null);
    }
  };
  const removeItem = (c, id) => setCollections(cs => {
    let changed = null;
    const next = cs.map(x => {
      if (x.id !== c.id) return x;
      changed = { ...x, itemIds: (x.itemIds || []).filter(i => i !== id), updatedAt: new Date().toISOString() };
      return changed;
    });
    if (changed) void window.storage?.saveItem?.("nb.collections", changed);
    return next;
  });

  if (sel) {
    const c = collections.find(x => x.id === sel);
    if (!c) { setSel(null); return null; }
    const items = collItems(c);
    return (
      <div className="screen">
        <header className="topbar">
          <button className="iconBtn" onClick={() => setSel(null)}><Back /></button>
          <span className="topTitle" style={{ maxWidth: "60vw", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name}</span>
          <div style={{ width: 40 }} />
        </header>
        <div className="cpDetail">
          {c.query && <div className="cpQueryNote">「{c.query}」を含む記録を全ノートから自動で集めています</div>}
          {items.length === 0 ? <div className="empty">まだ記録がありません。</div> :
            items.map(e => (
              <div className="cpItem" key={e.id}>
                <PostCard entry={e} account={accOf(e.accountId)} onOpen={onOpenEntry} onPatch={onPatch} onDelete={onPostDelete} onQuote={onQuote} onAddCommonplace={onAddCommonplace} onOpenDay={onOpenDay} />
                {(c.itemIds || []).includes(e.id) && <button className="cpRemove" onClick={() => removeItem(c, e.id)}>このまとめから外す</button>}
              </div>
            ))}
          <button className="deleteLink" onClick={() => delCollection(c)}>このコモンプレイスを削除</button>
          <div style={{ height: 40 }} />
        </div>
      </div>
    );
  }

  return (
    <div className="screen">
      <header className="topbar">
        <button className="iconBtn" onClick={onClose}><Back /></button>
        <span className="topTitle">コモンプレイス</span>
        <div style={{ width: 40 }} />
      </header>
      <div className="cpScroll">
        <p className="cpIntro">すべてのノートを横断して言葉で検索し、出てきた記録を1か所にまとめられます。</p>
        <div className="search cpSearch">
          <SearchIcon /><input value={q} onChange={e => setQ(e.target.value)} placeholder="すべてのノートを検索" />
          {q && <button className="clr" onClick={() => setQ("")}>✕</button>}
        </div>

        {q.trim() ? (
          <div className="cpResults">
            <div className="cpResultHead">
              <span>{searchResults.length} 件</span>
              {searchResults.length > 0 && <button className="cpSave" onClick={() => { const c = onCreate("「" + q.trim() + "」", q.trim()); setQ(""); setSel(c.id); }}>このまとめを保存</button>}
            </div>
            {searchResults.map(e => <PostCard key={e.id} entry={e} account={accOf(e.accountId)} onOpen={onOpenEntry} onPatch={onPatch} onDelete={onPostDelete} onQuote={onQuote} onAddCommonplace={onAddCommonplace} onOpenDay={onOpenDay} />)}
          </div>
        ) : (
          <>
            <div className="cpSectionHead">保存したコモンプレイス</div>
            {collections.length === 0
              ? <div className="empty">まだありません。<br />検索して「このまとめを保存」するか、各記録の … から追加できます。</div>
              : collections.map(c => {
                const items = collItems(c);
                return (
                  <button key={c.id} className="cpCard" onClick={() => setSel(c.id)}>
                    <div className="cpCardTop"><Layers /><span className="cpCardName">{c.name}</span><span className="cpCount">{items.length}</span></div>
                    {c.query && <div className="cpCardSub">「{c.query}」を含む記録を自動収集</div>}
                    {items[0] && <div className="cpCardPreview">{entryPlainText(items[0]).slice(0, 64) || "（画像の記録）"}</div>}
                  </button>
                );
              })}
          </>
        )}
        <div style={{ height: 60 }} />
      </div>
    </div>
  );
}

function CommonplacePicker({ entry, collections, onAdd, onCreate, onClose }) {
  const [name, setName] = useState("");
  return (
    <SwipeSheet onClose={onClose}>
        <div className="sheetTitle">コモンプレイスに追加</div>
        <div className="sheetBody">
          {collections.length > 0 && <div className="fieldLabel">既存のまとめ</div>}
          {collections.map(c => (
            <button key={c.id} className="pickRow" onClick={() => onAdd(c.id)}>
              <span className="cpRowIcon"><Layers /></span>
              <span className="pickName">{c.name}</span>
            </button>
          ))}
          <div className="fieldLabel" style={{ marginTop: collections.length ? 18 : 0 }}>新しく作る</div>
          <div style={{ display: "flex", gap: 8 }}>
            <input className="field flat" value={name} onChange={e => setName(e.target.value)} placeholder="まとめの名前" onKeyDown={e => e.key === "Enter" && name.trim() && onCreate(name)} />
            <button className="primary" style={{ width: "auto", padding: "0 18px", flexShrink: 0 }} disabled={!name.trim()} onClick={() => onCreate(name)}>作成</button>
          </div>
        </div>
    </SwipeSheet>
  );
}

/* ============================================================
   DAY VIEW — one day's posts, scope = all accounts or one
   ============================================================ */
function DayView({ date, accounts, entries, currentId, onOpenEntry, onPatch, onPostDelete, onQuote, onAddCommonplace, onClose }) {
  const [scope, setScope] = useState("all");
  const accOf = id => accounts.find(a => a.id === id) || { name: "?" };
  const items = useMemo(() => {
    let list = entries.filter(e => e.createdAt.slice(0, 10) === date);
    if (scope !== "all") list = list.filter(e => e.accountId === scope);
    return list.sort((a, b) => a.createdAt < b.createdAt ? -1 : 1);
  }, [entries, date, scope]);
  const head = fmtDayHead(date);
  return (
    <div className="overlay" onClick={onClose} style={{ alignItems: "stretch" }}>
      <RouteStage className="fullPane" motion="forward" canGoBack onBack={onClose}>
        <header className="topbar">
          <button className="iconBtn" onClick={onClose}><Back /></button>
          <div className="profTopName">
            <div className="profTopTitle">{new Date(date).getFullYear()}年{head.big}</div>
            <div className="profTopSub">{head.sub} ・ {items.length}件</div>
          </div>
          <div style={{ width: 40 }} />
        </header>
        <div className="scopeBar">
          <button className={"scopeChip" + (scope === "all" ? " on" : "")} onClick={() => setScope("all")}>すべてのノート</button>
          {accounts.filter(a => !a.isAll).map(a => (
            <button key={a.id} className={"scopeChip" + (scope === a.id ? " on" : "")} onClick={() => setScope(a.id)}>
              <Avatar account={a} size={18} /> {accLabel(a)}
            </button>
          ))}
        </div>
        <div className="dvScroll">
          {items.length === 0
            ? <div className="empty">この日の記録はありません。</div>
            : items.map(e => <PostCard key={e.id} entry={e} account={accOf(e.accountId)} onOpen={onOpenEntry} onPatch={onPatch} onDelete={onPostDelete} onQuote={onQuote} onAddCommonplace={onAddCommonplace} />)}
          <div style={{ height: 40 }} />
        </div>
      </RouteStage>
    </div>
  );
}

/* ============================================================
   ABOUT Myposts
   ============================================================ */
function About({ icloud, setIcloud, user, onGoogle, onLogout, busy, onClose }) {
  const openX = () => window.open("https://x.com/inuteddy12", "_blank");
  const openReview = () => window.open("https://apps.apple.com/", "_blank");
  const toggleIcloud = async () => {
    if (!icloud) { setIcloud(true); await askAlert("iCloud同期をオンにしました。\n※ 実機アプリ版で端末間の同期が有効になります（現在のWeb版は端末内に保存されます）。"); }
    else setIcloud(false);
  };
  const google = isGoogleUser(user);
  const doLogout = async () => { if (await askConfirm("ログアウトしますか？\n（記録は Google アカウントに安全に保存されています）", { okText: "ログアウト" })) onLogout?.(); };
  return (
    <div className="screen">
      <header className="topbar">
        <button className="iconBtn" onClick={onClose}><Back /></button>
        <span className="topTitle">about Myposts</span>
        <div style={{ width: 40 }} />
      </header>
      <div className="aboutScroll">
        <div className="aboutBrand">Myposts</div>
        <p className="aboutThanks">お使いいただきありがとうございます</p>
        <p className="aboutThanks sub">ご意見ご要望があれば教えてくださるとほんとうにうれしいです</p>

        <button className="aboutRow" onClick={openX}>
          <span className="aboutRowMain"><span className="aboutRowT">お問い合わせ</span><span className="aboutRowSub">不具合報告・ご意見ご要望をください</span></span>
          <span className="aboutChev">›</span>
        </button>
        <button className="aboutRow" onClick={openReview}>
          <span className="aboutRowMain"><span className="aboutRowT">レビューで応援する</span><span className="aboutRowSub">励みになります</span></span>
          <span className="aboutChev">›</span>
        </button>

        <div className="aboutRow static">
          <span className="aboutRowMain"><span className="aboutRowT">データをiCloud同期</span><span className="aboutRowSub">端末間で記録を同期（実機アプリ版で有効）</span></span>
          <button className={"miniToggle" + (icloud ? " on" : "")} onClick={toggleIcloud}>{icloud ? "オン" : "オフ"}</button>
        </div>

        <div className="aboutSection">other apps</div>
        <div className="aboutPlaceholder">準備中です（後ほど紹介を追加します）</div>

        <div className="aboutSection">アカウント</div>
        <div className="aboutRow static">
          <span className="aboutRowMain"><span className="aboutRowT">{google ? "Googleでログイン中" : "ログインせず使用中"}</span><span className="aboutRowSub">{google ? (user?.email || "Firebase で同期中") : "Googleでログインすると端末間で同期できます"}</span></span>
          <button className="miniToggle" disabled={busy} onClick={google ? doLogout : onGoogle}>{google ? "ログアウト" : "Googleでログイン"}</button>
        </div>

        <button className="aboutCredit" onClick={openX}>created by inu teddy ↗</button>
        <div style={{ height: 40 }} />
      </div>
    </div>
  );
}

/* ============================================================
   APP NAVIGATION — X-style desktop rail + mobile tab bar
   ============================================================ */
function Navigation({ account, view, onTimeline, onProfile, onCommonplace, onAccounts, onCompose, writeReady }) {
  return (
    <aside className="leftNav" aria-label="メインナビゲーション">
      <div className="leftNavInner">
        <nav className="navLinks">
          <NavButton label="ホーム" active={view === "timeline"} icon={<HomeIcon />} onClick={onTimeline} />
          <NavButton label="プロフィール" active={view === "profile"} icon={<UserIcon />} onClick={onProfile} />
          <NavButton label="コモンプレイス" active={view === "commonplace"} icon={<Layers />} onClick={onCommonplace} />
          <NavButton label="ノート" active={view === "accounts"} icon={<NotebookIcon />} onClick={onAccounts} />
        </nav>
        <button className="navCompose" onClick={onCompose} disabled={!writeReady}><Pencil /><span>{writeReady ? "ポストする" : "同期中…"}</span></button>
        <button className="navAccount" onClick={onAccounts} aria-label="ノートを切り替え">
          <Avatar account={account} size={42} />
          <span className="navAccountText"><b>{accLabel(account)}</b><small>{account.handle ? `@${account.handle}` : "プライベート"}</small></span>
          <Dots />
        </button>
      </div>
    </aside>
  );
}

function NavButton({ label, active, icon, onClick }) {
  return <button className={"navButton" + (active ? " on" : "")} aria-current={active ? "page" : undefined} onClick={onClick}>{icon}<span>{label}</span></button>;
}

function MobileNavigation({ view, onTimeline, onProfile, onCommonplace, onAccounts }) {
  const tap = fn => () => { navigator.vibrate?.(4); fn(); };
  return (
    <nav className="mobileNav" aria-label="メインナビゲーション">
      <button className={view === "timeline" ? "on" : ""} aria-current={view === "timeline" ? "page" : undefined} onClick={tap(onTimeline)} aria-label="ホーム"><HomeIcon /></button>
      <button className={view === "profile" ? "on" : ""} aria-current={view === "profile" ? "page" : undefined} onClick={tap(onProfile)} aria-label="プロフィール"><UserIcon /></button>
      <button className={view === "commonplace" ? "on" : ""} aria-current={view === "commonplace" ? "page" : undefined} onClick={tap(onCommonplace)} aria-label="コモンプレイス"><Layers /></button>
      <button className={view === "accounts" ? "on" : ""} aria-current={view === "accounts" ? "page" : undefined} onClick={tap(onAccounts)} aria-label="ノート"><NotebookIcon /></button>
    </nav>
  );
}

/* ============================================================
   SIDEBAR — wide screens only: search + notebook overview
   ============================================================ */
function Sidebar({ account, entries, allEntries, onOpenEntry }) {
  const [q, setQ] = useState("");
  const imgs = useMemo(() => {
    const k = q.trim().toLowerCase();
    const out = [];
    [...entries].sort((a, b) => a.createdAt < b.createdAt ? 1 : -1).forEach(e => {
      if (k && !entryPlainText(e).toLowerCase().includes(k)) return;
      e.blocks.filter(b => b.type === "image").forEach(b => out.push({ src: b.src, id: e.id }));
    });
    return out;
  }, [entries, q]);
  const liked = entries.filter(e => e.liked).length;
  const saved = entries.filter(e => e.bookmarked).length;
  return (
    <aside className="sidebar">
      <div className="search sideSearch">
        <SearchIcon />
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="ポストを検索" aria-label="ポストを検索" />
        {q && <button className="clr" onClick={() => setQ("")}>✕</button>}
      </div>
      <div className="sideCard sideOverview">
        <div className="sideTitle">{accLabel(account)} の記録</div>
        <div className="sideStat"><span>ポスト</span><b>{entries.length}</b></div>
        <div className="sideStat"><span>いいね</span><b>{liked}</b></div>
        <div className="sideStat"><span>ブックマーク</span><b>{saved}</b></div>
        {account?.isAll && <div className="sideFoot">全ノート合計 {allEntries.length} 件</div>}
      </div>
      <div className="sideCard">
        <div className="sideTitle">メディア</div>
        {imgs.length === 0
          ? <div className="sideEmpty">画像つきのポストがここに並びます。</div>
          : <div className="imgGrid">{imgs.map((im, i) => (
              <button key={i} className="imgCell" onClick={() => onOpenEntry(im.id)} style={{ backgroundImage: `url(${im.src})` }} aria-label="記録を開く" />
            ))}</div>}
      </div>
      <div className="sideLegal">Myposts · あなただけのタイムライン</div>
    </aside>
  );
}

/* ============================================================
   LOGIN
   ============================================================ */
const GoogleG = () => (
  <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
    <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.9 2.4 30.3 0 24 0 14.6 0 6.4 5.4 2.5 13.3l7.9 6.1C12.2 13.2 17.6 9.5 24 9.5z" />
    <path fill="#4285F4" d="M46.1 24.6c0-1.6-.1-3.1-.4-4.6H24v9.1h12.4c-.5 2.9-2.1 5.3-4.6 6.9l7.1 5.5c4.1-3.8 6.5-9.4 6.5-16.9z" />
    <path fill="#FBBC05" d="M10.4 28.6c-.5-1.4-.8-2.9-.8-4.6s.3-3.2.8-4.6l-7.9-6.1C.9 16.5 0 20.1 0 24s.9 7.5 2.5 10.7l7.9-6.1z" />
    <path fill="#34A853" d="M24 48c6.3 0 11.6-2.1 15.5-5.7l-7.1-5.5c-2 1.3-4.6 2.1-8.4 2.1-6.4 0-11.8-3.7-13.6-9.1l-7.9 6.1C6.4 42.6 14.6 48 24 48z" />
  </svg>
);
function Login({ onGoogle, onGuest, busy }) {
  return (
    <div className="login">
      <div className="loginInner">
        <div className="loginBrand">Myposts</div>
        <div className="loginTag">書いて、貼って、読み返す。</div>
        <div className="loginBtns">
          <button className="googleBtn" disabled={busy} onClick={onGoogle}><GoogleG /> {busy ? "ログイン中…" : "Google でログイン"}</button>
          <button className="guestBtn" disabled={busy} onClick={onGuest}>ログインせず使用する</button>
        </div>
        <div className="loginNote">Google でログインすると、記録を複数の端末で安全に同期できます。</div>
      </div>
    </div>
  );
}

/* ---------- avatar ---------- */
function Avatar({ account, size = 32 }) {
  if (account?.icon) {
    return <span className="avatar" style={{ width: size, height: size }}>
      <img src={account.icon} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
    </span>;
  }
  return (
    <span className="avatar" style={{ width: size, height: size }}>
      <img src={DEFAULT_AVATAR} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
    </span>
  );
}

/* ---------- icons ---------- */
const stroke = { fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round", strokeLinejoin: "round" };
const Plus = () => <svg width="22" height="22" viewBox="0 0 24 24" {...stroke}><path d="M12 5v14M5 12h14" /></svg>;
const Back = () => <svg width="22" height="22" viewBox="0 0 24 24" {...stroke}><path d="M15 5l-7 7 7 7" /></svg>;
const Trash = () => <svg width="18" height="18" viewBox="0 0 24 24" {...stroke}><path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13" /></svg>;
const Pencil = () => <svg width="17" height="17" viewBox="0 0 24 24" {...stroke}><path d="M4 20l4-1 10-10-3-3L5 16l-1 4zM14 6l3 3" /></svg>;
const Chevron = () => <svg width="16" height="16" viewBox="0 0 24 24" {...stroke}><path d="M6 9l6 6 6-6" /></svg>;
const SearchIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" {...stroke} style={{ color: SUB }}><circle cx="11" cy="11" r="7" /><path d="M21 21l-4-4" /></svg>;
const ImageIcon = () => <svg width="18" height="18" viewBox="0 0 24 24" {...stroke}><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="8.5" cy="9.5" r="1.5" /><path d="M21 16l-5-5L5 20" /></svg>;
const Lock = () => <svg width="14" height="14" viewBox="0 0 24 24" {...stroke} style={{ color: SUB }}><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>;
const Comment = () => <svg width="18" height="18" viewBox="0 0 24 24" {...stroke}><path d="M21 11.5a8 8 0 0 1-11.5 7.2L4 20l1.3-4.5A8 8 0 1 1 21 11.5z" /></svg>;
const Retweet = () => <svg width="18" height="18" viewBox="0 0 24 24" {...stroke}><path d="M4 8l3-3 3 3M7 5v9a2 2 0 0 0 2 2h6M20 16l-3 3-3-3M17 19v-9a2 2 0 0 0-2-2H9" /></svg>;
const Heart = () => <svg width="18" height="18" viewBox="0 0 24 24" {...stroke}><path d="M12 20s-7-4.4-9.2-8.5C1.3 8.6 2.7 5.5 6 5.5c2 0 3.2 1.3 4 2.5.8-1.2 2-2.5 4-2.5 3.3 0 4.7 3.1 3.2 6C19 15.6 12 20 12 20z" /></svg>;
const Views = () => <svg width="18" height="18" viewBox="0 0 24 24" {...stroke}><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></svg>;
const Bookmark = () => <svg width="18" height="18" viewBox="0 0 24 24" {...stroke}><path d="M6 4h12v16l-6-4-6 4z" /></svg>;
const BookmarkFill = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M6 3.5h12a1 1 0 0 1 1 1V21l-7-4.7L5 21V4.5a1 1 0 0 1 1-1z" /></svg>;
const Share = () => <svg width="18" height="18" viewBox="0 0 24 24" {...stroke}><path d="M12 3v12M8 7l4-4 4 4M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" /></svg>;
const HeartFill = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 20s-7-4.4-9.2-8.5C1.3 8.6 2.7 5.5 6 5.5c2 0 3.2 1.3 4 2.5.8-1.2 2-2.5 4-2.5 3.3 0 4.7 3.1 3.2 6C19 15.6 12 20 12 20z" /></svg>;
const SlashCircle = () => <svg width="18" height="18" viewBox="0 0 24 24" {...stroke}><circle cx="12" cy="12" r="9" /><path d="M6 6l12 12" /></svg>;
const Dots = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="1.9" /><circle cx="12" cy="12" r="1.9" /><circle cx="19" cy="12" r="1.9" /></svg>;
const Layers = () => <svg width="22" height="22" viewBox="0 0 24 24" {...stroke}><path d="M12 3l9 5-9 5-9-5 9-5zM3 14l9 5 9-5M3 18l9 5" /></svg>;
const BookmarkPlus = () => <svg width="19" height="19" viewBox="0 0 24 24" {...stroke}><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h6M17 3v6M14 6h6" /></svg>;
const Cal = () => <svg width="15" height="15" viewBox="0 0 24 24" {...stroke} style={{ color: MUT }}><rect x="3.5" y="5" width="17" height="16" rx="2" /><path d="M3.5 9h17M8 3v4M16 3v4" /></svg>;
const Info = () => <svg width="22" height="22" viewBox="0 0 24 24" {...stroke}><circle cx="12" cy="12" r="9" /><path d="M12 11v5" /><circle cx="12" cy="7.6" r="0.6" fill="currentColor" stroke="none" /></svg>;
const HomeIcon = () => <svg width="25" height="25" viewBox="0 0 24 24" {...stroke}><path d="M3 11.5L12 3l9 8.5V21h-6v-6H9v6H3z" /></svg>;
const UserIcon = () => <svg width="25" height="25" viewBox="0 0 24 24" {...stroke}><circle cx="12" cy="8" r="4" /><path d="M4.5 21c.7-4.1 3.2-6 7.5-6s6.8 1.9 7.5 6" /></svg>;
const NotebookIcon = () => <svg width="25" height="25" viewBox="0 0 24 24" {...stroke}><path d="M5 3h13a2 2 0 0 1 2 2v16H7a3 3 0 0 1-3-3V4a1 1 0 0 1 1-1z" /><path d="M8 3v18M12 8h5" /></svg>;

/* ============================================================ styles ============================================================ */
const S = {
  root: { position: "relative", minHeight: "100vh", background: "#fff", color: INK,
    fontFamily: "-apple-system,BlinkMacSystemFont,'Hiragino Sans','Noto Sans JP','Segoe UI',sans-serif" },
};

const CSS = `
*{box-sizing:border-box;-webkit-tap-highlight-color:transparent;}
body{margin:0;background:#fff;font-weight:400;overscroll-behavior-y:none;
  font-family:-apple-system,BlinkMacSystemFont,'Hiragino Sans','Noto Sans JP','Segoe UI',sans-serif;}
html,body,#root{width:100%;max-width:100%;min-width:0;margin:0;padding:0;}
button{font-family:inherit;cursor:pointer;font-weight:600;}
input,textarea{font-family:inherit;font-weight:400;}
button:focus-visible,input:focus-visible,textarea:focus-visible{outline:2px solid ${BL};outline-offset:2px;}

.screen{width:100%;max-width:none;margin:0;min-height:100dvh;position:relative;display:flex;flex-direction:column;background:#fff;overscroll-behavior-y:contain;}

/* top bar */
.topbar{position:sticky;top:0;z-index:10;display:flex;align-items:center;justify-content:space-between;
  padding:0 16px;background:rgba(255,255,255,.92);backdrop-filter:blur(12px);border-bottom:1px solid ${LINE};min-height:54px;}
.topTitle{font-size:13px;letter-spacing:.1em;color:${SUB};}
.acctBtn{display:flex;align-items:center;gap:10px;background:none;border:none;padding:4px 8px 4px 4px;border-radius:999px;color:${INK};}
.acctBtn:active{background:${LINE};}
.acctName{font-size:16px;font-weight:800;max-width:46vw;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.acctBtn svg{color:${FAINT};}
.iconBtn{width:40px;height:40px;border-radius:50%;border:none;background:none;color:${INK};display:grid;place-items:center;}
.iconBtn:active{background:${LINE};}
.iconBtn.sm{width:34px;height:34px;color:${SUB};}
.txtbtn{background:none;border:none;color:${SUB};font-size:14px;padding:6px 4px;}
.txtbtn.strong{color:${INK};font-weight:600;}
.desktopOnly{display:none;}

/* avatar */
.avatar{border-radius:50%;overflow:hidden;display:inline-grid;place-items:center;flex-shrink:0;background:#fff;border:1px solid ${LINE};}
.avatar.mono{background:${INK};color:#fff;font-weight:600;border:none;font-family:'Hina Mincho',serif;}

/* search */
.searchWrap{padding:10px 16px;}
.search{display:flex;align-items:center;gap:9px;background:#EFF3F4;border:1px solid transparent;border-radius:999px;padding:9px 14px;}
.search:focus-within{background:#fff;border-color:${BL};}
.search input{flex:1;border:none;outline:none;background:none;font-size:14px;color:${INK};}
.search .clr{border:none;background:none;color:${FAINT};font-size:13px;}

/* feed */
.feed{flex:1;padding:0;background:#fff;}
.day{margin-top:16px;}
.dayHead{display:flex;align-items:flex-end;justify-content:space-between;
  padding:0 2px 12px;margin-bottom:6px;border-bottom:1px solid ${LINE};}
.dayBig{font-size:16px;line-height:1.1;color:${TXT};letter-spacing:.03em;font-weight:500;}
.daySub{font-size:11px;color:${SUB};margin-top:6px;letter-spacing:.08em;}
.dayCopy{background:none;border:1px solid ${LINE};border-radius:999px;color:${SUB};font-size:11px;padding:6px 12px;}
.dayCopy:active{background:${LINE2};}

.thread{position:relative;}
.xpost{display:flex;gap:10px;padding:12px 16px 5px;border-bottom:1px solid ${LINE};cursor:pointer;
  font-family:-apple-system,BlinkMacSystemFont,'Hiragino Sans','Noto Sans JP','Segoe UI',sans-serif;transition:background-color .16s ease,transform .16s ease;}
.xpost:hover{background:rgba(0,0,0,.025);}
.xpost:active{background:#F7F9F9;}
.xAvatar{flex-shrink:0;padding-top:2px;}
.xMain{flex:1;min-width:0;}
.xHead{display:flex;align-items:center;gap:4px;margin-bottom:1px;}
.xName{font-weight:700;font-size:15px;color:${TXT};max-width:38vw;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.xHead svg{flex-shrink:0;}
.xHandle{font-size:15px;color:${MUT};font-weight:400;max-width:30vw;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.xDot{color:${MUT};font-weight:400;}
.xTime{font-size:15px;color:${MUT};font-weight:400;white-space:nowrap;}
.xHeadRight{margin-left:auto;display:flex;align-items:center;gap:2px;position:relative;}
.xIcon{width:30px;height:30px;border-radius:50%;border:none;background:none;color:${MUT};display:grid;place-items:center;}
.xIcon:active{background:rgba(15,20,25,.07);color:${BL};}
.xBody{}
.xText{margin:0;font-size:15px;line-height:1.34;font-weight:400;white-space:pre-wrap;overflow-wrap:anywhere;color:${TXT};}
.xText + .xText{margin-top:10px;}
.xText.faint{color:${MUT};}
.xImg{display:block;width:100%;border-radius:16px;border:1px solid ${LINE};margin:12px 0 0;}
.xActions{display:flex;align-items:center;margin-top:7px;max-width:430px;color:${MUT};}
.xActWrap{position:relative;display:inline-flex;}
.xAct{display:inline-flex;align-items:center;gap:6px;border:none;background:none;color:${MUT};font-size:13px;font-weight:400;
  height:34px;padding:0 2px;min-width:34px;justify-content:flex-start;border-radius:999px;transition:color .16s ease,background-color .16s ease,transform .12s ease;}
.xAct svg{width:18px;height:18px;}
.xAct:hover,.xAct:active{color:${BL};background:rgba(29,155,240,.1);}
.xAct.rt:hover{color:${RTC};background:rgba(0,186,124,.1);}
.xAct.like:hover{color:${LK};background:rgba(249,24,128,.1);}
.xAct.like{color:${LK};}
.xAct.rt{color:${RTC};}
.xAct.bm{color:${BL};}
.xAct:active{transform:scale(.78);}
.xAct.like svg,.xAct.bm svg{animation:reactionPop .25s cubic-bezier(.2,1.5,.4,1);}
@keyframes reactionPop{0%{transform:scale(.55);}70%{transform:scale(1.18);}100%{transform:scale(1);}}
.xCnt{font-size:13px;}
.xSpacer{flex:1;}

/* popover menus */
.menuBackdrop{position:fixed;inset:0;z-index:40;}
.menu{position:absolute;z-index:41;background:#fff;border:1px solid ${LINE};border-radius:16px;
  box-shadow:0 10px 30px rgba(0,0,0,.16),0 2px 8px rgba(0,0,0,.08);padding:6px;min-width:180px;animation:menuIn .16s cubic-bezier(.2,.9,.3,1);transform-origin:top right;}
@keyframes menuIn{from{opacity:0;transform:scale(.92) translateY(-4px);}to{opacity:1;transform:none;}}
.kebabMenu{top:32px;right:0;}
.rtMenu{bottom:38px;left:0;}
.menuItem{display:flex;align-items:center;gap:14px;width:100%;background:none;border:none;
  padding:13px 14px;border-radius:10px;font-size:15px;font-weight:700;color:${TXT};text-align:left;
  font-family:-apple-system,'Hiragino Sans','Noto Sans JP',sans-serif;}
.menuItem:active{background:${LINE2};}
.menuItem.danger{color:${RED};}
.menuItem svg{width:19px;height:19px;color:currentColor;}

/* quote card */
.quoteCard{position:relative;border:1px solid ${BRD2};border-radius:16px;padding:10px 12px;margin:12px 0 0;}
.quoteHead{display:flex;align-items:center;gap:4px;font-size:14px;flex-wrap:wrap;}
.qAvatar{display:inline-flex;}
.qAvatar .avatar{width:18px;height:18px;}
.qName{font-weight:700;color:${TXT};max-width:34vw;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.qHandle,.qDot,.qTime{color:${MUT};font-weight:400;}
.qText{font-size:14px;line-height:1.35;color:${TXT};margin-top:3px;white-space:pre-wrap;overflow-wrap:anywhere;}
.qImg{width:100%;border-radius:12px;margin-top:8px;border:1px solid ${LINE};}
.qDel{position:absolute;top:8px;right:8px;width:24px;height:24px;border-radius:50%;border:none;
  background:rgba(15,20,25,.55);color:#fff;font-size:12px;display:grid;place-items:center;}

/* empty */
.empty{text-align:center;color:${SUB};font-size:13.5px;line-height:2;padding:64px 24px;font-weight:600;}

/* swipe pager */
.pager{flex:1;min-height:0;display:flex;flex-direction:column;overflow:hidden;background:#fff;}
.pagerHead{display:flex;align-items:center;gap:8px;padding:8px 12px 12px;}
.navArrow{width:40px;height:40px;border-radius:50%;border:none;background:none;color:${INK};display:grid;place-items:center;flex-shrink:0;}
.navArrow:active{background:${LINE};}
.navArrow:disabled{opacity:.22;}
.navArrow.flip{transform:scaleX(-1);}
.pagerDate{flex:1;text-align:center;min-width:0;}
.pgBig{font-size:16px;font-weight:500;letter-spacing:.03em;color:${TXT};}
.pgSub{font-size:10.5px;color:${MUT};margin-top:3px;font-weight:400;letter-spacing:.05em;}
.track{flex:1;display:flex;min-height:0;touch-action:pan-y;will-change:transform;user-select:none;}
.page{flex:0 0 100%;min-width:0;height:100%;overflow:hidden;}
.pageScroll{height:100%;overflow-y:auto;padding:0 16px;-webkit-overflow-scrolling:touch;overscroll-behavior-y:contain;}
.pageCopyRow{display:flex;justify-content:flex-end;padding:4px 0 2px;}
.dots{display:flex;gap:7px;justify-content:center;align-items:center;padding:12px 0 16px;flex-wrap:wrap;}
.dot{width:6px;height:6px;border:0;padding:0;border-radius:50%;background:${LINE};transition:transform .2s ease,background-color .2s ease;}
.dot.on{background:${INK};transform:scale(1.25);}
.dotCount{font-size:11px;color:${SUB};font-weight:700;}

/* fab */
.fab{position:fixed;right:max(20px,calc(50vw - 300px + 20px));bottom:26px;width:58px;height:58px;border-radius:50%;
  background:${BL};color:#fff;border:none;display:grid;place-items:center;z-index:20;
  box-shadow:0 8px 24px rgba(29,155,240,.3);transition:transform .16s ease,box-shadow .16s ease;}
.fab:active{transform:scale(.88);box-shadow:0 3px 12px rgba(29,155,240,.24);}
.fab:disabled{cursor:wait;opacity:.48;box-shadow:none;}

/* composer */
.compose{background:#fff;}
.compTop{background:rgba(255,255,255,.9);}
.compHint{display:flex;align-items:center;gap:7px;font-size:12px;color:${SUB};letter-spacing:.06em;}
.compAcct{display:flex;align-items:center;gap:7px;background:none;border:1px solid ${LINE};border-radius:999px;padding:5px 12px 5px 6px;color:${INK};}
.compAcct:active{background:${LINE2};}
.compAcctName{font-size:13.5px;font-weight:800;max-width:38vw;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.compAcct svg{color:${FAINT};}
.pickRow{width:100%;display:flex;align-items:center;gap:13px;background:none;border:none;border-radius:14px;padding:12px;text-align:left;color:${INK};margin-bottom:2px;}
.pickRow:active{background:${LINE2};}
.pickRow.on{background:${LINE2};}
.pickName{flex:1;font-size:16px;font-weight:800;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.pickText{flex:1;min-width:0;display:flex;flex-direction:column;}
.pickText .pickName{flex:none;}
.pickBio{font-size:11.5px;color:${MUT};margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:500;}
.pickCheck{color:${INK};font-weight:900;font-size:16px;}
.pickHint{font-size:11.5px;color:${SUB};line-height:1.7;padding:12px 6px 4px;}
.editor{flex:1;padding:18px 20px 0;}
.editMeta{font-size:11px;color:${FAINT};letter-spacing:.05em;margin-bottom:12px;padding-bottom:12px;border-bottom:1px solid ${LINE2};}
.ta{width:100%;border:none;outline:none;resize:none;background:none;color:${INK};
  font-size:16px;line-height:1.85;padding:2px 0;overflow:hidden;}
.ta::placeholder{color:${FAINT};}
.imgBlock{position:relative;margin:10px 0 14px;}
.imgBlock img{display:block;width:100%;border-radius:16px;border:1px solid ${LINE};}
.imgDel{position:absolute;top:10px;right:10px;width:32px;height:32px;border-radius:50%;border:none;
  background:rgba(24,24,27,.62);color:#fff;display:grid;place-items:center;backdrop-filter:blur(4px);}
.caption{display:block;width:100%;border:none;outline:none;background:none;text-align:center;
  font-size:12px;color:${SUB};padding:8px 4px 0;}
.caption::placeholder{color:${FAINT};}

/* toolbar */
.toolbar{position:sticky;bottom:0;display:flex;align-items:center;gap:10px;
  padding:12px 16px;background:rgba(255,255,255,.92);backdrop-filter:blur(12px);border-top:1px solid ${LINE};}
.tool{display:inline-flex;align-items:center;gap:7px;border:1px solid ${INK};background:#fff;color:${INK};
  border-radius:12px;padding:11px 15px;font-size:13.5px;}
.tool:active{background:${LINE2};}
.tool.ghost{border-color:${LINE};color:${SUB};}
.tool.danger{border-color:${LINE};color:${RED};padding:11px 13px;}
.toolRight{margin-left:auto;display:flex;gap:8px;}

.toast{position:fixed;left:50%;bottom:84px;transform:translateX(-50%);background:${INK};color:#fff;
  font-size:13px;padding:10px 18px;border-radius:999px;z-index:50;animation:pop .2s ease;}
@keyframes pop{from{opacity:0;transform:translate(-50%,6px);}}

/* accounts */
.acctList{flex:1;padding:16px 16px 60px;}
.acctNote{font-size:12.5px;color:${SUB};line-height:1.8;margin:0 2px 18px;}
.acctRow{display:flex;align-items:center;gap:4px;background:#fff;border:1px solid ${LINE};border-radius:18px;
  padding:8px 8px 8px 14px;margin-bottom:10px;}
.acctRow.on{border-color:${INK};}
.acctMain{flex:1;display:flex;align-items:center;gap:14px;background:none;border:none;text-align:left;color:${INK};padding:8px 4px;}
.acctRowText{display:flex;flex-direction:column;min-width:0;}
.acctRowName{font-size:16px;font-weight:800;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.acctRowBio{font-size:11.5px;color:${MUT};margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:500;}
.acctRowSub{font-size:11.5px;color:${SUB};margin-top:3px;}
.addAcct{width:100%;display:flex;align-items:center;justify-content:center;gap:8px;
  background:none;border:1.5px dashed ${LINE};border-radius:18px;padding:18px;color:${SUB};font-size:14px;margin-top:6px;}
.addAcct:active{background:${LINE2};}
.addPlus{display:grid;place-items:center;}

/* overlay/sheet */
.overlay{position:fixed;inset:0;z-index:60;background:rgba(20,20,24,.32);backdrop-filter:blur(3px);
  display:flex;align-items:flex-end;justify-content:center;animation:fade .2s ease;transition:opacity .22s ease;}
@keyframes fade{from{opacity:0;}}
.sheet{width:100%;max-width:600px;background:${PAPER};border-radius:26px 26px 0 0;padding-top:12px;
  animation:up .26s cubic-bezier(.2,.9,.3,1);max-height:90vh;overflow-y:auto;}
@keyframes up{from{transform:translateY(100%);}}
.grab{width:40px;height:4px;border-radius:2px;background:${FAINT};margin:0 auto 16px;}
.swipeOverlay.closing{opacity:0;}
.swipeSheet{padding-top:0;will-change:transform;transition:transform .26s cubic-bezier(.22,.8,.25,1);overscroll-behavior-y:contain;}
.swipeSheet.closing{transition-duration:.22s;transition-timing-function:cubic-bezier(.4,0,1,1);}
.sheetDragZone{height:30px;display:flex;align-items:flex-start;touch-action:none;cursor:grab;}
.sheetDragZone:active{cursor:grabbing;}
.sheetDragZone .grab{margin:9px auto 0;transition:width .18s ease,background-color .18s ease;}
.sheetDragZone:active .grab{width:52px;background:${MUT};}
.sheetTitle{font-size:18px;font-weight:800;text-align:center;margin-bottom:18px;letter-spacing:.06em;}
.sheetBody{padding:0 22px 34px;}
.iconPick{display:flex;flex-direction:column;align-items:center;gap:8px;margin-bottom:22px;}
.iconPreview{position:relative;background:none;border:none;padding:0;border-radius:50%;cursor:pointer;}
.filePick{position:absolute;inset:0;width:100%;height:100%;opacity:0;cursor:pointer;}
.iconEdit{position:absolute;bottom:-4px;left:50%;transform:translateX(-50%);background:${INK};color:#fff;
  font-size:10px;padding:3px 9px;border-radius:999px;letter-spacing:.04em;}
.imageError{max-width:100%;color:${RED};font-size:12px;line-height:1.5;text-align:center;}
.fieldLabel{display:block;font-size:11px;letter-spacing:.2em;color:${SUB};margin-bottom:8px;text-transform:uppercase;}
.field{width:100%;border:1px solid ${LINE};border-radius:14px;padding:13px 15px;font-size:15px;outline:none;color:${INK};margin-bottom:20px;}
.field:focus{border-color:${INK};}
.handleRow{display:flex;align-items:center;gap:8px;margin-bottom:20px;}
.handleRow .at{color:${SUB};font-size:16px;}
.field.flat{margin-bottom:0;}
.primary{width:100%;background:${INK};color:#fff;border:none;border-radius:16px;padding:16px;font-size:15px;font-weight:500;letter-spacing:.04em;}
.primary:disabled{opacity:.35;}
.deleteLink{display:block;width:100%;background:none;border:none;color:${RED};font-size:13px;padding:18px 0 4px;}

@media (prefers-reduced-motion: reduce){*{animation:none!important;transition:none!important;scroll-behavior:auto!important;}}

/* ===== wide / tablet-landscape layout ===== */
.root{position:relative;display:flex;justify-content:center;align-items:flex-start;}
.mainCol{width:100%;min-width:0;overflow-x:clip;isolation:isolate;}
.routeStage{position:relative;width:100%;min-height:100dvh;background:#fff;touch-action:pan-y;}
.routeStage.routeDragging{z-index:25;animation:none!important;box-shadow:-18px 0 38px rgba(15,20,25,.18);will-change:transform;}
.routeStage.routeSettling{transition:transform .2s cubic-bezier(.22,.75,.25,1);}
.edgeBackCue{position:absolute;z-index:90;left:-42px;top:calc(50vh - 21px);width:42px;height:42px;border-radius:50%;display:grid;place-items:center;
  color:${TXT};background:#fff;box-shadow:0 4px 18px rgba(15,20,25,.16);opacity:var(--route-progress);transform:scale(.9);pointer-events:none;}
.motion-forward{animation:routeForward .26s cubic-bezier(.2,.78,.24,1);}
.motion-back{animation:routeBack .24s cubic-bezier(.2,.78,.24,1);}
.motion-tab{animation:routeTab .18s ease-out;}
@keyframes routeForward{from{opacity:.72;transform:translate3d(42px,0,0);}to{opacity:1;transform:none;}}
@keyframes routeBack{from{opacity:.76;transform:translate3d(-24px,0,0);}to{opacity:1;transform:none;}}
@keyframes routeTab{from{opacity:.55;transform:scale(.992);}to{opacity:1;transform:none;}}
.leftNav{display:none;}
.sidebar{display:none;}
.mobileNav{position:fixed;z-index:30;left:0;right:0;bottom:0;height:calc(58px + env(safe-area-inset-bottom));padding:0 18px env(safe-area-inset-bottom);
  display:flex;align-items:center;justify-content:space-around;background:rgba(255,255,255,.96);backdrop-filter:blur(14px);border-top:1px solid ${LINE};}
.mobileNav button{width:54px;height:54px;display:grid;place-items:center;border:none;background:none;color:${TXT};border-radius:50%;}
.mobileNav button{position:relative;transition:transform .14s ease,background-color .16s ease;}
.mobileNav button:active{transform:scale(.78);background:#EFF3F4;}
.mobileNav button.on svg{fill:${TXT};stroke-width:1.9;animation:navPop .22s cubic-bezier(.2,1.35,.35,1);}
.mobileNav button.on:after{content:"";position:absolute;bottom:3px;width:4px;height:4px;border-radius:50%;background:${BL};}
@keyframes navPop{from{transform:scale(.7);}to{transform:scale(1);}}
@media (max-width:899px){
  .root,.mainCol,.screen{width:100%;max-width:100%;min-width:0;margin:0;padding-left:0;padding-right:0;}
  .screen{padding-bottom:calc(58px + env(safe-area-inset-bottom));}
  .compose.screen{padding-bottom:0;}
  .fab{bottom:calc(76px + env(safe-area-inset-bottom));right:18px;}
  .syncPill{bottom:calc(68px + env(safe-area-inset-bottom));}
  .accountEditSheet{height:calc(100vh - 8px);max-height:calc(100vh - 8px);height:calc(100dvh - max(8px,env(safe-area-inset-top)));max-height:calc(100dvh - max(8px,env(safe-area-inset-top)));scroll-padding:64px 0 160px;}
  .accountEditSheet .sheetBody{padding-bottom:max(34px,calc(20px + env(safe-area-inset-bottom)));}
}
@media (min-width:900px){
  .mobileNav{display:none;}
  .leftNav{display:block;flex:0 0 88px;width:88px;align-self:stretch;min-height:100vh;}
  .leftNavInner{position:sticky;top:0;height:100vh;display:flex;flex-direction:column;align-items:center;padding:8px 10px 12px;}
  .navLinks{width:100%;display:flex;flex-direction:column;align-items:center;gap:4px;}
  .navButton{width:54px;height:54px;border:none;background:none;border-radius:50%;display:flex;align-items:center;justify-content:center;color:${TXT};}
  .navButton:hover{background:#EFF3F4;}
  .navButton.on svg{fill:${TXT};stroke-width:1.9;}
  .navButton span,.navCompose span,.navAccountText,.navAccount>svg{display:none;}
  .navCompose{width:52px;height:52px;display:grid;place-items:center;border:none;border-radius:50%;background:${BL};color:#fff;margin-top:14px;box-shadow:0 5px 14px rgba(29,155,240,.22);}
  .navCompose svg{width:22px;height:22px;}
  .navAccount{width:54px;height:54px;margin-top:auto;display:flex;align-items:center;justify-content:center;border:none;background:none;border-radius:50%;padding:6px;color:${TXT};}
  .navAccount:hover{background:#EFF3F4;}
  .mainCol{flex:0 0 600px;width:600px;border-left:1px solid ${LINE};border-right:1px solid ${LINE};min-height:100vh;position:relative;}
  .screen{position:relative;}
  .fab{display:none;}
  .mobileOnly{display:none!important;}
  .desktopOnly{display:flex;}
  .timelineHeading{flex:1;min-width:0;flex-direction:column;align-items:flex-start;border:none;background:none;padding:6px 0;text-align:left;color:${TXT};}
  .timelineHeading>span{font-size:19px;font-weight:800;line-height:1.15;max-width:440px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
  .timelineHeading small{font-size:12px;color:${MUT};font-weight:400;margin-top:2px;}
  .topbar .iconBtn{margin-right:-8px;}
  .overlayInner,.sheet,.confirmBox{margin:0 auto;}
}
@media (min-width:1180px){
  .sidebar{display:block;flex:0 0 360px;width:360px;align-self:stretch;position:sticky;top:0;height:100vh;overflow-y:auto;padding:12px 18px 40px;}
}
@media (min-width:1320px){
  .leftNav{flex-basis:260px;width:260px;}
  .leftNavInner{align-items:stretch;padding-left:18px;padding-right:18px;}
  .navLinks{align-items:stretch;gap:4px;}
  .navButton{width:max-content;max-width:100%;height:52px;padding:0 18px;gap:20px;border-radius:999px;justify-content:flex-start;font-size:20px;font-weight:400;}
  .navButton.on{font-weight:700;}
  .navButton span,.navCompose span,.navAccountText,.navAccount>svg{display:flex;}
  .navCompose{width:100%;height:52px;border-radius:999px;display:flex;gap:10px;font-size:17px;font-weight:700;margin-top:14px;}
  .navCompose svg{display:none;}
  .navAccount{width:100%;height:64px;justify-content:flex-start;gap:10px;border-radius:999px;padding:10px;}
  .navAccountText{flex:1;min-width:0;flex-direction:column;align-items:flex-start;line-height:1.25;}
  .navAccountText b,.navAccountText small{max-width:135px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
  .navAccountText b{font-size:14px;}
  .navAccountText small{font-size:13px;color:${MUT};font-weight:400;}
  .navAccount>svg{width:18px;}
}
.sideSearch{margin:6px 0 16px;}
.sideCard{background:#F7F9F9;border:none;border-radius:16px;padding:14px 16px 16px;margin-bottom:16px;}
.sideTitle{font-size:20px;font-weight:800;color:${TXT};margin-bottom:12px;}
.sideEmpty{font-size:12.5px;color:${FAINT};line-height:1.8;padding:18px 6px;text-align:center;}
.sideStat{display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-top:1px solid #EFF3F4;font-size:14px;color:${MUT};}
.sideStat b{font-size:15px;color:${TXT};}
.sideFoot{font-size:12px;color:${MUT};padding-top:10px;border-top:1px solid #EFF3F4;}
.sideLegal{font-size:12px;color:${MUT};padding:0 12px;}
.imgGrid{display:grid;grid-template-columns:repeat(3,1fr);gap:4px;}
.imgCell{aspect-ratio:1;border:none;border-radius:8px;background:#eee center/cover no-repeat;cursor:pointer;padding:0;}
.imgCell:active{opacity:.8;}

/* login */
.login{min-height:100vh;width:100%;display:flex;align-items:center;justify-content:center;padding:28px;background:#fff;}
.loginInner{width:100%;max-width:360px;text-align:center;}
.loginBrand{font-size:44px;font-weight:900;letter-spacing:.01em;color:${INK};}
.loginTag{font-size:13px;color:${MUT};margin-top:12px;letter-spacing:.06em;}
.loginBtns{margin-top:48px;display:flex;flex-direction:column;gap:12px;}
.googleBtn{display:flex;align-items:center;justify-content:center;gap:10px;width:100%;background:#fff;color:${TXT};
  border:1px solid ${BRD2};border-radius:999px;padding:15px;font-size:15px;font-weight:700;}
.googleBtn:active{background:${LINE2};}
.guestBtn{width:100%;background:${INK};color:#fff;border:none;border-radius:999px;padding:15px;font-size:15px;font-weight:700;}
.guestBtn:active{opacity:.88;}
.googleBtn:disabled,.guestBtn:disabled,.miniToggle:disabled{cursor:wait;opacity:.6;}
.loginNote{font-size:11.5px;color:${FAINT};line-height:1.8;margin-top:22px;}
.syncPill{position:fixed;right:16px;bottom:16px;z-index:80;background:#18181B;color:#fff;border-radius:999px;padding:8px 12px;font-size:11px;font-weight:700;box-shadow:0 6px 18px rgba(0,0,0,.16);}
.syncPill.warn{background:#8A4B08;}
.navCompose:disabled{cursor:wait;opacity:.5;box-shadow:none;}
.syncError{width:min(420px,calc(100% - 40px));margin:20vh auto 0;background:#fff;border:1px solid ${LINE};border-radius:20px;padding:26px;box-shadow:0 10px 30px rgba(0,0,0,.08);}
.syncErrorTitle{font-size:18px;font-weight:800;color:${INK};}
.syncErrorText{font-size:13px;line-height:1.8;color:${MUT};margin:10px 0 22px;}

/* topbar avatar button */
.avatarBtn{border:none;background:none;padding:0;border-radius:50%;display:grid;place-items:center;}
.avatarBtn:active{opacity:.7;}
.topbar .acctBtn{flex:1;justify-content:center;}

/* timeline profile header (full, X-style) */
.tlProfile{border-bottom:1px solid ${LINE};}
.tlCover{height:clamp(112px,30vw,200px);background:#CFD9DE center/cover no-repeat;}
.tlProfBody{padding:0 16px 14px;}
.tlProfRow1{display:flex;justify-content:space-between;align-items:flex-end;margin-top:-39px;margin-bottom:10px;}
.tlAvatarWrap{border:none;background:#fff;padding:0;border-radius:50%;border:4px solid #fff;line-height:0;}
.tlAvatarWrap .avatar{width:74px;height:74px;}
.tlEditBtn{border:1px solid ${BRD2};background:#fff;color:${TXT};border-radius:999px;padding:7px 15px;font-size:13.5px;font-weight:700;white-space:nowrap;margin-bottom:4px;}
.tlEditBtn:hover,.tlEditBtn:active{background:#EFF3F4;}
.tlProfName{font-size:18px;font-weight:800;color:${TXT};display:flex;align-items:center;gap:5px;}
.tlProfHandle{font-size:14px;color:${MUT};margin-top:1px;}
.tlProfBio{font-size:14px;line-height:1.55;color:${TXT};font-weight:400;margin-top:10px;white-space:pre-wrap;}
.tlProfJoined{display:flex;align-items:center;gap:6px;font-size:13px;color:${MUT};margin-top:10px;}
.tlProfStats{display:flex;gap:6px;font-size:13px;color:${MUT};margin-top:10px;}
.tlProfStats b{color:${TXT};margin-left:8px;}
.tlProfStats b:first-child{margin-left:0;}
.timelineTabs{height:54px;display:flex;border-bottom:1px solid ${LINE};}
.timelineTabs button{position:relative;flex:1;border:none;background:none;color:${MUT};font-size:14px;}
.timelineTabs button:hover{background:rgba(15,20,25,.05);}
.timelineTabs button.on{color:${TXT};font-weight:700;}
.timelineTabs button.on span:after{content:"";position:absolute;height:4px;border-radius:999px;background:${BL};left:50%;right:auto;width:56px;bottom:0;transform:translateX(-50%);}
.timelineContent{flex:1;min-height:0;width:100%;display:flex;flex-direction:column;animation:timelineIn .2s cubic-bezier(.2,.8,.3,1);}
@keyframes timelineIn{from{opacity:.45;transform:translate3d(10px,0,0);}to{opacity:1;transform:none;}}

/* confirm dialog */
.overlay.center{align-items:center;justify-content:center;padding:24px;}
.confirmBox{background:#fff;border-radius:20px;max-width:340px;width:100%;padding:24px 22px 16px;
  box-shadow:0 20px 50px rgba(0,0,0,.25);animation:pop .18s ease;}
.confirmMsg{font-size:15px;line-height:1.7;color:${TXT};white-space:pre-wrap;margin-bottom:18px;font-weight:600;}
.confirmBtns{display:flex;gap:10px;justify-content:flex-end;}
.cfBtn{border:1px solid ${LINE};background:#fff;color:${TXT};border-radius:999px;padding:10px 18px;font-size:14px;font-weight:700;}
.cfBtn.cfPrimary{background:${INK};color:#fff;border-color:${INK};}
.cfBtn.cfDanger{background:${RED};color:#fff;border-color:${RED};}

/* composer: avatar top-left, thin text */
.postBtn{background:${BL};color:#fff;border:none;border-radius:999px;padding:8px 18px;font-size:14px;font-weight:800;}
.postBtn:disabled{opacity:.55;}
.composeCancel{color:${TXT};font-weight:500;}
.composeRow{display:flex;gap:12px;align-items:flex-start;}
.composeAvatar{border:none;background:none;padding:0;flex-shrink:0;border-radius:50%;margin-top:2px;}
.composeAvatar:active{opacity:.7;}
.composeCol{flex:1;min-width:0;}
.audience{display:inline-flex;align-items:center;gap:4px;border:1px solid ${BL};color:${BL};background:none;
  border-radius:999px;padding:3px 12px;font-size:13px;font-weight:700;margin-bottom:6px;}
.audience svg{color:${BL};}
.ta{width:100%;border:none;outline:none;resize:none;background:none;color:${TXT};
  font-family:-apple-system,BlinkMacSystemFont,'Hiragino Sans','Noto Sans JP','Segoe UI',sans-serif;
  font-weight:400;font-size:17px;line-height:1.5;padding:4px 0;overflow:hidden;}
.ta::placeholder{color:${FAINT};font-weight:400;}

/* profile */
.profTop{gap:10px;}
.profTopName{flex:1;}
.profTopTitle{font-size:17px;font-weight:800;color:${TXT};line-height:1.1;}
.profTopSub{font-size:12px;color:${MUT};margin-top:2px;}
.profScroll{flex:1;overflow-y:auto;}
.cover{height:140px;background:${BRD2} center/cover no-repeat;}
.profBody{padding:0 16px 4px;position:relative;}
.profRow1{display:flex;justify-content:space-between;align-items:flex-end;margin-top:-42px;margin-bottom:10px;}
.profAvatar{display:inline-block;border-radius:50%;border:4px solid #fff;background:#fff;}
.profAvatar .avatar{width:84px;height:84px;}
.editProfile{border:1px solid ${BRD2};background:#fff;color:${TXT};border-radius:999px;padding:8px 16px;font-size:14px;font-weight:700;margin-bottom:6px;}
.editProfile:active{background:${LINE2};}
.profName{font-size:21px;font-weight:800;color:${TXT};display:flex;align-items:center;gap:6px;}
.profHandle{font-size:15px;color:${MUT};margin-top:1px;}
.profBio{font-size:15px;line-height:1.5;color:${TXT};margin-top:12px;white-space:pre-wrap;font-weight:400;}
.profJoined{display:flex;align-items:center;gap:6px;font-size:14px;color:${MUT};margin-top:12px;}
.profDivider{height:1px;background:${LINE};margin-top:16px;}
.profPosts{}

/* account sheet cover picker */
.coverPick{width:100%;height:120px;border-radius:14px;border:1px dashed ${LINE};background:#EAF0F2 center/cover no-repeat;
  position:relative;overflow:hidden;display:grid;place-items:center;margin-bottom:16px;color:${MUT};cursor:pointer;}
.coverHint{font-size:13px;font-weight:700;}

/* commonplace */
.cpScroll{flex:1;overflow-y:auto;padding:14px 16px 0;}
.cpIntro{font-size:13px;color:${MUT};line-height:1.8;margin:0 2px 14px;}
.cpSearch{margin-bottom:6px;}
.cpResults{margin-top:8px;}
.cpResultHead{display:flex;align-items:center;justify-content:space-between;padding:8px 2px 4px;font-size:13px;color:${MUT};font-weight:700;}
.cpSave{background:${INK};color:#fff;border:none;border-radius:999px;padding:8px 14px;font-size:13px;font-weight:700;}
.cpSectionHead{font-size:12px;letter-spacing:.18em;color:${MUT};text-transform:uppercase;margin:14px 2px 12px;font-weight:700;}
.cpCard{display:block;width:100%;text-align:left;background:#fff;border:1px solid ${LINE};border-radius:18px;padding:16px;margin-bottom:12px;}
.cpCard:active{background:${LINE2};}
.cpCardTop{display:flex;align-items:center;gap:10px;color:${TXT};}
.cpCardTop svg{color:${INK};}
.cpCardName{flex:1;font-size:16px;font-weight:800;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.cpCount{font-size:13px;color:#fff;background:${INK};border-radius:999px;min-width:24px;text-align:center;padding:2px 8px;font-weight:700;}
.cpCardSub{font-size:12px;color:${MUT};margin-top:8px;}
.cpCardPreview{font-size:13px;color:${MUT};margin-top:6px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.cpDetail{flex:1;overflow-y:auto;padding:8px 16px 0;}
.cpQueryNote{font-size:12.5px;color:${MUT};background:${LINE2};border-radius:12px;padding:10px 12px;margin-bottom:10px;line-height:1.6;}
.cpItem{border-bottom:1px solid ${LINE};}
.cpItem .xpost{border-bottom:none;}
.cpRemove{display:block;margin:0 0 10px 60px;background:none;border:none;color:${BL};font-size:12.5px;font-weight:700;padding:2px 0 10px;}
.cpRowIcon{display:grid;place-items:center;width:42px;height:42px;border-radius:50%;background:${LINE2};color:${INK};}

/* date search */
.searchWrap{display:flex;align-items:center;gap:8px;}
.searchWrap .search{flex:1;}
.dateBtn{position:relative;flex-shrink:0;width:42px;height:42px;border:1px solid transparent;border-radius:50%;background:#EFF3F4;color:${INK};display:grid;place-items:center;cursor:pointer;}
.dateBtn:hover,.dateBtn:active{background:#E7ECEF;}
.dateBtn svg{color:${INK};}
.dateInput{position:absolute;inset:0;width:100%;height:100%;opacity:0;border:none;padding:0;margin:0;cursor:pointer;}
.dateInput::-webkit-calendar-picker-indicator{position:absolute;inset:0;width:100%;height:100%;margin:0;opacity:0;cursor:pointer;}
.allPostsBtn{flex-shrink:0;height:42px;border:1px solid ${LINE};border-radius:13px;background:#fff;color:${MUT};font-size:12px;padding:0 11px;white-space:nowrap;}
.allPostsBtn:active,.allPostsBtn.on{background:${INK};border-color:${INK};color:#fff;}
.allPostsHead{display:flex;align-items:center;justify-content:space-between;padding:7px 2px 11px;color:${MUT};font-size:12px;letter-spacing:.04em;}
.allPostsHead span:first-child{color:${INK};font-size:14px;font-weight:800;}
.allPostsTools{display:flex;align-items:center;gap:10px;}
.allPostsTools .dayCopy{letter-spacing:0;}
.xTime.asLink{background:none;border:none;padding:0;color:${MUT};font-size:15px;font-weight:400;cursor:pointer;}
.xTime.asLink:active{text-decoration:underline;color:${INK};}

/* day view */
.fullPane{width:100%;max-width:600px;background:#fff;display:flex;flex-direction:column;height:100vh;animation:up .26s cubic-bezier(.2,.9,.3,1);}
.scopeBar{display:flex;gap:8px;overflow-x:auto;padding:10px 16px;border-bottom:1px solid ${LINE};-webkit-overflow-scrolling:touch;}
.scopeBar::-webkit-scrollbar{display:none;}
.scopeChip{flex-shrink:0;display:inline-flex;align-items:center;gap:6px;border:1px solid ${LINE};background:#fff;color:${TXT};
  border-radius:999px;padding:7px 14px;font-size:13px;font-weight:700;white-space:nowrap;}
.scopeChip .avatar{width:18px;height:18px;}
.scopeChip.on{background:${INK};color:#fff;border-color:${INK};}
.dvScroll{flex:1;overflow-y:auto;}

/* about */
.aboutScroll{flex:1;overflow-y:auto;padding:8px 18px 0;}
.aboutBrand{font-size:40px;font-weight:900;letter-spacing:.02em;text-align:center;margin:18px 0 18px;color:${INK};}
.aboutThanks{text-align:center;font-size:14px;line-height:1.9;color:${TXT};margin:0 0 4px;font-weight:600;}
.aboutThanks.sub{font-size:12.5px;color:${MUT};margin-bottom:24px;font-weight:500;}
.aboutRow{display:flex;align-items:center;gap:12px;width:100%;text-align:left;background:#fff;border:1px solid ${LINE};
  border-radius:16px;padding:15px 16px;margin-bottom:10px;}
.aboutRow:active{background:${LINE2};}
.aboutRow.static{cursor:default;}
.aboutRowMain{flex:1;min-width:0;display:flex;flex-direction:column;}
.aboutRowT{font-size:15px;font-weight:700;color:${TXT};}
.aboutRowSub{font-size:11.5px;color:${MUT};margin-top:3px;}
.aboutChev{color:${FAINT};font-size:18px;}
.miniToggle{border:1px solid ${INK};background:#fff;color:${INK};border-radius:999px;padding:7px 16px;font-size:13px;font-weight:700;}
.miniToggle.on{background:${INK};color:#fff;}
.aboutSection{font-size:11px;letter-spacing:.2em;text-transform:uppercase;color:${MUT};font-weight:700;margin:22px 4px 10px;}
.aboutPlaceholder{font-size:13px;color:${FAINT};background:${LINE2};border-radius:14px;padding:18px;text-align:center;}
.aboutCredit{display:block;margin:32px auto 0;background:none;border:none;color:${MUT};font-size:12px;letter-spacing:.1em;padding:10px;}
.aboutLink{display:flex;align-items:center;justify-content:center;gap:6px;width:100%;background:none;border:none;
  color:${MUT};font-size:13px;font-weight:700;padding:18px 0 6px;margin-top:6px;}
`;
