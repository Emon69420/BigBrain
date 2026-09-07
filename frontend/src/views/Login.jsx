import { useState } from "react";

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
    <div style={{maxWidth:380, margin:"48px auto"}}>
      <div className="card">
        <div className="eyebrow">{mode==="login"?"Welcome back":"Create account"}</div>
        <h2 style={{margin:"6px 0"}}>{mode==="login"?"Sign in":"Register"}</h2>
        <form onSubmit={submit} style={{display:"grid", gap:10, marginTop:12}}>
          <input className="input" name="email" placeholder="email@company.in" required type="email"/>
          {mode==="register" && <input className="input" name="name" placeholder="Your name" required/>}
          <input className="input" name="password" placeholder="password" required type="password"/>
          {err && <div style={{color:"var(--danger)", fontSize:13}}>{err}</div>}
          <button className="btn btn-primary">{mode==="login"?"Sign in":"Create account"}</button>
        </form>
        <button className="btn btn-ghost" style={{marginTop:8, width:"100%"}} onClick={()=>setMode(mode==="login"?"register":"login")}>
          {mode==="login"?"Need an account? Register":"Have an account? Sign in"}
        </button>
      </div>
    </div>
  );
}
