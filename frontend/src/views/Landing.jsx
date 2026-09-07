// Landing — marketing, decides to enter app. Not AI slop: tight typography, real info.
export function Landing({ onEnter }){
  return (
    <div style={{maxWidth:1100, margin:"0 auto", padding:24}}>
      <div className="hero">
        <div className="eyebrow">Sovereign Industrial AI Workbench</div>
        <h1>Your plant's memory.<br/>Private, grounded, auditable.</h1>
        <p>BigBrain lives on your hardware. It reads SOPs, P&amp;IDs, handwriting, does calculations in a sandbox, cites every answer, and proves no data left your network.</p>
        <div style={{display:"flex", gap:10, marginTop:14}}>
          <button className="btn btn-primary" onClick={onEnter}>Enter workbench →</button>
          <span className="badge"><span className="badge-dot"/> Groq harness + local pgvector</span>
        </div>
      </div>
      <div className="grid grid-3" style={{marginTop:16}}>
        <div className="card"><div className="eyebrow">Grounded RAG</div><div className="kpi">Cited</div><p style={{color:"var(--muted)"}}>Every claim has [doc:ID]. No doc → "Not found in your docs." No hallucinations.</p></div>
        <div className="card"><div className="eyebrow">Org-divided</div><div className="kpi">Isolated</div><p style={{color:"var(--muted)"}}>One server, many orgs. Sister companies share hardware, not data.</p></div>
        <div className="card"><div className="eyebrow">Auditable</div><div className="kpi">Logged</div><p style={{color:"var(--muted)"}}>Every LLM call stored: prompt, response, tokens, latency, org.</p></div>
      </div>
      <div className="card" style={{marginTop:14, display:"flex", justifyContent:"space-between", alignItems:"center"}}>
        <div><strong>Perplexity-grade</strong> <span style={{color:"var(--muted)"}}>— grounded citations · phase pill · sources panel · org-isolated</span></div>
        <span className="badge">v0 · perplexity</span>
      </div>
      <p style={{marginTop:10, fontSize:12, color:"var(--muted-2)"}}>Try: “whats sop” · “What is inspection interval for P-204?” · then click ⓘ to inspect evidence.</p>
    </div>
  );
}
