// Phase pill: Searching → Reading → Building tool → Running tool → Writing, with dot pulse.
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
      <span className="phase-dot"/><span className="phase-dot"/><span className="phase-dot"/>
      {labels[phase]||phase}
    </span>
  );
}

// Perplexity search box: icon + input + send. Rounded, focus ring.
export function SearchBox({ onAsk, loading, placeholder="Ask anything…" }){
  function submit(e){
    e.preventDefault();
    const fd=new FormData(e.target);
    const q=String(fd.get("q")||"").trim();
    if(q) onAsk(q);
    e.target.reset();
  }
  return (
    <form onSubmit={submit} className="search-box">
      <span style={{color:"var(--muted-2)"}}>⌕</span>
      <input name="q" placeholder={placeholder} disabled={loading} autoComplete="off"/>
      <button className="send" disabled={loading} aria-label="Send">→</button>
    </form>
  );
}

// Source card + panel (right side on desktop). Hover + click → highlight.
export function SourceCard({ e, idx, active, onClick }){
  return (
    <div className={`source-card ${active?"":""}`} style={active?{borderColor:"var(--accent)", background:"var(--accent-soft)"}:null} onClick={onClick}>
      <div style={{display:"flex", justifyContent:"space-between", fontSize:11, color:"var(--muted-2)"}}>
        <span>[{idx+1}] DOC:{e.doc_id} · {e.title}</span>
        {e.distance!=null && <span>{Number(e.distance).toFixed(3)}</span>}
      </div>
      <div style={{fontWeight:700, fontSize:13, marginTop:4, display:"-webkit-box", WebkitLineClamp:2, WebkitBoxOrient:"vertical", overflow:"hidden"}}>{e.title}</div>
      <div style={{fontSize:13, color:"var(--muted)", marginTop:6, display:"-webkit-box", WebkitLineClamp:3, WebkitBoxOrient:"vertical", overflow:"hidden"}}>{e.content}</div>
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
