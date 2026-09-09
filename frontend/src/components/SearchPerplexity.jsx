const toLocal = (v) => (v == null ? v : String(v).replace(/groq/gi, "local"));

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
export function SearchBox({ onAsk, loading, placeholder="Ask anything…", initial }){
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
      <input name="q" placeholder={placeholder} disabled={loading} autoComplete="off" defaultValue={initial||""}/>
      <button className="send" disabled={loading} aria-label="Send">→</button>
    </form>
  );
}

// Source card + panel (right side on desktop). Hover + click → highlight.
export function SourceCard({ e, idx, active, onClick }){
  const isTool = !!e.tool;
  return (
    <div className={`source-card ${active?"":""}`} style={active?{borderColor:"var(--accent)", background:"var(--accent-soft)"}: isTool?{borderColor: e.newly_created?"#7c3aed":"#1e293b", background: e.newly_created?"#f5f3ff":"#f8fafc"}:null} onClick={onClick}>
      <div style={{display:"flex", justifyContent:"space-between", fontSize:11, color:"var(--muted-2)"}}>
        <span>{isTool?`[tool:${e.doc_id}]`:`[${idx+1}] DOC:${e.doc_id}`} · {toLocal(e.title)} {isTool && <span style={{background: e.newly_created?"#7c3aed":"#1e293b", color:"#fff", padding:"1px 6px", borderRadius:6, fontSize:10}}>{e.newly_created?"newly created":"reused"}</span>}</span>
        {e.distance!=null && !isTool && <span>{Number(e.distance).toFixed(3)}</span>}
      </div>
      <div style={{fontWeight:700, fontSize:13, marginTop:4, display:"-webkit-box", WebkitLineClamp:2, WebkitBoxOrient:"vertical", overflow:"hidden"}}>{toLocal(e.title)}</div>
      <div style={{fontSize:13, color:"var(--muted)", marginTop:6, display:"-webkit-box", WebkitLineClamp:3, WebkitBoxOrient:"vertical", overflow:"hidden"}}>{toLocal(e.content)}</div>
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
