// Chat view — flat conversation layout, no bubbles, Apple-inspired
import { useState, useEffect } from "react";
import { SearchBox, PhaseIndicator } from "../components/SearchPerplexity.jsx";
import { BoardPreview } from "./Boards.jsx";
import HairlineButton from "../components/HairlineButton.jsx";
import * as api from "../services/api.js";
import BrainMark from "../components/BrainMark.jsx";

const toLocal = (v) => (v == null ? v : String(v).replace(/groq/gi, "local"));
const fmtModel = (k) => toLocal(k);

function DnaBody({ dna, err }){
  const evCount = Array.isArray(dna?.evidence) ? dna.evidence.length : 0;
  const toolName = dna?.tool_used?.name || null;
  const rt = dna?.redteam || null;
  return (
    <div style={{marginTop:6}}>
      {!dna && !err && <div className="reason-line">Opens the persisted Decision DNA record.</div>}
      {err && <div className="reason-line">Could not load record: {err}</div>}
      {dna && (<>
        <div className="reason-line"><span className="mono">{dna.id}</span><span>&nbsp;· {dna.task_type || "answer"} · {fmtModel(dna.model_key) || "model"}</span></div>
        <div className="reason-line">Evidence: {evCount} chunk{evCount === 1 ? "" : "s"}{toolName ? ` · tool ${toolName}` : ""}</div>
        <div className="reason-line">Red Team: {rt ? `${rt.verdict}${(rt.findings||[]).length ? ` (${rt.findings.length} findings)` : ""}` : "not recorded"}</div>
        <div className="reason-line small muted">Asked: {(dna.question || "").slice(0, 140)}</div>
      </>)}
    </div>
  );
}

function normCites(text){
  if(!text) return text;
  const FW_OPEN = String.fromCharCode(0x3010);
  const FW_CLOSE = String.fromCharCode(0x3011);
  return text.split(FW_OPEN).join("[").split(FW_CLOSE).join("]");
}

function renderWithCites(text, onCite){
  if(!text) return null;
  const parts=normCites(text).split(/(\[doc:\d+\]|\[tool:[^\]]+\]|\[board:[^\]]+\])/g);
  return parts.map((p,i)=>{
    const m=p.match(/\[(doc|tool|board):([^\]]+)\]/);
    if(m && m[1]==="board") return <span key={i} className="cite board" title="Live board reading">{p}</span>;
    if(m) return <a key={i} className="cite" onClick={()=>{ const v=m[2]; const num=Number(v); onCite(isNaN(num)?v:num); }}>{p}</a>;
    return <span key={i}>{p}</span>;
  });
}

function ModelOrb({ model_key }){
  const k=(model_key||"").toLowerCase();
  const cls = k.includes("vlm")||k.includes("vision") ? "model-orb vlm" : (k.includes("llm")||k.includes("sarvam")||k.includes("120b")) ? "model-orb llm" : "model-orb";
  return <span className={cls} title={fmtModel(model_key)||"model"}/>;
}

