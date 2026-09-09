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

const RAIL_ICONS = {
  chat: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M21 12a8 8 0 0 1-8 8H4l2-3a8 8 0 1 1 15-5z"/></svg>,
  kb: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="6" cy="6" r="2.5"/><circle cx="18" cy="8" r="2.5"/><circle cx="12" cy="18" r="2.5"/><path d="M8 7l7 1M7 8.5L11 16M16.5 10L13.5 16"/></svg>,
  tools: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4L14 13l-3-3 3.7-3.7z"/></svg>,
  ingest: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 3v12m0 0l-4-4m4 4l4-4M4 17v3h16v-3"/></svg>,
  security: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3z"/></svg>,
  audit: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="8"/><path d="M12 7v5l3 2"/></svg>,
  boards: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="3" width="8" height="8" rx="1"/><rect x="13" y="3" width="8" height="8" rx="1"/><rect x="3" y="13" width="8" height="8" rx="1"/><rect x="13" y="13" width="8" height="8" rx="1"/></svg>,
};

function IconRail({ view, setView }){
  const items=[
    ["chat","Chat"],["boards","Boards"],["kb","Knowledge Base"],["tools","Tools"],["ingest","Ingest"],["security","Security"],
  ];
  const soon=[["audit","Audit (soon)"]];
  return (
    <div className="icon-rail" role="navigation" aria-label="Primary">
      <div title="BigBrain" style={{width:32,height:32,display:"grid",placeItems:"center",color:"var(--muted-app)",marginBottom:6}}><BrainMark size={20}/></div>
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
      <div className="sidebar-brand" style={{gap:8, fontWeight:600, letterSpacing:"-0.01em"}}><span style={{display:"grid",placeItems:"center",color:"var(--muted-app)"}}><BrainMark size={18}/></span> BigBrain <span style={{marginLeft:"auto", fontSize:10, color:"var(--muted-app)", border:"1px solid rgba(255,255,255,.08)", background:"transparent", padding:"3px 7px", borderRadius:999, fontWeight:500, letterSpacing:".04em"}}>Sovereign</span></div>
      <div style={{padding:"12px 12px 0"}}>
        <button className="btn" style={{width:"100%", borderRadius:8, fontWeight:600, justifyContent:"center", display:"flex", background:"linear-gradient(135deg,#6366F1,#7C3AED)", borderColor:"rgba(99,102,241,.45)", color:"#fff", boxShadow:"0 2px 10px rgba(99,102,241,.25)"}} onClick={onNew}>+ New chat</button>
        <div style={{fontSize:11, color:"var(--muted-app)", marginTop:8, paddingLeft:2, fontWeight:400, letterSpacing:"0.01em"}}>{threads.length} threads · org-isolated</div>
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
        {!threads.length && <div className="small muted" style={{padding:"10px", textAlign:"center", border:"1px dashed #1E2128", borderRadius:12, marginTop:6}}>No chats yet.<br/><span style={{fontSize:11}}>Start a new conversation</span></div>}
      </nav>
      <div className="nav-foot">
        <div style={{display:"flex", gap:10, alignItems:"center"}}>
          <div style={{width:32,height:32,borderRadius:999,background:"linear-gradient(135deg,#6366F1,#8B5CF6)",display:"grid",placeItems:"center",color:"#fff",fontWeight:700,fontSize:11,flex:"none"}}>{(user?.name||user?.email||"UC").split(" ").map(x=>x[0]).join("").slice(0,2).toUpperCase()}</div>
          <div style={{minWidth:0}}>
            <div style={{fontWeight:650, color:"var(--ink-app)", fontSize:12, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis"}}>{user?.name || user?.email || "—"}</div>
            <div style={{fontSize:11, color:"#7C819A", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis"}}>{user?.email || ""}</div>
          </div>
        </div>
        <button style={{marginTop:10, padding:0, fontSize:12, color:"var(--muted-app)", background:"transparent", border:"none", cursor:"pointer", fontWeight:400}} onClick={onLogout}>Sign out →</button>
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
  const [buildPrompt,setBuildPrompt]=useState(null);
  function handleBuild(prompt){ setBuildPrompt(prompt); setView("chat"); }
  async function handleAsk(text){
    setBuildPrompt(null);
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
    <div className="shell" style={{gridTemplateColumns: view==="chat" ? "56px 260px 1fr" : "56px 1fr"}}>
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
          <div style={{display:"flex", gap:14, alignItems:"center"}}>
            {groundedState==="grounded" && <span style={{display:"inline-flex",alignItems:"center",gap:6,fontSize:12,color:"var(--muted-app)",fontWeight:500}}><span style={{width:6,height:6,borderRadius:999,background:"var(--green)",display:"inline-block"}}/>grounded</span>}
            {groundedState==="verified" && <span style={{display:"inline-flex",alignItems:"center",gap:6,fontSize:12,color:"var(--muted-app)",fontWeight:500}}><span style={{width:6,height:6,borderRadius:999,background:"var(--green)",display:"inline-block"}}/>Verified</span>}
            {groundedState==="unverified" && <span style={{display:"inline-flex",alignItems:"center",gap:6,fontSize:12,color:"var(--muted-app)",fontWeight:500}}><span style={{width:6,height:6,borderRadius:999,background:"var(--st-unverified)",display:"inline-block"}}/>unverified</span>}
            {groundedState==="failed" && <span style={{display:"inline-flex",alignItems:"center",gap:6,fontSize:12,color:"var(--muted-app)",fontWeight:500}}><span style={{width:6,height:6,borderRadius:999,background:"var(--risk-critical)",display:"inline-block"}}/>failed</span>}
            {groundedState===null && <span style={{display:"inline-flex",alignItems:"center",gap:6,fontSize:12,color:"var(--muted-app)",fontWeight:500}}><span style={{width:6,height:6,borderRadius:999,background:"var(--muted-app)",display:"inline-block"}}/>idle</span>}
            <button style={{background:"transparent",border:"none",color:"var(--muted-app)",fontSize:12,fontWeight:500,cursor:"pointer",padding:"4px 6px"}} onClick={onLogout} title="Sign out">Sign out →</button>
          </div>
        </div>
        <div className="content">
          {view==="chat" && (
            <>
              {!cid && <div className="card" style={{marginBottom:14, display:"flex", alignItems:"center", justifyContent:"space-between", gap:12, borderStyle:"dashed"}}><span style={{fontSize:13, color:"#6B7280"}}>Pick a chat from the panel, or start a new conversation.</span><button className="btn" style={{padding:"6px 14px", borderRadius:8, background:"#08090C", color:"#fff", borderColor:"#08090C"}} onClick={handleNew}>+ New chat</button></div>}
              <ChatView messages={messages} onAsk={handleAsk} loading={askLoading} onInfo={handleInfo} phase={phase} buildPrompt={buildPrompt}/>
              <EvidencePanel open={!!evMsg} onClose={()=>{setEvMsg(null); setHighlight(null);}} msg={evMsg} highlightDoc={highlight}/>
            </>
          )}
          {view==="kb" && <KBView/>}
          {view==="boards" && <BoardsView onBuild={handleBuild}/>}
          {view==="tools" && <ToolsView/>}
          {view==="security" && <SecurityView/>}
          {view==="ingest" && (
            <div style={{width:"100%"}}>
              <h2 style={{fontSize:26, fontWeight:700, letterSpacing:"-0.02em", fontFamily:"var(--sans)", margin:"0 0 6px", color:"var(--ink-app)"}}>Ingest</h2>
              <p style={{color:"var(--muted-app)", fontSize:13}}>Files land in <strong style={{color:"var(--ink-app)"}}>{orgId}</strong> only. Org-divided, never cross-leaks.</p>
              <div className="card" style={{marginTop:16}}>
                <div className="eyebrow" style={{marginBottom:10}}>File upload</div>
                <FileUpload onFile={uploadFile} uploading={uploading}/>
                <div style={{height:16, borderTop:"1px solid rgba(255,255,255,.07)", marginTop:16, paddingTop:16}}/>
                <div className="eyebrow" style={{marginBottom:10}}>Or paste text</div>
                <TextIngest onIngest={uploadText} uploading={uploading}/>
                {last && <p style={{color:"#22C55E", marginTop:12, fontSize:13, fontWeight:600, background:"rgba(34,197,94,.1)", border:"1px solid rgba(34,197,94,.2)", padding:"8px 10px", borderRadius:10}}>✓ Ingested #{last.id} into {last.org_id}</p>}
                {ingestError && <p style={{color:"var(--danger)", marginTop:12, fontSize:13, background:"rgba(248,113,113,.1)", border:"1px solid rgba(248,113,113,.2)", padding:"8px 10px", borderRadius:10}}>{ingestError}</p>}
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
  function backToLanding(){ localStorage.removeItem("bb_entered"); setEntered(false); }
  if(loading) return <div style={{padding:24, color:"var(--ink-app)", background:"var(--bg-app)", minHeight:"100vh"}}>Loading…</div>;
  if(!entered) return <Landing onEnter={enter}/>;
  if(!user) return <Login onLogin={login} onRegister={register} onBack={backToLanding}/>;
  if(!orgs.length) return <div className="card" style={{maxWidth:520, margin:"32px auto"}}>No orgs. <button className="btn" onClick={logout}>Sign out</button></div>;
  // if single org auto-pick else show selector until user picks via topbar
  return <AppShell user={user} orgs={orgs} onLogout={logout}/>;
}

ReactDOM.createRoot(document.getElementById("root")).render(<Root />);
