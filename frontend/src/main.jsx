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
import { FileUpload, TextIngest } from "./components/FileUpload.jsx";
import { useIngest } from "./hooks/useIngest.js";
import BrainMark from "./components/BrainMark.jsx";

const RAIL_ICONS = {
  chat: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M21 12a8 8 0 0 1-8 8H4l2-3a8 8 0 1 1 15-5z"/></svg>,
  kb: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="6" cy="6" r="2.5"/><circle cx="18" cy="8" r="2.5"/><circle cx="12" cy="18" r="2.5"/><path d="M8 7l7 1M7 8.5L11 16M16.5 10L13.5 16"/></svg>,
  tools: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4L14 13l-3-3 3.7-3.7z"/></svg>,
  ingest: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 3v12m0 0l-4-4m4 4l4-4M4 17v3h16v-3"/></svg>,
  security: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3z"/></svg>,
  audit: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="8"/><path d="M12 7v5l3 2"/></svg>,
};

function IconRail({ view, setView }){
  const items=[
    ["chat","Chat"],["kb","Knowledge Base"],["tools","Tools"],["ingest","Ingest"],["security","Security"],
  ];
  const soon=[["audit","Audit (soon)"]];
  return (
    <div className="icon-rail" role="navigation" aria-label="Primary">
      <div className="rail-mark" title="BigBrain"><BrainMark size={22}/></div>
      {items.map(([k,label])=> (
        <div key={k} className={`rail-icon ${view===k?"active":""}`} title={label} aria-label={label} role="button" tabIndex={0}
          onClick={()=>setView(k)} onKeyDown={e=>{ if(e.key==="Enter") setView(k); }}>{RAIL_ICONS[k]}</div>
      ))}
      {soon.map(([k,label])=> (
        <div key={k} className="rail-icon soon" title={label} aria-disabled="true">{RAIL_ICONS[k]}</div>
      ))}
    </div>
  );
}

function ChatsPanel({ threads, cid, onSelect, onNew, onRename, user, onLogout }){
  const [editing,setEditing]=useState(null);
  const [draft,setDraft]=useState("");
  function startRename(t){ setEditing(t.id); setDraft(t.title); }
  async function commitRename(id){
    const title=draft.trim();
    setEditing(null);
    if(title) await onRename(id,title);
  }
  return (
    <aside className="sidebar">
      <div className="sidebar-brand"><span className="brand-mark"><BrainMark size={18}/></span> BigBrain</div>
      <div style={{padding:"10px 12px 0"}}>
        <button className="btn" style={{width:"100%"}} onClick={onNew}>+ New chat</button>
      </div>
      <nav className="sidebar-nav threads-nav">
        {threads.map(t=>(
          <div key={t.id} className={`nav-item thread-item ${cid===t.id?"active":""}`}>
            {editing===t.id ? (
              <input className="input" style={{padding:"4px 8px", fontSize:13}} value={draft} autoFocus
                onChange={e=>setDraft(e.target.value)}
                onBlur={()=>commitRename(t.id)}
                onKeyDown={e=>{ if(e.key==="Enter") commitRename(t.id); if(e.key==="Escape") setEditing(null); }}
                onClick={e=>e.stopPropagation()}/>
            ) : (
              <>
                <span className="thread-title" onClick={()=>onSelect(t.id)} title={t.title}>{t.title}</span>
                <span className="thread-rename" title="Rename" onClick={()=>startRename(t)}>✎</span>
              </>
            )}
          </div>
        ))}
        {!threads.length && <div className="small muted" style={{padding:"4px 10px"}}>No chats yet.</div>}
      </nav>
      <div className="nav-foot">
        <div style={{fontWeight:700, color:"var(--ink)"}}>{user?.name || user?.email || "—"}</div>
        <div style={{fontSize:12}}>{user?.email || ""}</div>
        <button className="btn btn-ghost" style={{marginTop:8, paddingLeft:0}} onClick={onLogout}>Sign out</button>
      </div>
    </aside>
  );
}