function TaskListCard({ msg, phase, query }){
  const steps=[];
  const evLen=(msg?.evidence||[]).length;
  if(phase==="searching"||phase==="reading"){
    steps.push({label:"Retrieve evidence", state:"active"});
  } else if(evLen>0){
    steps.push({label:`Retrieve evidence`, state:"done", meta:`${evLen} sources`});
  } else if(msg){
    steps.push({label:"Retrieve evidence", state:"done", meta:"no match"});
  }
  if(phase==="building"){
    steps.push({label:"Build tool in sandbox", state:"active"});
  } else if(phase==="running"){
    steps.push({label:"Run tool", state:"active"});
  } else if(msg?.tool_used && !msg.tool_used.error){
    steps.push({label:`Run tool ${msg.tool_used.name}`, state:"done"});
  } else if(msg?.tool_used && msg.tool_used.error){
    steps.push({label:"Run tool", state:"blocked", meta:"failed"});
  }
  if(phase==="writing"){
    steps.push({label:"Draft answer", state:"active"});
  } else if(msg){
    steps.push({label:"Draft answer", state:"done"});
  }
  if(msg?.redteam?.verdict === "pass"){
    steps.push({label:"Red Team review", state:"done", meta:"clean"});
  } else if(msg?.redteam?.verdict === "fail"){
    steps.push({label:"Red Team review", state:"blocked", meta:"fail"});
  } else if(msg?.redteam?.verdict){
    steps.push({label:"Red Team review", state:"done", meta:msg.redteam.verdict});
  } else {
    steps.push({label:"Red Team review", state:"pending"});
  }
  steps.push({label:"Human approval", state:"pending"});
  const done=steps.filter(s=>s.state==="done").length;
  const [collapsed,setCollapsed]=useState(false);
  if(!steps.length) return null;
  return (
    <div className="task-card">
      <div className="task-card-head" onClick={()=>setCollapsed(c=>!c)} style={{cursor:"pointer", userSelect:"none"}}>
        <span>{query?String(query).slice(0,60):"Working"} </span>
        <span style={{display:"flex", alignItems:"center", gap:8}}>
          <span className="muted small">{done}/{steps.length}</span>
          <span style={{fontSize:10, transform: collapsed ? "rotate(-90deg)" : "rotate(90deg)", transition:"transform var(--duration-fast)", display:"inline-block"}}>▶</span>
        </span>
      </div>
      {!collapsed && steps.map((s,i)=>(
        <div key={i}>
          <div className={`task-row ${s.state==="pending"?"pending":""}`}>
            <span className={`t-check ${s.state==="done"?"done":""} ${s.state==="blocked"?"blocked":""}`}>{s.state==="done"?"✓":s.state==="blocked"?"⊗":"○"}</span>
            <span>{s.label}</span>
            <span className="t-meta">{s.state==="active"?"in progress":s.meta||(s.state==="blocked"?"blocked":"")}</span>
          </div>
          {s.state==="active" && <div className="vortex-underline"/>}
        </div>
      ))}
    </div>
  );
}

function ReasoningBody({ msg }){
  const lines=[];
  if(msg?.judge?.reason) lines.push(msg.judge.reason);
  for(const t of (msg?.tool_trace||[])){
    lines.push({text:t, tool:/tool|registry|saved|hit|search|retriev/i.test(t)});
  }
  if(!lines.length) lines.push("No recorded steps for this turn.");
  return (
    <div style={{marginTop:6}}>
      {lines.map((l,i)=> typeof l==="string"
        ? <div key={i} className="reason-line"><span className="reason-dot"/>{toLocal(l)}</div>
        : <div key={i} className={`reason-line${l.tool?" toolok":""}${/saved/i.test(l.text)?" highlight-saved":""}`}><span className="reason-dot"/>{l.tool?"✓ ":""}{toLocal(l.text)}</div>)}
    </div>
  );
}

function RedTeamBody({ msg }){
  const rt = msg?.redteam;
  if(!rt) return null;
  const findings = rt.findings || [];
  if(rt.verdict === "pass" && !findings.length){
    return <div className="small muted" style={{marginTop:6}}>Red Team: passed clean — delivered directly.</div>;
  }
  return (
    <div style={{marginTop:6}}>
      <div className="small" style={{fontWeight:600}}>What failed</div>
      {findings.length
        ? findings.map((f,i)=> <div key={i} className="reason-line"><span className="reason-dot" style={{background:"var(--danger)"}}/>{toLocal(f)}</div>)
        : <div className="reason-line">No detail recorded.</div>}
      <div className="small" style={{fontWeight:600, marginTop:8}}>What happened next</div>
      <div className="reason-line">
        {rt.regenerated
          ? "Draft rejected → regenerated once with these findings → delivered flagged. Not retried further by design."
          : "Delivered flagged without regenerate — see trace."}
      </div>
      {rt.rejected_draft && (
        <details style={{marginTop:6}}>
          <summary className="small muted" style={{cursor:"pointer"}}>Rejected draft (first 300 chars)</summary>
          <div className="small mono" style={{marginTop:4, whiteSpace:"pre-wrap"}}>{toLocal(rt.rejected_draft)}</div>
        </details>
      )}
    </div>
  );
}

