import React, { useState, useEffect } from "react";
import ReactDOM from "react-dom/client";
import "./styles.css";
import * as api from "./services/api.js";
import { useAuth } from "./hooks/useAuth.js";
import { Landing } from "./views/Landing.jsx";
import { Login } from "./views/Login.jsx";
import { OrgSelect } from "./views/OrgSelect.jsx";
import { ChatView, EvidencePanel } from "./views/Chat.jsx";
import { KBView } from "./views/KB.jsx";
import { ToolsView } from "./views/Tools.jsx";
import { SecurityView } from "./views/Security.jsx";
import { BoardsView } from "./views/Boards.jsx";
import { FileUpload, TextIngest } from "./components/FileUpload.jsx";
import { useIngest } from "./hooks/useIngest.js";
import BrainMark from "./components/BrainMark.jsx";

/* ── Sidebar nav icons (inline SVG, consistent 16px) ── */
const NAV_ICONS = {
  chat: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M21 12a8 8 0 0 1-8 8H4l2-3a8 8 0 1 1 15-5z"/></svg>,
  boards: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="3" width="8" height="8" rx="1"/><rect x="13" y="3" width="8" height="8" rx="1"/><rect x="3" y="13" width="8" height="8" rx="1"/><rect x="13" y="13" width="8" height="8" rx="1"/></svg>,
  kb: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="6" cy="6" r="2.5"/><circle cx="18" cy="8" r="2.5"/><circle cx="12" cy="18" r="2.5"/><path d="M8 7l7 1M7 8.5L11 16M16.5 10L13.5 16"/></svg>,
  tools: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4L14 13l-3-3 3.7-3.7z"/></svg>,
  ingest: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 3v12m0 0l-4-4m4 4l4-4M4 17v3h16v-3"/></svg>,
  security: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3z"/></svg>,
  audit: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="8"/><path d="M12 7v5l3 2"/></svg>,
};

const NAV_ITEMS = [
  ["chat", "Chat"],
  ["boards", "Boards"],
  ["kb", "Knowledge Base"],
  ["tools", "Tools"],
  ["ingest", "Ingest"],
  ["security", "Security"],
];
const SOON_ITEMS = [["audit", "Audit"]];