function AppShell({ user, orgs, onLogout }){
  const [orgId,setOrgId]=useState(api.getOrg());
  const [view,setView]=useState("chat");
  const [cid,setCid]=useState(null);
  const [threads,setThreads]=useState([]);
  const [messages,setMessages]=useState([]);
  const [evMsg,setEvMsg]=useState(null);
  const { uploadFile, uploadText, uploading, last, error: ingestError } = useIngest();
  const [askLoading,setAskLoading]=useState(false);

  function pickOrg(id){ api.setOrg(id); setOrgId(id); setCid(null); setMessages([]); }

  async function loadThreads(){
    try{ const r=await api.listConversations(); setThreads(r.conversations||[]); }catch{}
  }
  async function loadMessages(id){
    if(!id) return; const r=await api.getMessages(id); setMessages(r.messages||[]);
  }
  useEffect(()=>{ loadThreads(); },[orgId]);
  useEffect(()=>{ loadMessages(cid); },[cid]);

  async function ensureThread(){
    if(cid) return cid;
    const r=await api.createConversation("New chat"); setCid(r.id); loadThreads(); return r.id;
  }
  const [phase,setPhase]=useState(null);
  const [highlight,setHighlight]=useState(null);
  async function handleAsk(text){
    const id=await ensureThread();
    await api.postMessage(id,{role:"user", content:text});
    setPhase("searching");
    setAskLoading(true);
    try{
      setPhase("reading");
      const ans=await api.askQuestion(text);
      // show tool building/running if judge decided to use/build a tool (before writing)
      if(ans.tool_used){
        if(!ans.tool_used.hit) setPhase("building");
        else setPhase("running");
        // let the pill show for a beat before writing
        await new Promise(r=>setTimeout(r, ans.tool_used.hit ? 300 : 900));
      }
      setPhase("writing");
      await api.postMessage(id,{role:"assistant", content:ans.answer, model_key:ans.model, evidence:ans.evidence, request_id:ans.request_id, tool_used:ans.tool_used, tool_trace:ans.tool_trace, general_knowledge:ans.general_knowledge, judge:ans.judge, redteam:ans.redteam});
      await loadMessages(id);
    } finally{ setAskLoading(false); setTimeout(()=>setPhase(null), 800); }
    loadThreads();
  }
  function handleInfo(msg, idx){
    setEvMsg(msg);
    setHighlight(msg?.evidence?.[idx]?.doc_id ?? null);
  }

  const lastAssistant=[...messages].reverse().find(m=>m.role==="assistant");
  const groundedState = !lastAssistant ? null
    : (lastAssistant.tool_used && lastAssistant.tool_used.error) ? "failed"
    : (lastAssistant.tool_used && lastAssistant.tool_used.result) ? "verified"
    : (lastAssistant.general_knowledge || (lastAssistant.evidence||[]).length===0) ? "unverified" : "grounded";
  async function handleRename(id,title){
    await api.renameConversation(id,title);
    loadThreads();
  }
  async function handleNew(){
    const r=await api.createConversation("New chat");
    setCid(r.id); setMessages([]); loadThreads();
  }
  return (
    <div className="shell">
      <IconRail view={view} setView={setView}/>
      {view==="chat" && (
        <ChatsPanel threads={threads} cid={cid} onSelect={(id)=>{ setCid(id); }} onNew={handleNew} onRename={handleRename} user={user} onLogout={onLogout}/>
      )}
      <div className="main-col">
        <div className="topbar">
          <div style={{display:"flex", gap:8, alignItems:"center"}}>
            <span className="eyebrow">Workspace</span>
            <select className="org-select" value={orgId} onChange={e=>pickOrg(e.target.value)} aria-label="Workspace">
              {orgs.map(o=> <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          </div>
          {groundedState==="grounded" && <span className="badge"><span className="badge-dot low"/>grounded</span>}
          {groundedState==="verified" && <span className="badge"><span className="badge-dot low"/>verified</span>}
          {groundedState==="unverified" && <span className="badge"><span className="badge-dot" style={{background:"var(--st-unverified)"}}/>unverified</span>}
          {groundedState==="failed" && <span className="badge"><span className="badge-dot critical"/>failed</span>}
          {groundedState===null && <span className="badge"><span className="badge-dot"/>idle</span>}
        </div>
        <div className="content">
          {view==="chat" && (
            <>
              {!cid && <div className="card" style={{marginBottom:12}}>Pick a chat from the panel, or start a <button className="btn" style={{padding:"2px 10px"}} onClick={handleNew}>+ New chat</button></div>}
              <ChatView messages={messages} onAsk={handleAsk} loading={askLoading} onInfo={handleInfo} phase={phase}/>
              <EvidencePanel open={!!evMsg} onClose={()=>{setEvMsg(null); setHighlight(null);}} msg={evMsg} highlightDoc={highlight}/>
            </>
          )}
          {view==="kb" && <KBView/>}
          {view==="tools" && <ToolsView/>}
          {view==="security" && <SecurityView/>}
          {view==="ingest" && (
            <div>
              <h2>Ingest</h2>
              <p style={{color:"var(--muted)"}}>Files land in <strong>{orgId}</strong> only. Org-divided, never cross-leaks.</p>
              <div className="card" style={{marginTop:12}}>
                <FileUpload onFile={uploadFile} uploading={uploading}/>
                <div style={{height:12}}/>
                <TextIngest onIngest={uploadText} uploading={uploading}/>
                {last && <p style={{color:"green"}}>Ingested #{last.id} into {last.org_id}</p>}
                {ingestError && <p style={{color:"var(--danger)"}}>{ingestError}</p>}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Root(){
  const { user, orgs, loading, login, register, logout } = useAuth();
  const [entered,setEntered]=useState(()=> localStorage.getItem("bb_entered")==="1");
  function enter(){ localStorage.setItem("bb_entered","1"); setEntered(true); }
  if(loading) return <div style={{padding:24}}>Loading…</div>;
  if(!entered) return <Landing onEnter={enter}/>;
  if(!user) return <Login onLogin={login} onRegister={register}/>;
  if(!orgs.length) return <div className="card" style={{maxWidth:520, margin:"32px auto"}}>No orgs. <button className="btn" onClick={logout}>Sign out</button></div>;
  // if single org auto-pick else show selector until user picks via topbar
  return <AppShell user={user} orgs={orgs} onLogout={logout}/>;
}

ReactDOM.createRoot(document.getElementById("root")).render(<Root />);
