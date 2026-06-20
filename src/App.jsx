import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { getFirebaseUser, isGoogleUser, signInWithGoogle, signOutFirebaseUser, subscribeToFirebaseUser } from "./firebase.js";

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
const LK  = "#0F1419";   // like (mono)
const RTC = "#0F1419";   // repost (mono)
const BL  = "#0F1419";   // accent (mono)
const COVERBG = "#E4E4E6"; // neutral grey cover
const BRD2 = "#D6D6DB";    // neutral border
const RED = "#F4212E";     // destructive

const DEFAULT_AVATAR = "data:image/jpeg;base64,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";

/* ---------- persisted storage (artifact window.storage) ---------- */
function usePersisted(key, init) {
  const [val, setVal] = useState(init);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        if (window.storage) {
          const r = await window.storage.get(key);
          if (alive && r?.value != null) setVal(JSON.parse(r.value));
        }
      } catch (_) {}
      if (alive) setLoaded(true);
    })();
    return () => { alive = false; };
  }, [key]);
  useEffect(() => {
    if (!loaded) return;
    (async () => {
      try { if (window.storage) await window.storage.set(key, JSON.stringify(val)); } catch (_) {}
    })();
  }, [key, val, loaded]);
  return [val, setVal, loaded];
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
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > maxSide || height > maxSide) {
          const s = maxSide / Math.max(width, height);
          width = Math.round(width * s); height = Math.round(height * s);
        }
        const c = document.createElement("canvas");
        c.width = width; c.height = height;
        c.getContext("2d").drawImage(img, 0, 0, width, height);
        resolve({ src: c.toDataURL("image/jpeg", quality), w: width, h: height });
      };
      img.onerror = reject;
      img.src = r.result;
    };
    r.onerror = reject;
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

