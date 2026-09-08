// Landing per design.md §6 — sovereignty pitch, vortex hero, 3-col grid, deployment, proof.
import VortexBackground from "../components/VortexBackground.jsx";
import HairlineButton from "../components/HairlineButton.jsx";
import BrainMark from "../components/BrainMark.jsx";

export function Landing({ onEnter }){
  return (
    <div>
      <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", padding:"18px 28px", borderBottom:"1px solid var(--line)"}}>
        <div style={{display:"flex", alignItems:"center", gap:10}}><span className="brand-mark"><BrainMark size={18}/></span><strong>BigBrain</strong></div>
        <div style={{display:"flex", gap:22, color:"var(--muted)", fontSize:14}}>
          <span>Product</span><span>Security</span><span>Docs</span>
          <a onClick={onEnter} style={{cursor:"pointer", color:"var(--ink)"}}>Login</a>
        </div>
      </div>
      <div style={{position:"relative", textAlign:"center", padding:"90px 24px 70px", overflow:"hidden"}}>
        <VortexBackground opacity={0.3}/>
        <div style={{position:"relative"}}>
          <h1 style={{fontSize:44, lineHeight:1.15, margin:"0 0 12px"}}>A sovereign AI workbench for<br/>confidential industrial work.</h1>
          <p style={{color:"var(--muted)", fontSize:17}}>Local models. Your GPU. Nothing leaves.</p>
          <div style={{marginTop:26}}><HairlineButton onClick={onEnter}>Request a briefing →</HairlineButton></div>
        </div>
      </div>
      <div className="grid grid-3" style={{maxWidth:1000, margin:"0 auto", padding:"0 24px"}}>
        <div><div className="eyebrow">Right model, right job</div><p className="muted" style={{fontSize:14}}>SLM / LLM / VLM routed per task — fast where possible, strong where it matters.</p></div>
        <div><div className="eyebrow">Grounded in your docs</div><p className="muted" style={{fontSize:14}}>Local RAG with cited document IDs. No doc, no claim.</p></div>
        <div><div className="eyebrow">Human stays in control</div><p className="muted" style={{fontSize:14}}>Red Team review plus an approval gate on high-risk output.</p></div>
      </div>
      <div style={{maxWidth:1000, margin:"40px auto 0", padding:"0 24px"}}>
        <h2>Deployment</h2>
        <div className="grid grid-2">
          <div className="card"><strong>Org GPU server</strong><p className="muted small">Air-gapped workstation or rack. Data never traverses the internet.</p></div>
          <div className="card"><strong>Approved IndiaAI cloud</strong><p className="muted small">For orgs cleared to run on national infrastructure.</p></div>
        </div>
      </div>
      <div style={{textAlign:"center", padding:"56px 24px"}}>
        <h2>Prove it to your security team</h2>
        <p className="muted">0 external requests. Live, on your network.</p>
        <div style={{marginTop:18}}><HairlineButton onClick={onEnter}>Request a briefing →</HairlineButton></div>
      </div>
      <div style={{display:"flex", justifyContent:"space-between", padding:"18px 28px", borderTop:"1px solid var(--line)", color:"var(--muted)", fontSize:13}}>
        <span>Product&nbsp;&nbsp;Security</span>
        <span>BigBrain Lab — org-controlled deployment only</span>
      </div>
    </div>
  );
}