function HowComputed({ msg }){
  const [dna, setDna] = useState(null);
  const [err, setErr] = useState("");
  const showDna = msg?.role === "assistant" && !!msg?.request_id;
  async function load(e){
    if(e.target.open && showDna && !dna && !err){
      try{ setDna(await api.getDecisionByRequest(msg.request_id)); }
      catch(ex){ setErr(ex.message); }
    }
  }
  const rt = msg?.redteam;
  const hasReason = !!(msg?.judge?.reason || (msg?.tool_trace||[]).length);
  if(!hasReason && !rt && !showDna) return null;
  return (
    <details className="reasoning" open={rt?.verdict === "fail"} onToggle={load}>
      <summary>How this was computed <span className="chev">▶</span></summary>
      {hasReason && (<>
        <div className="small" style={{fontWeight:600, marginTop:6}}>Reasoning</div>
        <ReasoningBody msg={msg}/>
      </>)}
      {rt && (<>
        <div className="small" style={{fontWeight:600, marginTop:8}}>Red Team</div>
        <RedTeamBody msg={msg}/>
      </>)}
      {showDna && (<>
        <div className="small" style={{fontWeight:600, marginTop:8}}>Decision record</div>
        <DnaBody dna={dna} err={err}/>
      </>)}
      <div style={{borderTop:"1px solid var(--border)", marginTop:8}}/>
    </details>
  );
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning.";
  if (h < 17) return "Good afternoon.";
  return "Good evening.";
}