/* ---------- model ---------- */
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const newAccount = (name) => ({ id: uid(), name, handle: "", icon: "", bio: "", cover: "", createdAt: new Date().toISOString() });
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
  const [accounts, setAccounts, accLoaded] = usePersisted("nb.accounts", []);
  const [entries, setEntries] = usePersisted("nb.entries", []);
  const [currentId, setCurrentId] = usePersisted("nb.current", "");

  // seed default accounts on first run
  useEffect(() => {
    if (!accLoaded) return;
    if (accounts.length === 0) {
      const seeded = SEED_ACCOUNTS.map(s => ({ ...newAccount(s.name), bio: s.bio }));
      setAccounts([makeAll(), ...seeded]);
      setCurrentId(seeded[0].id);
      return;
    }
    if (!accounts.find(a => a.isAll)) {
      setAccounts(as => [makeAll(), ...as.filter(a => !a.isAll)]);
    }
    if (!accounts.find(a => a.id === currentId)) {
      setCurrentId((accounts.find(a => !a.isAll) || accounts[0]).id);
    }
  }, [accLoaded]); // eslint-disable-line

  const [view, setView] = useState("timeline"); // timeline | compose | accounts
  const [editId, setEditId] = useState(null);

  const account = accounts.find(a => a.id === currentId) || null;
  const accEntries = useMemo(
    () => (account?.isAll ? [...entries] : entries.filter(e => e.accountId === currentId))
      .sort((a, b) => a.createdAt < b.createdAt ? 1 : -1),
    [entries, currentId, account]
  );

  const upsert = useCallback((entry) => {
    setEntries(es => {
      const i = es.findIndex(e => e.id === entry.id);
      if (i === -1) return [entry, ...es];
      const copy = es.slice(); copy[i] = entry; return copy;
    });
  }, [setEntries]);
  const remove = useCallback((id) => setEntries(es => es.filter(e => e.id !== id)), [setEntries]);
  const patch = useCallback((id, p) => setEntries(es => es.map(e => e.id === id ? { ...e, ...p } : e)), [setEntries]);
  const [draft, setDraft] = useState(null);
  const [collections, setCollections] = usePersisted("nb.collections", []);
  const [cpFor, setCpFor] = useState(null); // entry to add to a commonplace
  const [dayView, setDayView] = useState(null); // {date}
  const [icloud, setIcloud] = usePersisted("nb.icloud", false);
  const [aboutBack, setAboutBack] = useState("accounts");
  const openAbout = (from) => { setAboutBack(from); setView("about"); };
  const [auth, setAuth, authLoaded] = usePersisted("nb.auth", null);
  const [firebaseUser, setFirebaseUser] = useState(undefined);
  const [authBusy, setAuthBusy] = useState(false);

  useEffect(() => subscribeToFirebaseUser(setFirebaseUser), []);
  useEffect(() => {
    // 旧バージョンが保存したダミーの Google ログイン状態を正しい状態へ戻す。
    if (authLoaded && firebaseUser && auth?.mode === "google" && !isGoogleUser(firebaseUser)) {
      setAuth(null);
    }
  }, [authLoaded, firebaseUser, auth, setAuth]);

  const beginGuest = async () => {
    setAuthBusy(true);
    try {
      await getFirebaseUser();
      setAuth({ mode: "guest", at: Date.now() });
    } catch (_) {
      await askAlert("Firebase へ接続できませんでした。設定を確認してもう一度お試しください。");
    } finally {
      setAuthBusy(false);
    }
  };

  const beginGoogle = async () => {
    setAuthBusy(true);
    try {
      const result = await signInWithGoogle();
      const nextAuth = { mode: "google", at: Date.now() };
      // 既存の Google アカウントに切り替えた場合は、同アカウントのクラウド記録を読み直す。
      if (result.switchedUser) {
        window.localStorage.setItem("nb.auth", JSON.stringify(nextAuth));
        window.location.reload();
        return;
      }
      setAuth(nextAuth);
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
      setView("timeline");
    } catch (_) {
      await askAlert("ログアウトできませんでした。もう一度お試しください。");
    } finally {
      setAuthBusy(false);
    }
  };

  const realFirst = () => accounts.find(a => !a.isAll) || account;
  const startCompose = () => { setEditId(null); setDraft(account?.isAll ? newEntry(realFirst().id) : null); setView("compose"); };
  const openEntry = (id) => { setDraft(null); setEditId(id); setView("compose"); };
  const quote = (entry) => {
    const acc = accounts.find(a => a.id === entry.accountId) || account;
    const target = account?.isAll ? realFirst().id : currentId;
    setDraft({ ...newEntry(target), blocks: [{ id: uid(), type: "text", value: "" }, quoteBlockFrom(entry, acc)] });
    setEditId(null); setView("compose");
  };
  const saveAccount = (acc) => setAccounts(as => as.map(a => a.id === acc.id ? { ...a, ...acc } : a));
  const addToCollection = (colId, entryId) =>
    setCollections(cs => cs.map(c => c.id === colId ? { ...c, itemIds: [...new Set([...(c.itemIds || []), entryId])] } : c));
  const createCollection = (name, query = "") => {
    const c = { id: uid(), name: name.trim() || "コモンプレイス", query: query.trim(), itemIds: [], createdAt: new Date().toISOString() };
    setCollections(cs => [c, ...cs]); return c;
  };

  const editing = editId ? entries.find(e => e.id === editId) : null;

  if (!authLoaded || firebaseUser === undefined) return <div style={S.root}><style>{CSS}</style><ConfirmHost /></div>;
  if (!auth) return (
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

  if (!account) return <div style={S.root}><style>{CSS}</style><ConfirmHost /><div style={{padding:40,color:SUB}}>読み込み中…</div></div>;

  return (
    <div style={S.root} className="root">
      <style>{CSS}</style>
      <ConfirmHost />

      <div className="mainCol">
      {view === "timeline" && (
        <Timeline
          account={account}
          accounts={accounts}
          entries={accEntries}
          onCompose={startCompose}
          onOpen={openEntry}
          onPatch={patch}
          onPostDelete={remove}
          onQuote={quote}
          onAddCommonplace={setCpFor}
          onSwitch={() => setView("accounts")}
          onProfile={() => setView("profile")}
          onCommonplace={() => setView("commonplace")}
          onCopyDay={(items) => copyText(items.map(entryPlainText).filter(Boolean).join("\n\n— — —\n\n"))}
        />
      )}

      {view === "compose" && (
        <Composer
          key={editing ? editing.id : (draft ? draft.id : "new")}
          accounts={accounts}
          initial={editing || draft || newEntry(currentId)}
          isNew={!editing}
          onSave={(e) => { if (!entryEmpty(e)) upsert(e); setDraft(null); setView("timeline"); }}
          onCancel={() => { setDraft(null); setView("timeline"); }}
          onDelete={editing ? () => { remove(editing.id); setView("timeline"); } : null}
          onCopy={(e) => copyText(entryPlainText(e))}
        />
      )}

      {view === "accounts" && (
        <Accounts
          accounts={accounts} setAccounts={setAccounts}
          currentId={currentId} setCurrentId={setCurrentId}
          entries={entries} setEntries={setEntries}
          onProfile={() => setView("profile")}
          onAbout={() => openAbout("accounts")}
          onClose={() => setView("timeline")}
        />
      )}

      {view === "about" && (
        <About icloud={icloud} setIcloud={setIcloud} user={firebaseUser} onGoogle={beginGoogle} onLogout={logout} busy={authBusy} onClose={() => setView(aboutBack)} />
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
          onClose={() => setView("timeline")}
        />
      )}

      {view === "commonplace" && (
        <Commonplace
          accounts={accounts} entries={entries} collections={collections} setCollections={setCollections}
          onCreate={createCollection}
          onOpenEntry={openEntry} onPatch={patch} onPostDelete={remove} onQuote={quote} onAddCommonplace={setCpFor}
          onOpenDay={(date) => setDayView({ date })}
          onClose={() => setView("timeline")}
        />
      )}
      </div>

      <Sidebar entries={account?.isAll ? entries : entries.filter(e => e.accountId === currentId)} allEntries={entries} onOpenEntry={openEntry} />

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
function Timeline({ account, accounts, entries, onCompose, onOpen, onPatch, onPostDelete, onQuote, onAddCommonplace, onSwitch, onProfile, onCommonplace, onCopyDay }) {
  const [q, setQ] = useState("");
  const [jumpDate, setJumpDate] = useState(null);
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

  return (
    <div className="screen">
      <header className="topbar">
        <button className="avatarBtn" onClick={onProfile} aria-label="プロフィール"><Avatar account={account} size={32} /></button>
        <button className="acctBtn" onClick={onSwitch}>
          <span className="acctName">{accLabel(account)}</span>
          <Chevron />
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
        </div>
      </div>

      <div className="searchWrap">
        <div className="search">
          <SearchIcon />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="このノートを検索" />
          {q && <button className="clr" onClick={() => setQ("")}>✕</button>}
        </div>
        <label className="dateBtn" aria-label="日付で移動">
          <Cal />
          <input type="date" className="dateInput" onChange={e => { if (e.target.value) setJumpDate({ date: e.target.value, n: Date.now() }); }} />
        </label>
      </div>

      {q.trim() ? (
        <main className="feed">
          {days.length === 0
            ? <div className="empty"><div className="emptyMark"><GhostMark size={40} /></div>見つかりませんでした。</div>
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
            <div className="emptyMark"><GhostMark size={40} /></div>
            まだ何もありません。<br />右下の＋から書きはじめましょう。
          </div>
        </main>
      ) : (
        <DayPager days={days} acctFor={acctFor} jumpDate={jumpDate} onOpen={onOpen} onCopyDay={onCopyDay} onPatch={onPatch} onPostDelete={onPostDelete} onQuote={onQuote} onAddCommonplace={onAddCommonplace} />
      )}

      <button className="fab" onClick={onCompose} aria-label="書く"><Plus /></button>
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
  const g = useRef({ down: false, sx: 0, sy: 0, axis: null });

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

  const onDown = e => { g.current = { down: true, sx: e.clientX, sy: e.clientY, axis: null }; setAnim(false); };
  const onMove = e => {
    const s = g.current; if (!s.down) return;
    const dx = e.clientX - s.sx, dy = e.clientY - s.sy;
    if (!s.axis) {
      if (Math.abs(dx) > 8 || Math.abs(dy) > 8) s.axis = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
      else return;
    }
    if (s.axis === "y") return;
    setDrag(dx);
  };
  const end = () => {
    const s = g.current; if (!s.down) return; s.down = false; setAnim(true);
    if (s.axis === "x") {
      const th = Math.max(48, w * 0.18);
      if (drag <= -th) setIndex(i => clamp(i + 1));
      else if (drag >= th) setIndex(i => clamp(i - 1));
    }
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
        onPointerDown={onDown} onPointerMove={onMove} onPointerUp={end} onPointerCancel={end} onPointerLeave={end}
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
          ? days.map((_, i) => <span key={i} className={"dot" + (i === index ? " on" : "")} onClick={() => go(i)} />)
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
            <button className="xIcon"><SlashCircle /></button>
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
          <button className="xAct"><Comment /></button>
          <div className="xActWrap">
            <button className={"xAct" + (rt ? " rt" : "")} onClick={() => setMenu(menu === "rt" ? null : "rt")}>
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
          <button className={"xAct" + (liked ? " like" : "")} onClick={() => onPatch(entry.id, { liked: !liked })}>
            {liked ? <HeartFill /> : <Heart />}{liked && <span className="xCnt">1</span>}
          </button>
          <button className="xAct"><Views /></button>
          <span className="xSpacer" />
          <button className={"xAct" + (booked ? " bm" : "")} onClick={() => onPatch(entry.id, { bookmarked: !booked })}>
            {booked ? <BookmarkFill /> : <Bookmark />}
          </button>
          <button className="xAct" onClick={() => copyText(entryPlainText(entry))}><Share /></button>
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
  const [toast, setToast] = useState("");
  const account = accounts.find(a => a.id === acctId) || accounts[0];

  const showToast = (m) => { setToast(m); setTimeout(() => setToast(""), 1400); };

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
    const files = [...fileList].slice(0, 8);
    const made = [];
    for (const f of files) {
      try { const r = await compressImage(f); made.push({ id: uid(), type: "image", src: r.src, w: r.w, h: r.h, caption: "" }); } catch (_) {}
    }
    if (!made.length) return;
    setBlocks(bs => {
      const at = Math.min(Math.max(focusIdx, 0), bs.length - 1);
      const head = bs.slice(0, at + 1);
      const tail = bs.slice(at + 1);
      let next = [...head, ...made, ...tail];
      if (next[next.length - 1].type !== "text")
        next = [...next, { id: uid(), type: "text", value: "" }];
      return next;
    });
  };

  const onPick = (e) => { const files = [...(e.target.files || [])]; e.target.value = ""; if (files.length) addImages(files); };

  const handlePaste = (e) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    const imgs = [...items].filter(it => it.type.startsWith("image/")).map(it => it.getAsFile()).filter(Boolean);
    if (imgs.length) { e.preventDefault(); addImages(imgs); }
  };

  const save = () => {
    const trimmed = blocks
      .filter((b, i) => !(b.type === "text" && !b.value.trim()) || blocks.filter(x => x.type === "text").length === 1)
      .map(b => b.type === "text" ? { ...b, value: b.value.replace(/\s+$/,"") } : b);
    onSave({ ...initial, accountId: acctId, blocks: trimmed.length ? trimmed : blankBlocks(), updatedAt: new Date().toISOString() });
  };

  return (
    <div className="screen compose">
      <header className="topbar compTop">
        <button className="txtbtn" onClick={onCancel}>とじる</button>
        <span style={{ flex: 1 }} />
        <button className="postBtn" onClick={save}>保存</button>
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
                placeholder={i === 0 ? "いま思っていること、今日のこと、英文…" : "つづきを書く…"}
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
        <button className="tool" onClick={() => fileRef.current?.click()}><ImageIcon /> 画像をここに差し込む</button>
        <input ref={fileRef} type="file" accept="image/*" multiple style={{ display: "none" }} onChange={onPick} />
        <div className="toolRight">
          <button className="tool ghost" onClick={async () => { if (await onCopy({ ...initial, blocks })) showToast("本文をコピーしました"); }}>全文コピー</button>
          {onDelete && <button className="tool danger" onClick={async () => { if (await askConfirm("この記録を削除しますか？", { danger: true, okText: "削除" })) onDelete(); }}><Trash /></button>}
        </div>
      </div>

      {toast && <div className="toast">{toast}</div>}

      {pickAcct && (
        <div className="overlay" onClick={() => setPickAcct(false)}>
          <div className="sheet" onClick={e => e.stopPropagation()}>
            <div className="grab" />
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
          </div>
        </div>
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

  const save = (acc) => {
    setAccounts(as => {
      const i = as.findIndex(a => a.id === acc.id);
      if (i === -1) return [...as, acc];
      const c = as.slice(); c[i] = acc; return c;
    });
    if (!accounts.find(a => a.id === acc.id)) setCurrentId(acc.id);
    setEditing(null);
  };
  const del = async (acc) => {
    if (acc.isAll) { await askAlert("統合ノート（すべての記録）は削除できません。"); return; }
    const n = counts[acc.id] || 0;
    if (accounts.filter(a => !a.isAll).length <= 1) { await askAlert("最後のノートは削除できません。"); return; }
    if (!(await askConfirm(`「${acc.name}」を削除しますか？${n > 0 ? `\nこのノートの記録 ${n} 件もすべて削除されます。` : ""}`, { danger: true, okText: "削除" }))) return;
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
            <button className="iconBtn sm" onClick={() => setEditing(a)} aria-label="編集"><Pencil /></button>
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
  const iconRef = useRef(null);
  const coverRef = useRef(null);
  const pickIcon = async (e) => {
    const f = e.target.files?.[0]; e.target.value = ""; if (!f) return;
    try { const r = await compressImage(f, 300, 0.85); setIcon(r.src); } catch (_) {}
  };
  const pickCover = async (e) => {
    const f = e.target.files?.[0]; e.target.value = ""; if (!f) return;
    try { const r = await compressImage(f, 1000, 0.8); setCover(r.src); } catch (_) {}
  };
  return (
    <div className="overlay" onClick={onClose}>
      <div className="sheet" onClick={e => e.stopPropagation()}>
        <div className="grab" />
        <div className="sheetTitle">{isNew ? "新しいノート" : "プロフィールを編集"}</div>
        <div className="sheetBody">
          <button className="coverPick" onClick={() => coverRef.current?.click()} style={cover ? { backgroundImage: `url(${cover})` } : null}>
            {!cover && <span className="coverHint">＋ ヘッダー画像</span>}
          </button>
          <input ref={coverRef} type="file" accept="image/*" style={{ display: "none" }} onChange={pickCover} />
          <div className="iconPick">
            <button className="iconPreview" onClick={() => iconRef.current?.click()}>
              <Avatar account={{ name, icon }} size={72} />
              <span className="iconEdit">変更</span>
            </button>
            <input ref={iconRef} type="file" accept="image/*" style={{ display: "none" }} onChange={pickIcon} />
            {(icon || cover) && <button className="txtbtn" onClick={() => { setIcon(""); setCover(""); }}>画像をリセット</button>}
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
          <button className="primary" disabled={!name.trim() && !bio.trim()} onClick={() => onSave({ ...account, name: name.trim(), handle: handle.trim(), icon, bio, cover, _new: undefined })}>
            {isNew ? "作成する" : "保存する"}
          </button>
          {onDelete && <button className="deleteLink" onClick={onDelete}>このノートを削除</button>}
        </div>
      </div>
    </div>
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
            <button className="editProfile" onClick={() => setEdit(true)}>プロフィールを編集</button>
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
      {edit && <AccountSheet account={account} isNew={false} onSave={(a) => { onSave(a); setEdit(false); }} onDelete={null} onClose={() => setEdit(false)} />}
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
      setCollections(cs => cs.filter(x => x.id !== c.id)); setSel(null);
    }
  };
  const removeItem = (c, id) => setCollections(cs => cs.map(x => x.id === c.id ? { ...x, itemIds: (x.itemIds || []).filter(i => i !== id) } : x));

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
    <div className="overlay" onClick={onClose}>
      <div className="sheet" onClick={e => e.stopPropagation()}>
        <div className="grab" />
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
      </div>
    </div>
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
      <div className="fullPane" onClick={e => e.stopPropagation()}>
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
      </div>
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
   SIDEBAR — wide screens only: search + image gallery
   ============================================================ */
function Sidebar({ entries, allEntries, onOpenEntry }) {
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
  return (
    <aside className="sidebar">
      <div className="search sideSearch">
        <SearchIcon />
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="検索" />
        {q && <button className="clr" onClick={() => setQ("")}>✕</button>}
      </div>
      <div className="sideCard">
        <div className="sideTitle">これまでの画像</div>
        {imgs.length === 0
          ? <div className="sideEmpty">画像つきの記録がここに並びます。</div>
          : <div className="imgGrid">{imgs.map((im, i) => (
              <button key={i} className="imgCell" onClick={() => onOpenEntry(im.id)} style={{ backgroundImage: `url(${im.src})` }} aria-label="記録を開く" />
            ))}</div>}
      </div>
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

/* ---------- ghost mark (default avatar) ---------- */
const GHOST_COLOR = "#3B2A6E";
function GhostMark({ size = 40 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" aria-hidden="true">
      <path
        d="M18 50 V30 C18 18.5 24 12 32 12 C40 12 46 18.5 46 30 V50
           C44.3 53 42.6 53 41 50 C39.4 47 37.6 47 36 50 C34.4 53 32.6 53 31 50
           C29.4 47 27.6 47 26 50 C24.4 53 22.6 53 21 50 C20 48.4 19 48.4 18 50 Z"
        fill="#fff" stroke={GHOST_COLOR} strokeWidth="4.6" strokeLinejoin="round" strokeLinecap="round"
      />
      <circle cx="26.5" cy="33" r="3.4" fill={GHOST_COLOR} />
      <circle cx="37.5" cy="33" r="3.4" fill={GHOST_COLOR} />
    </svg>
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

/* ============================================================ styles ============================================================ */
const S = {
  root: { position: "relative", minHeight: "100vh", background: BG, color: INK,
    fontFamily: "'Noto Sans JP',-apple-system,'Hiragino Sans',sans-serif", letterSpacing: ".01em" },
};

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700;800;900&display=swap');
*{box-sizing:border-box;-webkit-tap-highlight-color:transparent;}
body{margin:0;background:${BG};font-weight:600;}
button{font-family:inherit;cursor:pointer;font-weight:600;}
input,textarea{font-family:inherit;font-weight:600;}

.screen{max-width:600px;margin:0 auto;min-height:100vh;position:relative;display:flex;flex-direction:column;background:#fff;}

/* top bar */
.topbar{position:sticky;top:0;z-index:10;display:flex;align-items:center;justify-content:space-between;
  padding:12px 16px;background:rgba(255,255,255,.86);backdrop-filter:blur(12px);border-bottom:1px solid ${LINE};min-height:58px;}
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

/* avatar */
.avatar{border-radius:50%;overflow:hidden;display:inline-grid;place-items:center;flex-shrink:0;background:#fff;border:1px solid ${LINE};}
.avatar.mono{background:${INK};color:#fff;font-weight:600;border:none;font-family:'Hina Mincho',serif;}

/* search */
.searchWrap{padding:10px 16px 4px;}
.search{display:flex;align-items:center;gap:9px;background:#fff;border:1px solid ${LINE};border-radius:13px;padding:9px 13px;}
.search input{flex:1;border:none;outline:none;background:none;font-size:14px;color:${INK};}
.search .clr{border:none;background:none;color:${FAINT};font-size:13px;}

/* feed */
.feed{flex:1;padding:8px 16px 0;background:#fff;}
.day{margin-top:16px;}
.dayHead{display:flex;align-items:flex-end;justify-content:space-between;
  padding:0 2px 12px;margin-bottom:6px;border-bottom:1px solid ${LINE};}
.dayBig{font-size:16px;line-height:1.1;color:${TXT};letter-spacing:.03em;font-weight:500;}
.daySub{font-size:11px;color:${SUB};margin-top:6px;letter-spacing:.08em;}
.dayCopy{background:none;border:1px solid ${LINE};border-radius:999px;color:${SUB};font-size:11px;padding:6px 12px;}
.dayCopy:active{background:${LINE2};}

.thread{position:relative;}
.xpost{display:flex;gap:12px;padding:12px 16px 4px;border-bottom:1px solid ${LINE};cursor:pointer;
  font-family:-apple-system,BlinkMacSystemFont,'Hiragino Sans','Noto Sans JP','Segoe UI',sans-serif;}
.xpost:active{background:#F7F7F8;}
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
.xActions{display:flex;align-items:center;margin-top:6px;max-width:430px;color:${MUT};}
.xActWrap{position:relative;display:inline-flex;}
.xAct{display:inline-flex;align-items:center;gap:6px;border:none;background:none;color:${MUT};font-size:13px;font-weight:400;
  height:34px;padding:0 2px;min-width:34px;justify-content:flex-start;border-radius:999px;}
.xAct svg{width:18px;height:18px;}
.xAct:active{color:${BL};}
.xAct.like{color:${LK};}
.xAct.rt{color:${RTC};}
.xAct.bm{color:${BL};}
.xCnt{font-size:13px;}
.xSpacer{flex:1;}

/* popover menus */
.menuBackdrop{position:fixed;inset:0;z-index:40;}
.menu{position:absolute;z-index:41;background:#fff;border:1px solid ${LINE};border-radius:16px;
  box-shadow:0 10px 30px rgba(0,0,0,.16),0 2px 8px rgba(0,0,0,.08);padding:6px;min-width:180px;}
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
.emptyMark{display:grid;place-items:center;width:74px;height:74px;margin:0 auto 20px;border:1px solid ${LINE};border-radius:50%;background:#fff;}

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
.track{flex:1;display:flex;min-height:0;touch-action:pan-y;will-change:transform;}
.page{flex:0 0 100%;min-width:0;height:100%;overflow:hidden;}
.pageScroll{height:100%;overflow-y:auto;padding:0 16px;-webkit-overflow-scrolling:touch;}
.pageCopyRow{display:flex;justify-content:flex-end;padding:4px 0 2px;}
.dots{display:flex;gap:7px;justify-content:center;align-items:center;padding:12px 0 16px;flex-wrap:wrap;}
.dot{width:6px;height:6px;border-radius:50%;background:${LINE};}
.dot.on{background:${INK};transform:scale(1.25);}
.dotCount{font-size:11px;color:${SUB};font-weight:700;}

/* fab */
.fab{position:fixed;right:max(20px,calc(50vw - 300px + 20px));bottom:26px;width:58px;height:58px;border-radius:50%;
  background:${INK};color:#fff;border:none;display:grid;place-items:center;z-index:20;
  box-shadow:0 8px 24px rgba(0,0,0,.18);}
.fab:active{transform:scale(.94);}

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
  display:flex;align-items:flex-end;justify-content:center;animation:fade .2s ease;}
@keyframes fade{from{opacity:0;}}
.sheet{width:100%;max-width:600px;background:${PAPER};border-radius:26px 26px 0 0;padding-top:12px;
  animation:up .26s cubic-bezier(.2,.9,.3,1);max-height:90vh;overflow-y:auto;}
@keyframes up{from{transform:translateY(100%);}}
.grab{width:40px;height:4px;border-radius:2px;background:${FAINT};margin:0 auto 16px;}
.sheetTitle{font-size:18px;font-weight:800;text-align:center;margin-bottom:18px;letter-spacing:.06em;}
.sheetBody{padding:0 22px 34px;}
.iconPick{display:flex;flex-direction:column;align-items:center;gap:8px;margin-bottom:22px;}
.iconPreview{position:relative;background:none;border:none;padding:0;border-radius:50%;}
.iconEdit{position:absolute;bottom:-4px;left:50%;transform:translateX(-50%);background:${INK};color:#fff;
  font-size:10px;padding:3px 9px;border-radius:999px;letter-spacing:.04em;}
.fieldLabel{display:block;font-size:11px;letter-spacing:.2em;color:${SUB};margin-bottom:8px;text-transform:uppercase;}
.field{width:100%;border:1px solid ${LINE};border-radius:14px;padding:13px 15px;font-size:15px;outline:none;color:${INK};margin-bottom:20px;}
.field:focus{border-color:${INK};}
.handleRow{display:flex;align-items:center;gap:8px;margin-bottom:20px;}
.handleRow .at{color:${SUB};font-size:16px;}
.field.flat{margin-bottom:0;}
.primary{width:100%;background:${INK};color:#fff;border:none;border-radius:16px;padding:16px;font-size:15px;font-weight:500;letter-spacing:.04em;}
.primary:disabled{opacity:.35;}
.deleteLink{display:block;width:100%;background:none;border:none;color:${RED};font-size:13px;padding:18px 0 4px;}

@media (prefers-reduced-motion: reduce){*{animation:none!important;}}

/* ===== wide / tablet-landscape layout ===== */
.root{position:relative;}
.mainCol{width:100%;}
.sidebar{display:none;}
@media (min-width:1000px){
  .root{display:flex;justify-content:flex-start;align-items:flex-start;padding-left:clamp(16px,4vw,72px);gap:0;}
  .mainCol{flex:0 0 600px;width:600px;border-left:1px solid ${LINE};border-right:1px solid ${LINE};min-height:100vh;position:relative;}
  .screen{position:relative;}
  .fab{position:absolute;right:22px;bottom:26px;}
  .sidebar{display:block;flex:0 0 360px;width:360px;align-self:stretch;position:sticky;top:0;height:100vh;overflow-y:auto;padding:12px 18px 40px;}
  .overlayInner,.sheet,.confirmBox{margin:0 auto;}
}
.sideSearch{margin:6px 0 16px;}
.sideCard{background:#fff;border:1px solid ${LINE};border-radius:18px;padding:14px 14px 16px;}
.sideTitle{font-size:13px;font-weight:800;color:${TXT};margin-bottom:12px;}
.sideEmpty{font-size:12.5px;color:${FAINT};line-height:1.8;padding:18px 6px;text-align:center;}
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

/* topbar avatar button */
.avatarBtn{border:none;background:none;padding:0;border-radius:50%;display:grid;place-items:center;}
.avatarBtn:active{opacity:.7;}
.topbar .acctBtn{flex:1;justify-content:center;}

/* timeline profile header (full, X-style) */
.tlProfile{border-bottom:1px solid ${LINE};}
.tlCover{height:96px;background:${BRD2} center/cover no-repeat;}
.tlProfBody{padding:0 16px 12px;}
.tlProfRow1{display:flex;justify-content:space-between;align-items:flex-end;margin-top:-34px;margin-bottom:8px;}
.tlAvatarWrap{border:none;background:#fff;padding:0;border-radius:50%;border:4px solid #fff;line-height:0;}
.tlAvatarWrap .avatar{width:66px;height:66px;}
.tlEditBtn{border:1px solid ${BRD2};background:#fff;color:${TXT};border-radius:999px;padding:7px 15px;font-size:13.5px;font-weight:700;white-space:nowrap;margin-bottom:4px;}
.tlEditBtn:active{background:${LINE2};}
.tlProfName{font-size:18px;font-weight:800;color:${TXT};display:flex;align-items:center;gap:5px;}
.tlProfHandle{font-size:14px;color:${MUT};margin-top:1px;}
.tlProfBio{font-size:14px;line-height:1.55;color:${TXT};font-weight:400;margin-top:10px;white-space:pre-wrap;}
.tlProfJoined{display:flex;align-items:center;gap:6px;font-size:13px;color:${MUT};margin-top:10px;}

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
.postBtn{background:${INK};color:#fff;border:none;border-radius:999px;padding:8px 18px;font-size:14px;font-weight:800;}
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
  display:grid;place-items:center;margin-bottom:16px;color:${MUT};}
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
.dateBtn{position:relative;flex-shrink:0;width:44px;height:42px;border:1px solid ${LINE};border-radius:13px;background:#fff;color:${INK};display:grid;place-items:center;cursor:pointer;}
.dateBtn:active{background:${LINE2};}
.dateBtn svg{color:${INK};}
.dateInput{position:absolute;inset:0;width:100%;height:100%;opacity:0;border:none;padding:0;margin:0;cursor:pointer;}
.dateInput::-webkit-calendar-picker-indicator{position:absolute;inset:0;width:100%;height:100%;margin:0;opacity:0;cursor:pointer;}
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
