import { useEffect, useState } from "react";
import * as api from "../services/api.js";

export function SecurityView(){
  const [st,setSt]=useState(null);
  const [allow,setAllow]=useState(null);
  const [msg,setMsg]=useState("");
  const [searchBlocked,setSearchBlocked]=useState("");
  const [copied,setCopied]=useState(false);
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
  async function handleCopy(){
    if(!allow) return;
    const text=`Local: ${allow.local.join(", ")}\nModel API: ${allow.model_api}`;
    try{ await navigator.clipboard.writeText(text); setCopied(true); setTimeout(()=>setCopied(false),1500); }catch{}
  }
  if(!st) return <div style={{padding:16,color:"var(--muted-app)"}}>Loading security…{msg && <p className="small muted">{msg}</p>}</div>;

  const blockedHosts = (st.blocked_hosts||[]).filter(b=> !searchBlocked || String(b.host).toLowerCase().includes(searchBlocked.toLowerCase()));

  return (
    <div className="sec-page">
      {/* Header + stats */}
      <div className="sec-header-row">
        <div>
          <h2 className="sec-title">Security</h2>
          <p className="sec-subtitle">Every outbound request is counted, classified, and logged. Denials happen before any socket opens.</p>
        </div>
        <div className="sec-stats">
          <div className="sec-stat">
            <div className="sec-stat-label">Model calls</div>
            <div className="sec-stat-value">{st.model}</div>
          </div>
          <div className="sec-stat">
            <div className="sec-stat-label">Database</div>
            <div className="sec-stat-value">{st.database}</div>
          </div>
          <div className="sec-stat">
            <div className="sec-stat-label">Blocked</div>
            <div className="sec-stat-value sec-stat-value--danger">{st.blocked}</div>
          </div>
          <div className="sec-stat">
            <div className="sec-stat-label">Blocked event recorded</div>
            <div className="sec-stat-value sec-stat-value--danger">{(st.blocked_hosts||[]).length ? 1 : 0}</div>
          </div>
        </div>
      </div>

      {/* Prove it */}
      <div className="sec-card">
        <div className="sec-prove-head">
          <div>
            <div className="sec-prove-title">Prove it</div>
            <div className="sec-prove-sub">Fires a request to a non-allowlisted host through the guard. Expect denial + a new audit row. Local work continues.</div>
          </div>
          <button type="button" className="sec-what-btn" onClick={()=>alert("Sends a fetch to a host not in the allowlist via the backend egress guard. The guard denies before opening a socket and logs the attempt.")}>What does this do?</button>
        </div>
        <button className="sec-simulate-btn" onClick={trigger}><span style={{fontSize:11}}>▶</span> Simulate rogue egress</button>
        {msg && <div className="sec-msg">{msg}</div>}
      </div>

      {/* Blocked endpoints */}
      <div className="sec-card">
        <div className="sec-blocked-head">
          <div>
            <div className="sec-blocked-title">Blocked endpoints</div>
            <div className="sec-blocked-sub">Policy is deny-by-default: anything not allowlisted is denied automatically. These hosts actually tried and were stopped.</div>
          </div>
          <label className="sec-search-wrap">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><circle cx="11" cy="11" r="6.5"/><path d="M15.2 15.2 19 19"/></svg>
            <input value={searchBlocked} onChange={e=>setSearchBlocked(e.target.value)} placeholder="Search blocked endpoints..." />
          </label>
        </div>

        <div className="sec-table-wrap">
          <table className="sec-table">
            <thead>
              <tr><th>DESTINATION</th><th>ATTEMPTS</th><th>LAST SEEN</th><th></th></tr>
            </thead>
            <tbody>
              {blockedHosts.map((b,i)=>(
                <tr key={i}>
                  <td className="sec-dest">{b.host}</td>
                  <td className="sec-attempts">{b.attempts}</td>
                  <td className="sec-last-seen">{b.last_seen}</td>
                  <td style={{textAlign:"right"}}>
                    <button className="sec-view-btn" onClick={()=>alert(`Logs for ${b.host}\nAttempts: ${b.attempts}\nLast seen: ${b.last_seen}`)}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M14 2H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M10 12h6M10 16h4"/></svg> View logs</button>
                  </td>
                </tr>
              ))}
              {!blockedHosts.length && <tr><td colSpan={4} className="sec-empty">{searchBlocked ? "No matching blocked endpoints." : "No blocked attempts yet — run Simulate rogue egress above."}</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {/* Allowed */}
      <div className="sec-card">
        <div className="sec-allowed-head">
          <div className="sec-allowed-title">Allowed</div>
          <button className="sec-copy-btn" onClick={handleCopy}><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><rect x="9" y="9" width="10" height="10" rx="2"/><path d="M15 9V7a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"/></svg> {copied ? "Copied" : "Copy"}</button>
        </div>
        {allow ? (
          <div className="sec-code-panel">
            <div className="sec-code-line"><span className="sec-code-num">1</span><span className="sec-code-key">Local:</span> <span className="sec-code-green">{allow.local.join(", ")}</span></div>
            <div className="sec-code-line"><span className="sec-code-num">2</span><span className="sec-code-key">Model API:</span> <span className="sec-code-green">{allow.model_api}</span></div>
          </div>
        ) : (
          <div className="sec-code-panel" style={{color:"var(--muted-app)"}}>Loading allowlist…</div>
        )}
        <div className="sec-policy-note">deny-by-default; denials are recorded before any socket opens.</div>
      </div>

      {/* Audit trail - kept subtle, collapsed visual noise */}
      <div className="sec-card" style={{paddingBottom:12}}>
        <div className="sec-allowed-title" style={{marginBottom:8}}>Audit trail</div>
        <div className="sec-table-wrap sec-table-wrap--audit">
          <table className="sec-table">
            <thead><tr><th>Time</th><th>Destination</th><th>Verdict</th><th>Source</th></tr></thead>
            <tbody>
              {(st.recent||[]).map((e,i)=>(
                <tr key={i}>
                  <td className="sec-audit-time">{e.at}</td>
                  <td className="sec-audit-host">{e.host}</td>
                  <td className={`sec-audit-verdict ${e.verdict==="blocked"?"blocked":""}`}>{e.verdict}</td>
                  <td className="sec-audit-source">{e.source}</td>
                </tr>
              ))}
              {!(st.recent||[]).length && <tr><td colSpan={4} className="sec-empty">No events yet — ask something or run the demo.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