/* ── Unified Sidebar ── */
function Sidebar({ view, setView, threads, cid, onSelect, onNew, onRename, user, onLogout, mobileOpen, onMobileClose }) {
  const [editing, setEditing] = useState(null);
  const [draft, setDraft] = useState("");
  const [search, setSearch] = useState("");

  function startRename(t) { setEditing(t.id); setDraft(t.title); }
  async function commitRename(id) {
    const title = draft.trim();
    setEditing(null);
    if (title) await onRename(id, title);
  }

  function handleNavClick(key) {
    setView(key);
    if (window.innerWidth <= 900) onMobileClose();
  }
  function handleThreadClick(id) {
    onSelect(id);
    if (window.innerWidth <= 900) onMobileClose();
  }

  const filteredThreads = search
    ? threads.filter(t => t.title.toLowerCase().includes(search.toLowerCase()))
    : threads;

  return (
    <aside className={`sidebar${mobileOpen ? " mobile-open" : ""}`}>
      {/* Brand */}
      <div className="sidebar-brand">
        <span style={{ display: "grid", placeItems: "center", color: "var(--text-secondary)" }}>
          <BrainMark size={18} />
        </span>
        BigBrain
        <span className="sidebar-brand-badge">Sovereign</span>
      </div>

      {/* New chat */}
      <button className="sidebar-new-chat" onClick={() => { onNew(); handleNavClick("chat"); }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14"/></svg>
        New chat
      </button>

      {/* Navigation */}
      <nav className="sidebar-nav">
        {NAV_ITEMS.map(([key, label]) => (
          <div
            key={key}
            className={`sidebar-nav-item${view === key ? " active" : ""}`}
            onClick={() => handleNavClick(key)}
            role="button"
            tabIndex={0}
            onKeyDown={e => { if (e.key === "Enter") handleNavClick(key); }}
          >
            {NAV_ICONS[key]}
            <span>{label}</span>
          </div>
        ))}
        {SOON_ITEMS.map(([key, label]) => (
          <div key={key} className="sidebar-nav-item soon" aria-disabled="true">
            {NAV_ICONS[key]}
            <span>{label}</span>
            <span className="soon-tag">soon</span>
          </div>
        ))}
      </nav>

      {/* Chat threads (visible when in chat view) */}
      {view === "chat" && (
        <>
          <div className="sidebar-divider" />

          {/* Search chats */}
          <div className="sidebar-search">
            <span className="sidebar-search-icon">⌕</span>
            <input
              placeholder="Search chats…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          <div className="sidebar-thread-count">
            {threads.length} thread{threads.length !== 1 ? "s" : ""} · org-isolated
          </div>

          <div className="sidebar-threads">
            {filteredThreads.map(t => (
              <div
                key={t.id}
                className={`thread-item${cid === t.id ? " active" : ""}`}
                role="button"
                tabIndex={0}
                aria-current={cid === t.id ? "page" : undefined}
                onClick={() => handleThreadClick(t.id)}
                onKeyDown={e => {
                  if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleThreadClick(t.id); }
                }}
              >
                {editing === t.id ? (
                  <input
                    className="input"
                    style={{ padding: "4px 8px", fontSize: 13 }}
                    value={draft}
                    autoFocus
                    onChange={e => setDraft(e.target.value)}
                    onBlur={() => commitRename(t.id)}
                    onKeyDown={e => {
                      if (e.key === "Enter") commitRename(t.id);
                      if (e.key === "Escape") setEditing(null);
                    }}
                    onClick={e => e.stopPropagation()}
                  />
                ) : (
                  <>
                    <span className="thread-title" title={t.title}>{t.title}</span>
                    <span className="thread-rename" title="Rename" onClick={e => { e.stopPropagation(); startRename(t); }}>✎</span>
                  </>
                )}
              </div>
            ))}
            {!filteredThreads.length && (
              <div className="small muted" style={{ padding: 12, textAlign: "center" }}>
                {search ? "No matching chats." : "No chats yet."}
              </div>
            )}
          </div>
        </>
      )}

      {/* User footer */}
      <div className="sidebar-footer">
        <div className="sidebar-footer-user">
          <div className="sidebar-footer-avatar">
            {(user?.name || user?.email || "U").split(" ").map(x => x[0]).join("").slice(0, 2).toUpperCase()}
          </div>
          <div className="sidebar-footer-info">
            <div className="sidebar-footer-name">{user?.name || user?.email || "—"}</div>
            <div className="sidebar-footer-email">{user?.email || ""}</div>
          </div>
        </div>
        <button className="sidebar-footer-signout" onClick={onLogout}>Sign out →</button>
      </div>
    </aside>
  );
}

