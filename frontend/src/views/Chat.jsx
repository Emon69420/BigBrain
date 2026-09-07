// Perplexity thread: query header → sources + answer with inline citations → follow-up.
import { SearchBox, SourcesPanel, PhaseIndicator, SourceCard } from "../components/SearchPerplexity.jsx";

function renderWithCites(text, onCite){
  if(!text) return null;
  const parts=text.split(/(\[doc:\d+\]|\[tool:[^\]]+\])/g);
  return parts.map((p,i)=>{
    const m=p.match(/\[(doc|tool):([^\]]+)\]/);
    if(m) return <a key={i} className="cite" onClick={()=>{ const v=m[2]; const num=Number(v); onCite(isNaN(num)?v:num); }}>{p}</a>;
    return <span key={i}>{p}</span>;
  });
}

export function ChatView({ messages, onAsk, loading, onInfo, phase }){
  // last assistant's evidence for right panel
  const lastAssistant=[...messages].reverse().find(m=>m.role==="assistant");
  const ev=lastAssistant?.evidence||[];
  return (
    <div className="two-col">
      <div>
        {phase && <div style={{marginBottom:10}}><PhaseIndicator phase={phase}/></div>}
        <div className="chat-log">
          {messages.map(m=>(
            m.role==="user" ? (
              <div key={m.id} style={{fontSize:18, fontWeight:700, letterSpacing:"-0.01em", marginTop:8}}>{m.content}</div>
            ) : (
              <div key={m.id} className="answer">
                <div style={{whiteSpace:"pre-wrap"}}>{renderWithCites(m.content, (id)=>{ const idx=ev.findIndex(e=>String(e.doc_id)===String(id)); if(idx>=0) onInfo(m, idx); })}</div>
                <div className="meta">
                  {m.model_key && <span className="badge">{m.model_key}</span>}
                  <span className="badge" style={m.general_knowledge ? {background:"var(--warning)", color:"#000", borderColor:"#f59e0b"} : {background:"var(--accent-soft)", borderColor:"var(--accent)"}}>
                    {m.general_knowledge ? "General knowledge" : `Grounded · ${m.evidence?.length ?? 0} sources`}
                  </span>
                  {m.tool_used && <span className="badge" style={{background:"#1e293b", color:"#fff", borderColor:"#334155"}}>Tool {m.tool_used.hit?"hit":"built"}: {m.tool_used.name} {m.tool_used.hit?`(uses ${m.tool_used.uses}, 0 rebuild)`:""}</span>}
                  {m.evidence && <button className="btn" style={{padding:"2px 8px", fontSize:12}} onClick={()=>onInfo(m)}>ⓘ sources</button>}
                </div>
                {m.tool_trace?.length>0 && <div className="small muted" style={{marginTop:6, fontFamily:"var(--mono)", fontSize:11}}>{m.tool_trace.join(" → ")}</div>}
              </div>
            )
          ))}
          {!messages.length && <div className="muted">No messages — ask about your docs. Try: "whats sop" or "What is inspection interval for P-204?"</div>}
        </div>
        <div style={{maxWidth:640, marginTop:18}}>
          <SearchBox onAsk={onAsk} loading={loading} placeholder="Ask a follow-up…"/>
        </div>
      </div>
      <div className="sources-panel">
        {phase ? <div className="card small muted" style={{display:"grid", gap:8}}><PhaseIndicator phase={phase}/><span>{phase==="building"?"Creating tool in sandbox…":phase==="running"?"Executing tool…":"Collecting evidence…"}</span></div> : <SourcesPanel evidence={ev}/>}
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
      {msg && !msg.evidence?.length && <div style={{padding:16, color:"var(--muted)"}}>No sources — this answer used general knowledge (no matching docs).</div>}
      {msg?.evidence?.map((e,i)=>(
        <div key={i} className="card" style={{margin:12, borderColor: highlightDoc===e.doc_id?"var(--accent)":"var(--line)", background: highlightDoc===e.doc_id?"var(--accent-soft)":"var(--panel)"}}>
          <div style={{fontSize:12, color:"var(--muted)"}}>[doc:{e.doc_id}] {e.title} {e.distance!=null && `· dist ${Number(e.distance).toFixed(3)}`}</div>
          <div style={{marginTop:6, whiteSpace:"pre-wrap", fontSize:14}}>{e.content}</div>
        </div>
      ))}
    </div>
  );
}
