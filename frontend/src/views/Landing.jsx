// Landing — exact to Image Sep 8, 2026 mock
import BrainMark from "../components/BrainMark.jsx";
import heroImg from "../images/hero.png";

export function Landing({ onEnter }){
  return (
    <div style={{background:"#070A1E", color:"#E8EAF6", minHeight:"100vh", overflowY:"auto", overflowX:"hidden", position:"relative"}}>
      <div style={{zoom:1.1}}>
      {/* glows */}
      <div aria-hidden="true" style={{position:"absolute", inset:0, pointerEvents:"none", background:"radial-gradient(800px 500px at 70% 20%, rgba(124,58,237,.22), transparent 60%), radial-gradient(600px 400px at 15% 60%, rgba(99,102,241,.10), transparent 60%), radial-gradient(500px 400px at 95% 90%, rgba(124,58,237,.14), transparent 60%)"}} />
      {/* top */}
      <div style={{position:"relative", zIndex:2, display:"flex", alignItems:"center", justifyContent:"space-between", padding:"14px 28px", borderBottom:"1px solid rgba(255,255,255,.06)", maxWidth:1280, margin:"0 auto", width:"100%"}}>
        <div style={{display:"flex", alignItems:"center", gap:10}}>
          <span style={{width:28,height:28,borderRadius:8,background:"linear-gradient(135deg,#6366F1,#7C3AED)",display:"grid",placeItems:"center",color:"#fff"}}><BrainMark size={18}/></span>
          <strong style={{fontSize:16, letterSpacing:"-.01em"}}>BigBrain</strong>
        </div>
        <nav style={{display:"flex", gap:28, fontSize:13, color:"#9AA0B8", fontWeight:500}}>
          <span style={{cursor:"pointer"}}>Product</span>
          <span style={{cursor:"pointer"}}>Security</span>
          <span style={{cursor:"pointer"}}>Docs</span>
          <span style={{cursor:"pointer"}}>About</span>
        </nav>
        <button onClick={onEnter} style={{background:"linear-gradient(135deg,#6366F1,#7C3AED)", color:"#fff", border:"none", borderRadius:999, padding:"8px 16px", fontSize:13, fontWeight:650, cursor:"pointer", display:"flex", alignItems:"center", gap:6, boxShadow:"0 4px 16px rgba(99,102,241,.35)"}}>Login <span>→</span></button>
      </div>

      {/* hero */}
      <div style={{position:"relative", zIndex:2, maxWidth:1280, margin:"0 auto", padding:"28px 28px 24px", display:"grid", gridTemplateColumns:"1.05fr 1.35fr", gap:24, alignItems:"center"}}>
        {/* left */}
        <div>
          <div style={{fontSize:10, letterSpacing:".22em", textTransform:"uppercase", color:"#7C819A", fontWeight:700, marginBottom:14}}>AI FOR THE CURIOUS</div>
          <h1 style={{fontFamily:"Georgia, serif", fontSize:44, lineHeight:1.05, margin:0, fontWeight:650, letterSpacing:"-.03em", color:"#fff"}}>
            Your AI workbench<br/>for <span style={{background:"linear-gradient(135deg,#A78BFA,#7C3AED)", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent"}}>real-world work.</span>
          </h1>
          <p style={{color:"#9AA0B8", fontSize:14.5, lineHeight:1.6, margin:"14px 0 18px", maxWidth:480}}>
            Local models. Your GPU. Nothing leaves.<br/>Get answers, build tools, and work with confidence.
          </p>
          <div style={{display:"flex", gap:10, marginTop:6}}>
            <button onClick={onEnter} style={{background:"linear-gradient(135deg,#6366F1,#7C3AED)", color:"#fff", border:"none", borderRadius:999, padding:"10px 18px", fontWeight:700, fontSize:13, cursor:"pointer", boxShadow:"0 6px 20px rgba(99,102,241,.35)", display:"flex", alignItems:"center", gap:6}}>Get Started <span>→</span></button>
            <button onClick={onEnter} style={{background:"rgba(255,255,255,.06)", color:"#E8EAF6", border:"1px solid rgba(255,255,255,.12)", borderRadius:999, padding:"10px 18px", fontWeight:600, fontSize:13, cursor:"pointer"}}>Learn More</button>
          </div>
          <div style={{display:"flex", gap:18, marginTop:22, flexWrap:"wrap"}}>
            <div style={{display:"flex", gap:8, alignItems:"center"}}>
              <span style={{width:28,height:28,borderRadius:999,background:"rgba(255,255,255,.06)",border:"1px solid rgba(255,255,255,.08)",display:"grid",placeItems:"center",fontSize:11,fontWeight:700,color:"#A5B4FC",fontFamily:"var(--mono)"}}>01</span>
              <div><div style={{fontSize:12,fontWeight:650,color:"#fff"}}>Private & Secure</div><div style={{fontSize:11,color:"#7C819A"}}>Your data stays local</div></div>
            </div>
            <div style={{display:"flex", gap:8, alignItems:"center"}}>
              <span style={{width:28,height:28,borderRadius:999,background:"rgba(255,255,255,.06)",border:"1px solid rgba(255,255,255,.08)",display:"grid",placeItems:"center",fontSize:11,fontWeight:700,color:"#A5B4FC",fontFamily:"var(--mono)"}}>02</span>
              <div><div style={{fontSize:12,fontWeight:650,color:"#fff"}}>Built for Industry</div><div style={{fontSize:11,color:"#7C819A"}}>Real workflows</div></div>
            </div>
            <div style={{display:"flex", gap:8, alignItems:"center"}}>
              <span style={{width:28,height:28,borderRadius:999,background:"rgba(255,255,255,.06)",border:"1px solid rgba(255,255,255,.08)",display:"grid",placeItems:"center",fontSize:11,fontWeight:700,color:"#A5B4FC",fontFamily:"var(--mono)"}}>03</span>
              <div><div style={{fontSize:12,fontWeight:650,color:"#fff"}}>Human in the Loop</div><div style={{fontSize:11,color:"#7C819A"}}>Control when it matters</div></div>
            </div>
          </div>
        </div>
        {/* right mock */}
        <div style={{position:"relative", display:"grid", placeItems:"center"}}>
          <div style={{position:"absolute", width:560, height:380, background:"radial-gradient(400px 300px at 50% 50%, rgba(99,102,241,.25), transparent 70%)", filter:"blur(20px)", pointerEvents:"none"}} />
          <img src={heroImg} alt="BigBrain workbench" style={{width:"100%", maxWidth:640, height:"auto", display:"block", filter:"drop-shadow(0 24px 64px rgba(0,0,0,.55))", borderRadius:18}} />
        </div>
      </div>

      {/* trusted bar */}
      <div style={{position:"relative", zIndex:2, maxWidth:1280, margin:"8px auto 0", padding:"14px 28px", borderTop:"1px solid rgba(255,255,255,.06)", display:"flex", flexDirection:"column", gap:12}}>
        <div style={{display:"flex", alignItems:"center", gap:12}}>
          <div style={{height:1, flex:1, background:"rgba(255,255,255,.06)"}} />
          <span style={{fontSize:10, letterSpacing:".16em", textTransform:"uppercase", color:"#6B6F8A", fontWeight:700}}>TRUSTED BY BUILDERS, RESEARCHERS AND INDUSTRY TEAMS</span>
          <div style={{height:1, flex:1, background:"rgba(255,255,255,.06)"}} />
        </div>
        <div style={{display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:16, padding:"6px 0"}}>
          <div style={{display:"flex", gap:10, alignItems:"center"}}>
            <span style={{width:34,height:34,borderRadius:999,background:"rgba(255,255,255,.06)",display:"grid",placeItems:"center",fontSize:11,fontWeight:700,color:"#A5B4FC",fontFamily:"var(--mono)",border:"1px solid rgba(255,255,255,.08)"}}>01</span>
            <div><div style={{fontWeight:700, fontSize:13, color:"#fff"}}>100%</div><div style={{fontSize:11,color:"#7C819A"}}>Local execution</div></div>
          </div>
          <div style={{display:"flex", gap:10, alignItems:"center", borderLeft:"1px solid rgba(255,255,255,.06)", paddingLeft:16}}>
            <span style={{width:34,height:34,borderRadius:999,background:"rgba(255,255,255,.06)",display:"grid",placeItems:"center",fontSize:11,fontWeight:700,color:"#A5B4FC",fontFamily:"var(--mono)",border:"1px solid rgba(255,255,255,.08)"}}>02</span>
            <div><div style={{fontWeight:700, fontSize:13, color:"#fff"}}>Grounded</div><div style={{fontSize:11,color:"#7C819A"}}>Citations, always</div></div>
          </div>
          <div style={{display:"flex", gap:10, alignItems:"center", borderLeft:"1px solid rgba(255,255,255,.06)", paddingLeft:16}}>
            <span style={{width:34,height:34,borderRadius:999,background:"rgba(255,255,255,.06)",display:"grid",placeItems:"center",fontSize:11,fontWeight:700,color:"#A5B4FC",fontFamily:"var(--mono)",border:"1px solid rgba(255,255,255,.08)"}}>03</span>
            <div><div style={{fontWeight:700, fontSize:13, color:"#fff"}}>Faster</div><div style={{fontSize:11,color:"#7C819A"}}>From docs to decisions</div></div>
          </div>
          <div style={{display:"flex", gap:10, alignItems:"center", borderLeft:"1px solid rgba(255,255,255,.06)", paddingLeft:16}}>
            <span style={{width:34,height:34,borderRadius:999,background:"rgba(255,255,255,.06)",display:"grid",placeItems:"center",fontSize:11,fontWeight:700,color:"#A5B4FC",fontFamily:"var(--mono)",border:"1px solid rgba(255,255,255,.08)"}}>04</span>
            <div><div style={{fontWeight:700, fontSize:13, color:"#fff"}}>Smarter</div><div style={{fontSize:11,color:"#7C819A"}}>With human oversight</div></div>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}
