// Composer & phase indicator — Apple-inspired, liquid glass
const toLocal = (v) => (v == null ? v : String(v).replace(/groq/gi, "local"));

export function PhaseIndicator({ phase }){
  if(!phase) return null;
  const labels={
    searching:"Searching your docs…",
    reading:"Reading sources…",
    building:"Building tool…",
    running:"Running tool…",
    writing:"Writing answer…"
  };
  return (
    <span className="phase-pill">
      <span className="phase-dot"/><span className="phase-dot" style={{animationDelay:"0.2s"}}/><span className="phase-dot" style={{animationDelay:"0.4s"}}/>
      {labels[phase]||phase}
    </span>
  );
}

export function SearchBox({ onAsk, loading, placeholder="Message BigBrain…", initial }){
  function submit(e){
    e.preventDefault();
    const fd=new FormData(e.target);
    const q=String(fd.get("q")||"").trim();
    if(q) onAsk(q);
    e.target.reset();
  }
  return (
    <form onSubmit={submit} className="search-box">
      <input name="q" placeholder={placeholder} disabled={loading} autoComplete="off" defaultValue={initial||""}/>
      <button className="send" disabled={loading} aria-label="Send">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M5 12h14M12 5l7 7-7 7"/>
        </svg>
      </button>
    </form>
  );
}

export function SourceCard({ e, idx, active, onClick }){
  const isTool = !!e.tool;
  return (
    <div className="source-card" style={active?{borderColor:"var(--accent)"}:null} onClick={onClick}>
      <div style={{display:"flex", justifyContent:"space-between", fontSize:11, color:"var(--text-muted)"}}>
        <span>{isTool?`[tool:${e.doc_id}]`:`[${idx+1}] DOC:${e.doc_id}`} · {toLocal(e.title)} {isTool && <span className="badge" style={{fontSize:10}}>{e.newly_created?"newly created":"reused"}</span>}</span>
        {e.distance!=null && !isTool && <span>{Number(e.distance).toFixed(3)}</span>}
      </div>
      <div style={{fontWeight:500, fontSize:13, marginTop:4, display:"-webkit-box", WebkitLineClamp:2, WebkitBoxOrient:"vertical", overflow:"hidden", color:"var(--text-primary)"}}>{toLocal(e.title)}</div>
      <div style={{fontSize:13, color:"var(--text-secondary)", marginTop:6, display:"-webkit-box", WebkitLineClamp:3, WebkitBoxOrient:"vertical", overflow:"hidden"}}>{toLocal(e.content)}</div>
    </div>
  );
}

export function SourcesPanel({ evidence }){
  if(!evidence?.length) return <div className="card small muted">No sources — the answer was not found in your docs. Add a relevant doc and ask again.</div>;
  return (
    <div>
      <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8}}>
        <strong style={{fontSize:13}}>Sources</strong><span className="badge">{evidence.length} sources</span>
      </div>
      <div style={{display:"grid", gap:8}}>
        {evidence.map((e,i)=>(<SourceCard key={i} e={e} idx={i}/>))}
      </div>
    </div>
  );
}
