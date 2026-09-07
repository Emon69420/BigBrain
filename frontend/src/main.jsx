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
import { FileUpload, TextIngest } from "./components/FileUpload.jsx";
import { useIngest } from "./hooks/useIngest.js";

function Sidebar({ view, setView, user, onLogout, orgId }){
  const items=[
    ["chat","Chat"],["kb","Knowledge Base"],["tools","Tools"],["ingest","Ingest"],
  ];
  return (
    <aside className="sidebar">
      <div className="sidebar-brand"><span className="brand-mark">BB</span> BigBrain <span className="badge" style={{marginLeft:"auto"}}>{orgId}</span></div>
      <nav className="sidebar-nav">
        {items.map(([k,label])=> <div key={k} className={`nav-item ${view===k?"active":""}`} onClick={()=>setView(k)}>{label}</div>)}
      </nav>
      <div className="nav-foot">
        <div style={{fontWeight:700, color:"var(--ink)"}}>{user?.name || user?.email || "—"}</div>
        <div style={{fontSize:12}}>{user?.email || ""}</div>
        <button className="btn btn-ghost" style={{marginTop:8, width:"100%"}} onClick={onLogout}>Sign out</button>
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
      setPhase("writing");
      await api.postMessage(id,{role:"assistant", content:ans.answer, model_key:ans.model, evidence:ans.evidence, request_id:ans.request_id});
      await loadMessages(id);
    } finally{ setAskLoading(false); setTimeout(()=>setPhase(null), 800); }
    loadThreads();
  }
  function handleInfo(msg, idx){
    setEvMsg(msg);
    setHighlight(msg?.evidence?.[idx]?.doc_id ?? null);
  }

  return (
    <div className="shell">
      <Sidebar view={view} setView={setView} user={user} onLogout={onLogout} orgId={orgId}/>
      <div>
        <div className="topbar">
          <div style={{display:"flex", gap:8, alignItems:"center"}}>
            <span className="eyebrow">Workspace</span>
            <select className="input" style={{width:"auto", padding:"6px 10px"}} value={orgId} onChange={e=>pickOrg(e.target.value)}>
              {orgs.map(o=> <option key={o.id} value={o.id}>{o.name} ({o.id})</option>)}
            </select>
          </div>
          <span className="badge"><span className="badge-dot"/> grounded RAG</span>
        </div>
        <div className="content">
          {view==="chat" && (
            <>
              <div style={{display:"flex", gap:8, marginBottom:12}}>
                <button className="btn" onClick={async()=>{ const r=await api.createConversation("New chat"); setCid(r.id); setMessages([]); loadThreads(); }}>+ New chat</button>
                <select className="input" style={{width:"auto"}} value={cid||""} onChange={e=>{ setCid(Number(e.target.value)); }}>
                  <option value="">Select thread…</option>
                  {threads.map(t=> <option key={t.id} value={t.id}>{t.title} #{t.id}</option>)}
                </select>
              </div>
              <ChatView messages={messages} onAsk={handleAsk} loading={askLoading} onInfo={handleInfo} phase={phase}/>
              <EvidencePanel open={!!evMsg} onClose={()=>{setEvMsg(null); setHighlight(null);}} msg={evMsg} highlightDoc={highlight}/>
            </>
          )}
          {view==="kb" && <KBView/>}
          {view==="tools" && <ToolsView/>}
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