/* ── App Shell ── */
function AppShell({ user, orgs, onLogout }) {
  const [orgId, setOrgId] = useState(api.getOrg());
  const [view, setView] = useState("chat");
  const [cid, setCid] = useState(null);
  const [threads, setThreads] = useState([]);
  const [messages, setMessages] = useState([]);
  const [evMsg, setEvMsg] = useState(null);
  const { uploadFile, uploadText, uploading, last, error: ingestError } = useIngest();
  const [askLoading, setAskLoading] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  function pickOrg(id) { api.setOrg(id); setOrgId(id); setCid(null); setMessages([]); }

  async function loadThreads() {
    try { const r = await api.listConversations(); setThreads(r.conversations || []); } catch {}
  }
  async function loadMessages(id) {
    if (!id) return; const r = await api.getMessages(id); setMessages(r.messages || []);
  }
  useEffect(() => { loadThreads(); }, [orgId]);
  useEffect(() => { loadMessages(cid); }, [cid]);

  async function ensureThread() {
    if (cid) return cid;
    const r = await api.createConversation("New chat"); setCid(r.id); loadThreads(); return r.id;
  }

  const [phase, setPhase] = useState(null);
  const [highlight, setHighlight] = useState(null);
  const [buildPrompt, setBuildPrompt] = useState(null);
  function handleBuild(prompt) { setBuildPrompt(prompt); setView("chat"); }

  async function handleAsk(text) {
    setBuildPrompt(null);
    const id = await ensureThread();
    await api.postMessage(id, { role: "user", content: text });
    setPhase("searching");
    setAskLoading(true);
    try {
      setPhase("reading");
      const ans = await api.askQuestion(text);
      if (ans.tool_used) {
        if (!ans.tool_used.hit) setPhase("building");
        else setPhase("running");
        await new Promise(r => setTimeout(r, ans.tool_used.hit ? 300 : 900));
      }
      setPhase("writing");
      await api.postMessage(id, {
        role: "assistant", content: ans.answer, model_key: ans.model,
        evidence: ans.evidence, request_id: ans.request_id,
        tool_used: ans.tool_used, tool_trace: ans.tool_trace,
        general_knowledge: ans.general_knowledge, judge: ans.judge, redteam: ans.redteam,
      });
      await loadMessages(id);
    } finally { setAskLoading(false); setTimeout(() => setPhase(null), 800); }
    loadThreads();
  }

  function handleInfo(msg, idx) {
    setEvMsg(msg);
    setHighlight(msg?.evidence?.[idx]?.doc_id ?? null);
  }

  const lastAssistant = [...messages].reverse().find(m => m.role === "assistant");
  const groundedState = !lastAssistant ? null
    : (lastAssistant.tool_used && lastAssistant.tool_used.error) ? "failed"
    : (lastAssistant.tool_used && lastAssistant.tool_used.result) ? "verified"
    : (lastAssistant.general_knowledge || (lastAssistant.evidence || []).length === 0) ? "unverified"
    : "grounded";

  async function handleRename(id, title) {
    await api.renameConversation(id, title);
    loadThreads();
  }
  async function handleNew() {
    const r = await api.createConversation("New chat");
    setCid(r.id); setMessages([]); loadThreads();
  }

  const statusColors = {
    grounded: "var(--success)", verified: "var(--success)",
    unverified: "var(--warning)", failed: "var(--danger)", null: "var(--text-muted)",
  };
  const statusLabels = {
    grounded: "grounded", verified: "Verified",
    unverified: "unverified", failed: "failed", null: "idle",
  };

  return (
    <div className="shell">
      {/* Mobile overlay */}
      <div className={`sidebar-overlay${mobileOpen ? " open" : ""}`} onClick={() => setMobileOpen(false)} />

      {/* Unified sidebar */}
      <Sidebar
        view={view} setView={setView}
        threads={threads} cid={cid}
        onSelect={(id) => { setEvMsg(null); setMessages([]); setCid(id); }}
        onNew={handleNew} onRename={handleRename}
        user={user} onLogout={onLogout}
        mobileOpen={mobileOpen} onMobileClose={() => setMobileOpen(false)}
      />

      {/* Main column */}
      <div className="main-col">
        {/* Topbar */}
        <div className="topbar">
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {/* Mobile hamburger */}
            <button className="mobile-menu-btn" onClick={() => setMobileOpen(true)} aria-label="Open menu">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M3 7h18M3 12h18M3 17h18" />
              </svg>
            </button>
            <span className="eyebrow" style={{ fontSize: 11 }}>Workspace</span>
            <select className="org-select" value={orgId} onChange={e => pickOrg(e.target.value)} aria-label="Workspace">
              {orgs.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          </div>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <span className="status-pill">
              <span className="status-dot" style={{ background: statusColors[groundedState] || statusColors.null }} />
              {statusLabels[groundedState] || statusLabels.null}
            </span>
          </div>
        </div>

        {/* Content */}
        <div className="content">
          {view === "chat" && (
            <>
              {!cid && (
                <div className="card" style={{
                  marginBottom: 14, display: "flex", alignItems: "center",
                  justifyContent: "space-between", gap: 12, borderStyle: "dashed"
                }}>
                  <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                    Pick a chat from the sidebar, or start a new conversation.
                  </span>
                  <button className="btn" onClick={handleNew}>+ New chat</button>
                </div>
              )}
              <ChatView messages={messages} onAsk={handleAsk} loading={askLoading} onInfo={handleInfo} phase={phase} buildPrompt={buildPrompt} />
              <EvidencePanel open={!!evMsg} onClose={() => { setEvMsg(null); setHighlight(null); }} msg={evMsg} highlightDoc={highlight} />
            </>
          )}
          {view === "kb" && <KBView />}
          {view === "boards" && <BoardsView onBuild={handleBuild} />}
          {view === "tools" && <ToolsView />}
          {view === "security" && <SecurityView />}
          {view === "ingest" && (
            <div style={{ width: "100%", maxWidth: 640 }}>
              <h2 style={{ fontSize: 24, fontWeight: 600, margin: "0 0 6px" }}>Ingest</h2>
              <p style={{ color: "var(--text-secondary)", fontSize: 13, margin: "0 0 16px" }}>
                Files land in <strong style={{ color: "var(--text-primary)" }}>{orgId}</strong> only. Org-divided, never cross-leaks.
              </p>
              <div className="card" style={{ marginTop: 0 }}>
                <div className="eyebrow" style={{ marginBottom: 10 }}>File upload</div>
                <FileUpload onFile={uploadFile} uploading={uploading} />
                <div style={{ height: 1, background: "var(--border)", margin: "16px 0" }} />
                <div className="eyebrow" style={{ marginBottom: 10 }}>Or paste text</div>
                <TextIngest onIngest={uploadText} uploading={uploading} />
                {last && (
                  <p style={{
                    color: "var(--success)", marginTop: 12, fontSize: 13, fontWeight: 500,
                    background: "var(--success-muted)", border: "1px solid rgba(34,197,94,0.2)",
                    padding: "8px 10px", borderRadius: 10
                  }}>✓ Ingested #{last.id} into {last.org_id}</p>
                )}
                {ingestError && (
                  <p style={{
                    color: "var(--danger)", marginTop: 12, fontSize: 13,
                    background: "var(--danger-muted)", border: "1px solid rgba(239,68,68,0.2)",
                    padding: "8px 10px", borderRadius: 10
                  }}>{ingestError}</p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Root ── */
function Root() {
  const { user, orgs, loading, login, register, logout } = useAuth();
  const [entered, setEntered] = useState(() => localStorage.getItem("bb_entered") === "1");
  function enter() { localStorage.setItem("bb_entered", "1"); setEntered(true); }
  function backToLanding() { localStorage.removeItem("bb_entered"); setEntered(false); }

  if (loading) return (
    <div style={{
      padding: 24, color: "var(--text-primary)", background: "var(--bg-primary)",
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: "var(--font-sans)"
    }}>Loading…</div>
  );
  if (!entered) return <Landing onEnter={enter} />;
  if (!user) return <Login onLogin={login} onRegister={register} onBack={backToLanding} />;
  if (!orgs.length) return (
    <div className="card" style={{ maxWidth: 520, margin: "32px auto" }}>
      No orgs. <button className="btn" onClick={logout}>Sign out</button>
    </div>
  );
  return <AppShell user={user} orgs={orgs} onLogout={logout} />;
}

ReactDOM.createRoot(document.getElementById("root")).render(<Root />);
