// Chat per design.md §7: hairline turns, orb model badge, Task List Card,
// Reasoning disclosure (collapsed), Evidence drawer, hairline input bar.
import { useState } from "react";
import { SearchBox, PhaseIndicator } from "../components/SearchPerplexity.jsx";
import HairlineButton from "../components/HairlineButton.jsx";
import * as api from "../services/api.js";

function DnaBody({ dna, err }){
  const evCount = Array.isArray(dna?.evidence) ? dna.evidence.length : 0;
  const toolName = dna?.tool_used?.name || null;
  const rt = dna?.redteam || null;
  return (
    <div style={{marginTop:6}}>
      {!dna && !err && <div className="reason-line">Opens the persisted Decision DNA record.</div>}
      {err && <div className="reason-line">Could not load record: {err}</div>}
      {dna && (<>
        <div className="reason-line"><span className="mono">{dna.id}</span><span>&nbsp;· {dna.task_type || "answer"} · {dna.model_key || "model"}</span></div>
        <div className="reason-line">Evidence: {evCount} chunk{evCount === 1 ? "" : "s"}{toolName ? ` · tool ${toolName}` : ""}</div>
        <div className="reason-line">Red Team: {rt ? `${rt.verdict}${(rt.findings||[]).length ? ` (${rt.findings.length} findings)` : ""}` : "not recorded"}</div>
        <div className="reason-line small muted">Asked: {(dna.question || "").slice(0, 140)}</div>
      </>)}
    </div>
  );
}

function normCites(text){
  // LLMs emit fullwidth brackets too — normalize so links + backend agree.
  // Built via fromCharCode to keep this file pure ASCII.
  if(!text) return text;
  const FW_OPEN = String.fromCharCode(0x3010);
  const FW_CLOSE = String.fromCharCode(0x3011);
  return text.split(FW_OPEN).join("[").split(FW_CLOSE).join("]");
}

function renderWithCites(text, onCite){
  if(!text) return null;
  const parts=normCites(text).split(/(\[doc:\d+\]|\[tool:[^\]]+\])/g);
  return parts.map((p,i)=>{
    const m=p.match(/\[(doc|tool):([^\]]+)\]/);
    if(m) return <a key={i} className="cite" onClick={()=>{ const v=m[2]; const num=Number(v); onCite(isNaN(num)?v:num); }}>{p}</a>;
    return <span key={i}>{p}</span>;
  });
}

function ModelOrb({ model_key }){
  const k=(model_key||"").toLowerCase();
  const cls = k.includes("vlm")||k.includes("vision") ? "model-orb vlm" : (k.includes("llm")||k.includes("sarvam")||k.includes("120b")) ? "model-orb llm" : "model-orb";
  return <span className={cls} title={model_key||"model"}/>;
}

// Task List Card derived ONLY from real turn data (phase, evidence, tool state).
// Red Team row reflects msg.redteam when present; human approval backend not built yet.
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
  if(!steps.length) return null;
  return (
    <div className="task-card">
      <div className="task-card-head"><span>{query?String(query).slice(0,60):"Working"} </span><span className="muted small">{done}/{steps.length}</span></div>
      {steps.map((s,i)=>(
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
        ? <div key={i} className="reason-line"><span className="reason-dot"/>{l}</div>
        : <div key={i} className={`reason-line${l.tool?" toolok":""}`}><span className="reason-dot"/>{l.tool?"✓ ":""}{l.text}</div>)}
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
      <div className="small" style={{fontWeight:700}}>What failed</div>
      {findings.length
        ? findings.map((f,i)=> <div key={i} className="reason-line"><span className="reason-dot" style={{background:"var(--danger)"}}/>{f}</div>)
        : <div className="reason-line">No detail recorded.</div>}
      <div className="small" style={{fontWeight:700, marginTop:8}}>What happened next</div>
      <div className="reason-line">
        {rt.regenerated
          ? "Draft rejected → regenerated once with these findings → delivered flagged (red badge above). Not retried further by design."
          : "Delivered flagged without regenerate — see trace. Red badge above applies."}
      </div>
      {rt.rejected_draft && (
        <details style={{marginTop:6}}>
          <summary className="small muted" style={{cursor:"pointer"}}>Rejected draft (first 300 chars)</summary>
          <div className="small mono" style={{marginTop:4, whiteSpace:"pre-wrap"}}>{rt.rejected_draft}</div>
        </details>
      )}
    </div>
  );
}

// One expander per answer: Reasoning + Red Team + Decision record live here.
// Sections render only when that turn actually has the data. Fail-open on redteam fail.
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
        <div className="small" style={{fontWeight:700, marginTop:6}}>Reasoning</div>
        <ReasoningBody msg={msg}/>
      </>)}
      {rt && (<>
        <div className="small" style={{fontWeight:700, marginTop:8}}>Red Team</div>
        <RedTeamBody msg={msg}/>
      </>)}
      {showDna && (<>
        <div className="small" style={{fontWeight:700, marginTop:8}}>Decision record</div>
        <DnaBody dna={dna} err={err}/>
      </>)}
      <div style={{borderTop:"1px solid var(--line)", marginTop:8}}/>
    </details>
  );
}

