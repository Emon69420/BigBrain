import { useEffect, useState } from "react";
import * as api from "../services/api.js";

export function SecurityView(){
  const [st,setSt]=useState(null);
  const [allow,setAllow]=useState(null);
  const [msg,setMsg]=useState("");
  async function load(){
    try{
      const [s,a]=await Promise.all([api.getSecurityStatus(), api.getAllowlist()]);
      setSt(s); setAllow(a); setMsg("");
    }catch(e){ setMsg(e.message); }
  }
  useEffect(()=>{ load(); },[]);
  async function trigger(){
    setMsg("attempting…");
    try{
      const r=await api.demoEgress();
      setMsg(r.blocked ? `denied: ${r.host||r.target} — recorded` : "target was allowlisted, nothing to deny");
    }catch(e){ setMsg(e.message); }
    load();
  }
  if(!st) return <div>Loading security…{msg && <p className="small muted">{msg}</p>}</div>;
  const blockedFlash = st.blocked>0;
  return (
    <div>
      <h2 style={{margin:"0 0 4px"}}>Security</h2>
      <p className="small muted" style={{margin:"0 0 12px"}}>Every outbound request counted, classified, and logged. Denials happen before any socket opens.</p>
      <div style={{display:"flex", gap:8, flexWrap:"wrap", marginBottom:12}}>
        <span className="badge">Model calls {st.model}</span>
        <span className="badge">Database {st.database}</span>
        <span className="badge">Blocked {st.blocked}</span>
        {blockedFlash
          ? <span className="badge" style={{color:"var(--danger)", borderColor:"var(--danger)"}}>Blocked event recorded</span>
          : <span className="badge">No unapproved egress</span>}
      </div>
      <div className="card">
        <h3 style={{margin:"0 0 8px"}}>Prove it</h3>
        <p className="small muted">Fires a request to a non-allowlisted host through the guard. Expect denial + a new audit row. Local work continues.</p>
        <button className="btn btn-primary" onClick={trigger}>Simulate rogue egress</button>
        {msg && <p className="small muted" style={{marginBottom:0}}>{msg}</p>}
      </div>
      <div style={{marginTop:14}}>
        <h3>Blocked endpoints</h3>
        <p className="small muted" style={{margin:"0 0 8px"}}>Policy is deny-by-default: anything not allowlisted is denied automatically. These hosts actually tried and were stopped.</p>
        {(st.blocked_hosts||[]).length ? (
          <table className="table">
            <thead><tr><th>Destination</th><th>Attempts</th><th>Last seen</th></tr></thead>
            <tbody>
              {(st.blocked_hosts||[]).map((b,i)=>(
                <tr key={i}>
                  <td className="mono small" style={{color:"var(--danger)"}}>{b.host}</td>
                  <td>{b.attempts}</td>
                  <td className="small muted">{b.last_seen}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="card small muted">No blocked attempts yet — run Simulate rogue egress above.</div>
        )}
      </div>
      <div style={{marginTop:14}}>
        <h3>Allowed</h3>
        {allow ? (
          <div className="card small">
            <div>Local: <span className="mono">{allow.local.join(", ")}</span></div>
            <div style={{marginTop:4}}>Model API: <span className="mono">{allow.model_api}</span></div>
            <div className="muted" style={{marginTop:4}}>{allow.policy}</div>
          </div>
        ) : (
          <div className="card small muted">Loading allowlist…</div>
        )}
      </div>
      <div style={{marginTop:14}}>
        <h3>Audit trail</h3>
        <table className="table">
          <thead><tr><th>Time</th><th>Destination</th><th>Verdict</th><th>Source</th></tr></thead>
          <tbody>
            {(st.recent||[]).map((e,i)=>(
              <tr key={i}>
                <td className="small muted">{e.at}</td>
                <td className="mono small">{e.host}</td>
                <td style={e.verdict==="blocked"?{color:"var(--danger)"}:null}>{e.verdict}</td>
                <td className="small muted">{e.source}</td>
              </tr>
            ))}
            {!(st.recent||[]).length && <tr><td colSpan={4} className="muted">No events yet — ask something or run the demo.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
