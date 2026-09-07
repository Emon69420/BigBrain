// Perplexity-style chat: messages + ⓘ evidence side panel, threads in parent.
export function ChatView({ messages, onAsk, loading, onInfo }){
  return (
    <div>
      <div className="chat-log">
        {messages.map(m=>(
          <div key={m.id} className={`bubble ${m.role==="user"?"user":""}`}>
            <div style={{whiteSpace:"pre-wrap"}}>{m.content}</div>
            {m.role==="assistant" && (
              <div className="meta" style={{marginTop:8}}>
                {m.model_key && <span className="badge">{m.model_key}</span>}
                {m.evidence && <button className="btn" style={{padding:"2px 8px", fontSize:12}} onClick={()=>onInfo(m)}>ⓘ {m.evidence.length} sources</button>}
                {m.grounded===false && <span style={{color:"var(--danger)", fontSize:12}}>ungrounded</span>}
              </div>
            )}
          </div>
        ))}
        {!messages.length && <div style={{color:"var(--muted)"}}>No messages — ask about your docs. Try: "What is inspection interval for P-204?"</div>}
      </div>
      <form onSubmit={e=>{e.preventDefault(); const t=new FormData(e.target).get("q"); if(t) onAsk(t); e.target.reset();}} style={{display:"flex", gap:8, marginTop:16}}>
        <input name="q" className="input" placeholder="Ask BigBrain — grounded in your docs..." disabled={loading} style={{flex:1}}/>
        <button className="btn btn-primary" disabled={loading}>{loading?"…":"Ask"}</button>
      </form>
    </div>
  );
}

export function EvidencePanel({ open, onClose, msg }){
  return (
    <div className={`evidence-panel ${open?"open":""}`}>
      <div style={{padding:16, borderBottom:"1px solid var(--line)", display:"flex", justifyContent:"space-between", alignItems:"center"}}>
        <strong>Evidence</strong><button className="btn" onClick={onClose}>×</button>
      </div>
      {!msg && <div style={{padding:16, color:"var(--muted)"}}>Select ⓘ on a message.</div>}
      {msg && !msg.evidence?.length && <div style={{padding:16, color:"var(--muted)"}}>No sources — model said "Not found in your docs."</div>}
      {msg?.evidence?.map((e,i)=>(
        <div key={i} className="card" style={{margin:12}}>
          <div style={{fontSize:12, color:"var(--muted)"}}>[doc:{e.doc_id}] {e.title} {e.distance!=null && `· dist ${Number(e.distance).toFixed(3)}`}</div>
          <div style={{marginTop:6, whiteSpace:"pre-wrap", fontSize:14}}>{e.content}</div>
        </div>
      ))}
    </div>
  );
}
