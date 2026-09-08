// Login per design.md §5a — centered cold-start, vortex glow, serif headline, hairline actions.
import { useState } from "react";
import VortexBackground from "../components/VortexBackground.jsx";
import HairlineButton from "../components/HairlineButton.jsx";
import BrainMark from "../components/BrainMark.jsx";

export function Login({ onLogin, onRegister, onBack }){
  const [mode,setMode]=useState("login");
  const [err,setErr]=useState("");
  async function submit(e){
    e.preventDefault(); setErr("");
    const fd=new FormData(e.target);
    try{
      if(mode==="login") await onLogin(fd.get("email"), fd.get("password"));
      else await onRegister(fd.get("email"), fd.get("name"), fd.get("password"));
    }catch(ex){ setErr(ex.message); }
  }
  return (
    <div className="login-page">
      <VortexBackground opacity={0.32}/>
      <div className="hero-ellipses" aria-hidden="true" style={{opacity:.45}}><div className="ellipse" style={{width:680,height:300}}></div><div className="ellipse" style={{width:860,height:380}}></div></div>
      <div className="login-card">
        {onBack && <button onClick={onBack} style={{position:"absolute", top:14, left:14, background:"rgba(255,255,255,.06)", border:"1px solid rgba(255,255,255,.08)", color:"var(--muted-app)", borderRadius:999, padding:"6px 10px", fontSize:12, cursor:"pointer", display:"flex", alignItems:"center", gap:6}} aria-label="Back to landing">← Landing</button>}
        <div style={{display:"flex", justifyContent:"center", color:"var(--ink-app)", marginTop: onBack ? 20 : 0}}><BrainMark size={36}/></div>
        <h1 style={{textAlign:"center"}}>Sovereign Industrial AI Workbench</h1>
        <p className="muted" style={{textAlign:"center", margin:"8px 0 20px", fontSize:13, color:"#7C819A"}}>Your documents. Your GPU. No exit.</p>
        <form onSubmit={submit} style={{display:"grid", gap:11, textAlign:"left"}}>
          <input className="input" name="email" placeholder="ORG ID · email@company.in" required type="email"/>
          {mode==="register" && <input className="input" name="name" placeholder="Your name" required/>}
          <input className="input" name="password" placeholder="password" required type="password"/>
          {err && <div style={{color:"var(--danger)", fontSize:13, background:"#FFF1F1", border:"1px solid #FECACA", padding:"8px 10px", borderRadius:10}}>{err}</div>}
          <HairlineButton type="submit">{mode==="login"?"Sign in →":"Create account →"}</HairlineButton>
        </form>
        <button className="btn btn-ghost" style={{marginTop:12, width:"100%", color:"#6B7280", border:"1px solid #EDE8E0", borderRadius:999, background:"#fff"}} onClick={()=>setMode(mode==="login"?"register":"login")}>
          {mode==="login"?"Need an account? Register":"Have an account? Sign in"}
        </button>
        <div style={{textAlign:"center", marginTop:14, fontSize:11, color:"#9AA0B0"}}>Secure · Org-isolated · 0 external requests</div>
      </div>
    </div>
  );
}
