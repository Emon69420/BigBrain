// Landing — minimal dark, no gradients, Apple-inspired
import BrainMark from "../components/BrainMark.jsx";
import heroImg from "../images/hero.png";

export function Landing({ onEnter }){
  return (
    <div style={{background:"var(--bg-primary)", color:"var(--text-primary)", minHeight:"100vh", overflowY:"auto", overflowX:"hidden", position:"relative"}}>
      {/* top nav */}
      <div style={{position:"relative", zIndex:2, display:"flex", alignItems:"center", justifyContent:"space-between", padding:"14px 28px", borderBottom:"1px solid var(--border)", maxWidth:1280, margin:"0 auto", width:"100%"}}>
        <div style={{display:"flex", alignItems:"center", gap:10}}>
          <span style={{width:28,height:28,borderRadius:8,background:"var(--surface)",border:"1px solid var(--border-strong)",display:"grid",placeItems:"center",color:"var(--text-primary)"}}>
            <BrainMark size={18}/>
          </span>
          <strong style={{fontSize:16, letterSpacing:"-.01em"}}>BigBrain</strong>
        </div>
        <button onClick={onEnter} style={{marginLeft:"auto", background:"var(--accent)", color:"#fff", border:"none", borderRadius:999, padding:"8px 16px", fontSize:13, fontWeight:500, cursor:"pointer", display:"flex", alignItems:"center", gap:6}}>Login <span>→</span></button>
      </div>

      {/* hero */}
      <div style={{position:"relative", zIndex:2, maxWidth:1280, margin:"0 auto", padding:"48px 28px 24px", display:"grid", gridTemplateColumns:"1.05fr 1.35fr", gap:24, alignItems:"center"}}>
        {/* left */}
        <div>
          <div className="eyebrow" style={{marginBottom:14}}>AI FOR THE CURIOUS</div>
          <h1 style={{fontFamily:"Georgia, serif", fontSize:44, lineHeight:1.05, margin:0, fontWeight:650, letterSpacing:"-.03em", color:"var(--text-primary)"}}>
            Your AI workbench<br/>for <span style={{color:"var(--accent-ink)"}}>real-world work.</span>
          </h1>
          <p style={{color:"var(--text-secondary)", fontSize:14.5, lineHeight:1.6, margin:"14px 0 18px", maxWidth:480}}>
            Local models. Your GPU. Nothing leaves.<br/>Get answers, build tools, and work with confidence.
          </p>
          <div style={{display:"flex", gap:10, marginTop:6}}>
            <button onClick={onEnter} style={{background:"transparent", color:"var(--text-primary)", border:"1px solid var(--border-strong)", borderRadius:8, padding:"10px 18px", fontWeight:600, fontSize:13, cursor:"pointer", display:"flex", alignItems:"center", gap:6}}>Get Started <span>→</span></button>
            <button onClick={onEnter} style={{background:"transparent", color:"var(--text-secondary)", border:"1px solid var(--border)", borderRadius:8, padding:"10px 18px", fontWeight:500, fontSize:13, cursor:"pointer"}}>Learn More</button>
          </div>
          <div style={{display:"flex", gap:18, marginTop:22, flexWrap:"wrap"}}>
            {[
              ["01", "Private & Secure", "Your data stays local"],
              ["02", "Built for Industry", "Real workflows"],
              ["03", "Human in the Loop", "Control when it matters"],
            ].map(([n,t,s])=>(
              <div key={n} style={{display:"flex", gap:8, alignItems:"center"}}>
                <span style={{width:28,height:28,borderRadius:8,background:"var(--glass-bg)",border:"1px solid var(--border)",display:"grid",placeItems:"center",fontSize:11,fontWeight:700,color:"var(--accent-ink)",fontFamily:"var(--mono)"}}>{n}</span>
                <div><div style={{fontSize:12,fontWeight:600,color:"var(--text-primary)"}}>{t}</div><div style={{fontSize:11,color:"var(--text-muted)"}}>{s}</div></div>
              </div>
            ))}
          </div>
        </div>
        {/* right mock */}
        <div style={{position:"relative", display:"grid", placeItems:"center"}}>
          <img src={heroImg} alt="BigBrain workbench" style={{width:"100%", maxWidth:640, height:"auto", display:"block", filter:"drop-shadow(0 24px 64px rgba(0,0,0,.55))", borderRadius:18}} />
        </div>
      </div>

      {/* trusted bar */}
      <div style={{position:"relative", zIndex:2, maxWidth:1280, margin:"8px auto 0", padding:"14px 28px", borderTop:"1px solid var(--border)", display:"flex", flexDirection:"column", gap:12}}>
        <div style={{display:"flex", alignItems:"center", gap:12}}>
          <div style={{height:1, flex:1, background:"var(--border)"}} />
          <span className="eyebrow">TRUSTED BY BUILDERS, RESEARCHERS AND INDUSTRY TEAMS</span>
          <div style={{height:1, flex:1, background:"var(--border)"}} />
        </div>
        <div style={{display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:16, padding:"6px 0"}}>
          {[
            ["01", "100%", "Local execution"],
            ["02", "Grounded", "Citations, always"],
            ["03", "Faster", "From docs to decisions"],
            ["04", "Smarter", "With human oversight"],
          ].map(([n,t,s],i)=>(
            <div key={n} style={{display:"flex", gap:10, alignItems:"center", ...(i>0?{borderLeft:"1px solid var(--border)", paddingLeft:16}:{})}}>
              <span style={{width:34,height:34,borderRadius:8,background:"var(--glass-bg)",display:"grid",placeItems:"center",fontSize:11,fontWeight:700,color:"var(--accent-ink)",fontFamily:"var(--mono)",border:"1px solid var(--border)"}}>{n}</span>
              <div><div style={{fontWeight:600, fontSize:13, color:"var(--text-primary)"}}>{t}</div><div style={{fontSize:11,color:"var(--text-muted)"}}>{s}</div></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