export function ChatView({ messages, onAsk, loading, onInfo, phase }){
  const lastAssistant=[...messages].reverse().find(m=>m.role==="assistant");
  const ev=lastAssistant?.evidence||[];
  const lastUser=[...messages].reverse().find(m=>m.role==="user");
  const showCard = phase || lastAssistant;
  return (
    <div className="center-col">
      <div>
        {phase && <div style={{marginBottom:10}}><PhaseIndicator phase={phase}/></div>}
        {showCard && <TaskListCard msg={phase?null:lastAssistant} phase={phase} query={lastUser?.content}/>}
        <div className="chat-log">
          {messages.map(m=>(
            m.role==="user" ? (
              <div key={m.id} className="chat-turn user">{m.content}</div>
            ) : (
              <div key={m.id} className="chat-turn">
                <div><ModelOrb model_key={m.model_key}/><span className="badge mono" style={{fontSize:11}}>{m.model_key||"model"}</span></div>
                <div className="answer" style={{marginTop:8,whiteSpace:"pre-wrap"}}>{renderWithCites(m.content, (id)=>{ const idx=ev.findIndex(e=>String(e.doc_id)===String(id)); if(idx>=0) onInfo(m, idx); })}</div>
                <div className="meta">
                  {(m.redteam && (m.redteam.verdict === "fail" || (m.redteam.verdict === "flag" && (m.redteam.findings||[]).length))) ? (
                    <span className="badge"><span className="badge-dot critical"/>Red Team {m.redteam.verdict} — answer unverified</span>
                  ) : m.tool_used && m.tool_used.error ? (
                    <span className="badge"><span className="badge-dot critical"/>Tool failed — answer unverified</span>
                  ) : m.tool_used && m.tool_used.result ? (
                    <span className="badge"><span className="badge-dot low"/>Verified · tool:{m.tool_used.name}{m.tool_used.newly_created ? " (new)" : " (reused)"}</span>
                  ) : (
                    <span className="badge"><span className={`badge-dot ${m.general_knowledge?"":"low"}`} style={m.general_knowledge?{background:"var(--st-unverified)"}:null}/>{m.general_knowledge ? "General knowledge" : `Grounded · ${m.evidence?.length ?? 0} sources`}</span>
                  )}
                  {m.evidence && <button className="btn" style={{padding:"2px 8px", fontSize:12}} onClick={()=>onInfo(m)}>ⓘ sources</button>}
                </div>
                <HowComputed msg={m}/>
              </div>
            )
          ))}
          {!messages.length && <div className="muted">No messages — ask about your docs. Try: "whats sop" or "What is inspection interval for P-204?"</div>}
        </div>
        <div style={{maxWidth:640, marginTop:18}}>
          <div style={{display:"flex", gap:8, alignItems:"center", marginBottom:6}}>
            <span className="badge"><span className="badge-dot"/>auto</span>
            <span className="small muted">model routed per message · sources open via ⓘ on any answer</span>
          </div>
          <SearchBox onAsk={onAsk} loading={loading} placeholder="Ask a follow-up…"/>
        </div>
      </div>
    </div>
  );
}

export function EvidencePanel({ open, onClose, msg, highlightDoc }){
  return (
    <div className={`evidence-panel ${open?"open":""}`}>
      <div style={{padding:16, borderBottom:"1px solid var(--line)", display:"flex", justifyContent:"space-between", alignItems:"center"}}>
        <strong>Evidence</strong><button className="btn" onClick={onClose}>×</button>
      </div>
      {!msg && <div style={{padding:16, color:"var(--muted)"}}>Select ⓘ on a message.</div>}
      {msg && !msg.evidence?.length && <div style={{padding:16, color:"var(--muted)"}}><em>No sources — this answer used general knowledge.</em></div>}
      {msg?.evidence?.map((e,i)=>(
        <div key={i} style={{padding:"12px 16px", borderBottom:"1px solid var(--line)", background: highlightDoc===String(e.doc_id)?"var(--panel)":"transparent"}}>
          <div className="small" style={{color:"var(--muted)"}}>{e.tool ? `[tool:${e.doc_id}]` : `[doc:${e.doc_id}]`} <span className="mono">{e.title}</span> {e.tool ? <span className="badge" style={{fontSize:10}}>{e.newly_created?"newly created":"reused"}</span> : (e.distance!=null && `· ${Number(e.distance).toFixed(3)}`)}</div>
          <div style={{marginTop:6, whiteSpace:"pre-wrap", fontSize:14}}>{e.content}</div>
        </div>
      ))}
    </div>
  );
}
