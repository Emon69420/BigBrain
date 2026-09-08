// Landing — Perplexity-inspired, BigBrain messaging preserved, only presentation changed
import VortexBackground from "../components/VortexBackground.jsx";
import HairlineButton from "../components/HairlineButton.jsx";
import BrainMark from "../components/BrainMark.jsx";

export function Landing({ onEnter }){
  return (
    <div className="landing">
      <div className="landing-top">
        <div style={{display:"flex", alignItems:"center", gap:10}}><span className="brand-mark"><BrainMark size={18}/></span><strong style={{letterSpacing:"-.02em"}}>BigBrain</strong></div>
        <nav>
          <span>Product</span><span>Security</span><span>Docs</span>
          <a onClick={onEnter} style={{cursor:"pointer", color:"var(--ink-dark)", fontWeight:600}}>Login</a>
        </nav>
      </div>
      <div className="landing-hero">
        <VortexBackground opacity={0.28}/>
        <div className="hero-ellipses" aria-hidden="true"><div className="ellipse"></div><div className="ellipse"></div><div className="ellipse"></div></div>
        <div className="landing-hero-inner">
          <div className="eyebrow" style={{color:"rgba(255,255,255,.55)", display:"flex", justifyContent:"center"}}>AI for the curious</div>
          <h1>A sovereign AI workbench for<br/>confidential industrial work.</h1>
          <p>Local models. Your GPU. Nothing leaves. Get answers. Build tools. Always grounded.</p>
          <div className="hero-search" onClick={onEnter} role="button" tabIndex={0} onKeyDown={e=>{if(e.key==="Enter") onEnter();}}>
            <span style={{color:"#9AA0B0", marginLeft:8}}>⌕</span>
            <input placeholder="Ask about your docs — try 'inspection interval for P-204'" disabled style={{pointerEvents:"none"}} />
            <button aria-label="Ask" onClick={onEnter}>→</button>
          </div>
          <div style={{marginTop:14, display:"flex", justifyContent:"center"}}>
            <HairlineButton onClick={onEnter}>Request a briefing →</HairlineButton>
          </div>
          <div style={{marginTop:28}}>
            <div style={{fontFamily:"var(--serif)", fontSize:22, fontWeight:600, letterSpacing:"-.02em"}}>The best models, better together.</div>
            <div style={{display:"flex", gap:10, justifyContent:"center", marginTop:12}}>
              <span style={{width:28,height:28,borderRadius:8,border:"1px solid rgba(255,255,255,.12)",display:"grid",placeItems:"center",fontSize:12,background:"rgba(255,255,255,.06)"}}>◈</span>
              <span style={{width:28,height:28,borderRadius:8,border:"1px solid rgba(255,255,255,.12)",display:"grid",placeItems:"center",fontSize:12,background:"rgba(255,255,255,.06)"}}>⬢</span>
            </div>
          </div>
        </div>
      </div>
      <div className="landing-curve" />
      <div className="landing-light">
        <div className="eyebrow">What we do</div>
        <h2>Accurate AI</h2>
        <p className="muted" style={{color:"#6B7280", maxWidth:560, margin:"0 auto 14px", fontSize:13}}>Sovereign, grounded, fewer hallucinations. Backed by citations, always.</p>
        <div style={{display:"inline-flex", gap:6, background:"#fff", border:"1px solid #EDE8E0", borderRadius:999, padding:4}}>
          <span style={{padding:"7px 14px", borderRadius:999, fontSize:12, fontWeight:600, background:"#08090C", color:"#fff"}}>Accurate AI</span>
          <span style={{padding:"7px 14px", fontSize:12, color:"#6B7280"}}>Multi-model orchestration</span>
          <span style={{padding:"7px 14px", fontSize:12, color:"#6B7280"}}>Web-free · air-gapped</span>
        </div>
      </div>
      <div className="landing-card-grid">
        <div className="px-card-dark">
          <div className="eyebrow"><span style={{width:6,height:6,borderRadius:99,background:"#6C6BFF",display:"inline-block"}}/> Answer Engine</div>
          <h3>Get accurate, cited answers that go deeper.</h3>
          <p>Answers with inline <span style={{color:"#fff"}}>[doc:ID]</span> citations. No doc, no claim.</p>
          <span className="mini-cta">Learn more</span>
        </div>
        <div className="px-card-dark">
          <div className="eyebrow"><span style={{width:6,height:6,borderRadius:99,background:"#A56CFF",display:"inline-block"}}/> Computer</div>
          <h3>Research, analyze, create — a multi-step workflow.</h3>
          <p>Evidence → tool → draft → Red Team → approval. The full loop.</p>
          <span className="mini-cta">Build with Composer</span>
        </div>
        <div className="px-card-dark">
          <div className="eyebrow"><span style={{width:6,height:6,borderRadius:99,background:"#4ADE80",display:"inline-block"}}/> Comet</div>
          <h3>Ask, navigate, and act in the flow of any work.</h3>
          <p>Your docs in context. Chat, search, and build without leaving.</p>
          <span className="mini-cta">Download Comet</span>
        </div>
        <div className="px-card-dark">
          <div className="eyebrow"><span style={{width:6,height:6,borderRadius:99,background:"#FBBF24",display:"inline-block"}}/> API Platform</div>
          <h3>The same accurate AI that powers BigBrain at scale.</h3>
          <p>Org-isolated. No data leaves your boundary. Whatever you're building.</p>
          <span className="mini-cta">Start building</span>
        </div>
      </div>
      <div style={{maxWidth:1100, margin:"0 auto", padding:"0 24px", textAlign:"center"}}>
        <h2 style={{fontSize:20, margin:"10px 0 6px", color:"var(--ink-dark)"}}>From first question to finished work</h2>
        <p style={{fontSize:13, color:"#6B7280"}}>Go deep on any company, market, or topic, with sources.</p>
        <div style={{display:"inline-flex", gap:6, background:"#fff", border:"1px solid #EDE8E0", borderRadius:999, padding:4, marginTop:14}}>
          <span style={{padding:"7px 14px", borderRadius:999, fontSize:12, fontWeight:600, background:"#08090C", color:"#fff"}}>Research</span><span style={{padding:"7px 14px", fontSize:12, color:"#6B7280"}}>Analyze</span><span style={{padding:"7px 14px", fontSize:12, color:"#6B7280"}}>Build</span><span style={{padding:"7px 14px", fontSize:12, color:"#6B7280"}}>Automate</span>
        </div>
      </div>
      <div style={{maxWidth:1100, margin:"32px auto 0", padding:"0 24px"}}>
        <div className="grid grid-3">
          <div><div className="eyebrow">Right model, right job</div><p style={{fontSize:13, color:"#6B7280"}}>SLM / LLM / VLM routed per task — fast where possible, strong where it matters.</p></div>
          <div><div className="eyebrow">Grounded in your docs</div><p style={{fontSize:13, color:"#6B7280"}}>Local RAG with cited document IDs. No doc, no claim.</p></div>
          <div><div className="eyebrow">Human stays in control</div><p style={{fontSize:13, color:"#6B7280"}}>Red Team review plus an approval gate on high-risk output.</p></div>
        </div>
        <h2 style={{margin:"28px 0 12px", fontSize:18, color:"var(--ink-dark)"}}>Deployment</h2>
        <div className="grid grid-2">
          <div className="card"><strong>Org GPU server</strong><p className="small" style={{color:"#6B7280"}}>Air-gapped workstation or rack. Data never traverses the internet.</p></div>
          <div className="card"><strong>Approved IndiaAI cloud</strong><p className="small" style={{color:"#6B7280"}}>For orgs cleared to run on national infrastructure.</p></div>
        </div>
      </div>
      <div className="landing-wide-dark">
        <div style={{textAlign:"center"}}>
          <div className="eyebrow" style={{color:"#9AA0B0", display:"flex", justifyContent:"center"}}>Used daily by individuals, trusted by organizations</div>
          <h3 style={{marginTop:8}}>Private by design, powerful in practice.</h3>
        </div>
        <div className="landing-two-dark">
          <div className="subcard">
            <div className="eyebrow" style={{color:"#9AA0B0"}}>◐ For individuals</div>
            <p style={{marginTop:10}}>The full power of BigBrain, free to start.</p>
            <span className="mini-cta" style={{background:"#fff", color:"#0A0A0C", borderColor:"#fff"}}>Start asking</span>
          </div>
          <div className="subcard">
            <div className="eyebrow" style={{color:"#9AA0B0"}}>◑ For teams</div>
            <p style={{marginTop:10}}>Secure, compliant, and ready to scale.</p>
            <span className="mini-cta">Explore Enterprise</span>
          </div>
        </div>
        <div className="landing-two-dark" style={{marginTop:14}}>
          <div className="subcard">
            <div className="eyebrow" style={{color:"#9AA0B0"}}>⬔ For developers</div>
            <p style={{marginTop:10}}>Add fast, cited search to any product.</p>
            <span className="mini-cta">Start building</span>
          </div>
          <div style={{display:"grid", placeItems:"center", color:"#6B7280", fontSize:13}}>Follow us &nbsp; <span style={{border:"1px solid #2A2E38", borderRadius:999, padding:"6px 8px",fontSize:12}}>𝕏 ◯ ◇ ◎</span></div>
        </div>
      </div>
      <div style={{textAlign:"center", padding:"40px 24px 0"}}>
        <h2 style={{fontSize:18, color:"var(--ink-dark)"}}>Prove it to your security team</h2>
        <p style={{color:"#6B7280"}}>0 external requests. Live, on your network.</p>
        <div style={{marginTop:16}}><HairlineButton onClick={onEnter}>Request a briefing →</HairlineButton></div>
      </div>
      <div className="faq">
        <h3>Frequently asked questions</h3>
        <div className="faq-row"><span>What is BigBrain?</span><span>+</span></div>
        <div className="faq-row"><span>How can I use BigBrain?</span><span>+</span></div>
        <div className="faq-row"><span>How is BigBrain different from other platforms?</span><span>+</span></div>
        <div className="faq-row"><span>How does BigBrain protect my information?</span><span>+</span></div>
        <div className="faq-row"><span>How much does it cost?</span><span>+</span></div>
        <div className="faq-row"><span>What are the benefits of upgrading to Enterprise?</span><span>+</span></div>
        <div className="faq-row"><span>How do I get started?</span><span>+</span></div>
      </div>
      <div className="landing-footer">
        <span>Product &nbsp; Security</span>
        <span>BigBrain Lab — org-controlled deployment only</span>
      </div>
    </div>
  );
}
