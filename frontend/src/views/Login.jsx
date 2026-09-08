// Login per design.md §5a — centered cold-start, vortex glow, serif headline, hairline actions.
import { useState } from "react";
import VortexBackground from "../components/VortexBackground.jsx";
import HairlineButton from "../components/HairlineButton.jsx";

export function Login({ onLogin, onRegister }){
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
    <div style={{position:"relative", minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", overflow:"hidden"}}>
      <VortexBackground opacity={0.28}/>
      <div style={{position:"relative", width:360, textAlign:"center"}}>
        <div style={{fontSize:13, color:"var(--muted)"}}>b ◆ seal</div>
        <h1 style={{fontSize:30, margin:"14px 0 6px"}}>Sovereign Industrial AI Workbench</h1>
        <p className="muted" style={{margin:"0 0 22px"}}>Your documents. Your GPU. No exit.</p>
        <form onSubmit={submit} style={{display:"grid", gap:10, textAlign:"left"}}>
          <input className="input" name="email" placeholder="ORG ID · email@company.in" required type="email"/>
          {mode==="register" && <input className="input" name="name" placeholder="Your name" required/>}
          <input className="input" name="password" placeholder="password" required type="password"/>
          {err && <div style={{color:"var(--risk-critical)", fontSize:13}}>{err}</div>}
          <HairlineButton type="submit">{mode==="login"?"Sign in →":"Create account →"}</HairlineButton>
        </form>
        <button className="btn btn-ghost" style={{marginTop:10, width:"100%"}} onClick={()=>setMode(mode==="login"?"register":"login")}>
          {mode==="login"?"Need an account? Register":"Have an account? Sign in"}
        </button>
      </div>
    </div>
  );
}