export function ChatView({ messages, onAsk, loading, onInfo, phase, buildPrompt }){
  const lastAssistant=[...messages].reverse().find(m=>m.role==="assistant");
  const ev=lastAssistant?.evidence||[];
  const lastUser=[...messages].reverse().find(m=>m.role==="user");
  const showCard = phase || lastAssistant;
  const [boardRef, setBoardRef] = useState(null);
  const boardMsg=[...messages].reverse().find(m=>m.role==="assistant" && (m.evidence||[]).some(e=>e.board));
  const boardId=boardMsg ? (boardMsg.evidence.find(e=>e.board)||{}).doc_id : null;
  useEffect(()=>{
    if(boardMsg && boardId) setBoardRef(r=>(r && r.mid===boardMsg.id) ? r : {id:boardId, mid:boardMsg.id});
  },[messages]);

  return (
    <div className="center-col">
      <div>
        {/* Empty state */}
        {!messages.length && !phase && (
          <div className="chat-empty">
            <div className="chat-empty-icon"><BrainMark size={28}/></div>
            <div className="chat-empty-title">{getGreeting()}</div>
            <div className="chat-empty-subtitle">How can I help you today?</div>
          </div>
        )}

        {/* Chat log — flat messages */}
        {messages.length > 0 && (
          <div className="chat-log">
            {messages.map(m=>(
              m.role==="user" ? (
                <div key={m.id} className="chat-turn user">
                  <div className="chat-turn-label">You</div>
                  <div className="chat-turn-content">{m.content}</div>
                </div>
              ) : (
                <div key={m.id} className="chat-turn">
                  <div className="chat-turn-label">
                    <ModelOrb model_key={m.model_key}/>
                    <span>BigBrain</span>
                    <span className="chat-badge-subtle mono" style={{marginLeft:4}}>{fmtModel(m.model_key)||"model"}</span>
                  </div>
                  <div className="answer" style={{marginTop:4}}>{renderWithCites(toLocal(m.content), (id)=>{ const idx=ev.findIndex(e=>String(e.doc_id)===String(id)); if(idx>=0) onInfo(m, idx); })}</div>
                  <div className="meta">
                    {(m.redteam && (m.redteam.verdict === "fail" || (m.redteam.verdict === "flag" && (m.redteam.findings||[]).length))) ? (
                      <span className="verified-plain"><span className="dot" style={{background:"var(--danger)"}}/> Red Team {m.redteam.verdict} — answer unverified</span>
                    ) : m.tool_used && m.tool_used.error ? (
                      <span className="verified-plain"><span className="dot" style={{background:"var(--danger)"}}/> Tool failed — answer unverified</span>
                    ) : m.tool_used && m.tool_used.result ? (
                      <span className="verified-plain"><span className="dot"/> Verified · tool:{m.tool_used.name}{m.tool_used.newly_created ? " (new)" : " (reused)"}</span>
                    ) : (
                      <span className="verified-plain"><span className="dot" style={m.general_knowledge?{background:"var(--warning)"}:null}/> {m.general_knowledge ? "General knowledge" : `Grounded · ${m.evidence?.length ?? 0} sources`}</span>
                    )}
                    {m.evidence && <button className="sources-quiet" onClick={()=>onInfo(m)}>ⓘ sources</button>}
                    {(m.evidence||[]).some(e=>e.board) && <button className="sources-quiet" onClick={()=>{ const b=(m.evidence.find(e=>e.board)||{}); if(b.doc_id) setBoardRef({id:b.doc_id, mid:m.id}); }}>▦ board</button>}
                  </div>
                  <HowComputed msg={m}/>
                </div>
              )
            ))}
          </div>
        )}

        {/* Phase indicator */}
        {phase && <div style={{marginTop:12, marginBottom:8}}><PhaseIndicator phase={phase}/></div>}

        {/* Composer area */}
        <div style={{maxWidth:680, margin: messages.length ? "16px auto 0" : "0 auto"}}>
          <div style={{display:"flex", gap:8, alignItems:"center", marginBottom:6}}>
            <span className="badge"><span className="badge-dot"/>auto</span>
            <span className="small muted">model routed per message · sources open via ⓘ on any answer</span>
          </div>
          <SearchBox key={buildPrompt||"ask"} onAsk={onAsk} loading={loading} placeholder="Ask BigBrain anything..." initial={buildPrompt}/>
        </div>

        {/* Board preview drawer */}
        {boardRef && (
          <div className="evidence-panel open">
            <div style={{padding:16, borderBottom:"1px solid var(--border)", display:"flex", justifyContent:"space-between", alignItems:"center"}}>
              <strong>Board preview</strong><button className="btn" onClick={()=>setBoardRef(null)}>×</button>
            </div>
            <div style={{padding:16}} key={boardRef.mid}>
              <BoardPreview id={boardRef.id}/>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function EvidencePanel({ open, onClose, msg, highlightDoc }){
  return (
    <div className={`evidence-panel ${open?"open":""}`}>
      <div style={{padding:16, borderBottom:"1px solid var(--border)", display:"flex", justifyContent:"space-between", alignItems:"center"}}>
        <strong>Evidence</strong><button className="btn" onClick={onClose}>×</button>
      </div>
      {!msg && <div style={{padding:16, color:"var(--text-secondary)"}}>Select ⓘ on a message.</div>}
      {msg && !msg.evidence?.length && <div style={{padding:16, color:"var(--text-secondary)"}}><em>No sources — this answer used general knowledge.</em></div>}
      {msg?.evidence?.map((e,i)=>(
        <div key={i} style={{padding:"12px 16px", borderBottom:"1px solid var(--border)", background: highlightDoc===String(e.doc_id)?"var(--surface)":"transparent"}}>
          <div className="small" style={{color:"var(--text-muted)"}}>{e.board ? `[board:${String(toLocal(e.title)||"").replace(/^board:/,"")||e.doc_id}]` : e.tool ? `[tool:${e.doc_id}]` : `[doc:${e.doc_id}]`} <span className="mono">{toLocal(e.title)}</span> {e.tool ? <span className="badge" style={{fontSize:10}}>{e.newly_created?"newly created":"reused"}</span> : (e.distance!=null && `· ${Number(e.distance).toFixed(3)}`)}</div>
          <div style={{marginTop:6, whiteSpace:"pre-wrap", fontSize:14}}>{toLocal(e.content)}</div>
        </div>
      ))}
    </div>
  );
}
