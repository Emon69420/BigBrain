// Login — minimal dark card, no background effects (design ref: Claude/ChatGPT sign-in)
import { useState } from "react";
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
  function switchMode(next){ setMode(next); setErr(""); }
  return (
    <div className="login-page">
      <div className="login-wrap">
        {onBack && <button className="login-back" onClick={onBack}>← Back to site</button>}
        <div className="login-card">
          <div className="login-brand"><BrainMark size={20}/><span>BigBrain</span></div>
          <h1>{mode==="login"?"Sign in":"Create your account"}</h1>
          <p className="login-sub">{mode==="login"?"Continue to your workspace":"One account for your whole team"}</p>
          <form onSubmit={submit} className="login-form">
            <input className="input" name="email" placeholder="Work email" required type="email" autoFocus/>
            {mode==="register" && <input className="input" name="name" placeholder="Your name" required/>}
            <input className="input" name="password" placeholder="Password" required type="password"/>
            {err && <div className="login-error">{err}</div>}
            <button className="login-submit" type="submit">{mode==="login"?"Sign in":"Create account"}</button>
          </form>
          <div className="login-alt">
            {mode==="login"
              ? <>Don&apos;t have an account? <button type="button" onClick={()=>switchMode("register")}>Create one</button></>
              : <>Already have an account? <button type="button" onClick={()=>switchMode("login")}>Sign in</button></>}
          </div>
        </div>
        <div className="login-footnote">Secure · Org-isolated · Zero external requests</div>
      </div>
    </div>
  );
}
