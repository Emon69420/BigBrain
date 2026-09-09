import { useEffect, useState } from "react";
import * as api from "../services/api.js";

export function ToolsView(){
  const [stats,setStats]=useState(null);
  const [trace,setTrace]=useState([]);
  const [last,setLast]=useState(null);
  const [runRes,setRunRes]=useState(null);
  const [search,setSearch]=useState("");
  const [statusFilter,setStatusFilter]=useState("all");
  async function load(){ setStats(await fetch(`${import.meta.env.VITE_API_URL||"https://22ed-2401-9640-1802-d8dc-2-2-2-1.ngrok-free.app"}/tools/stats`,{headers:{"Content-Type":"application/json","X-Org-Id":api.getOrg(),"ngrok-skip-browser-warning":"true"},credentials:"include"}).then(r=>r.json())); }
  useEffect(()=>{ load(); },[]);
  async function ensure(e){
    e.preventDefault();
    const fd=new FormData(e.target);
    const task=fd.get("task");
    const sampleRaw=fd.get("sample")||"";
    let sample=null;
    if(sampleRaw) try{ sample=JSON.parse(sampleRaw); }catch{ sample=sampleRaw; }
    setTrace(["ensuring…"]);
    const r=await fetch(`${import.meta.env.VITE_API_URL||"https://22ed-2401-9640-1802-d8dc-2-2-2-1.ngrok-free.app"}/tools/ensure`,{method:"POST",headers:{"Content-Type":"application/json","X-Org-Id":api.getOrg(),"ngrok-skip-browser-warning":"true"},credentials:"include",body:JSON.stringify({task, sample_input:sample})}).then(r=>r.json());
    setLast(r);
    setTrace(r.trace||[]);
    load();
  }
  async function run(name, argsRaw){
    let args=null;
    if(argsRaw) try{ args=JSON.parse(argsRaw); }catch{ args=argsRaw; }
    const r=await fetch(`${import.meta.env.VITE_API_URL||"https://22ed-2401-9640-1802-d8dc-2-2-2-1.ngrok-free.app"}/tools/run`,{method:"POST",headers:{"Content-Type":"application/json","X-Org-Id":api.getOrg(),"ngrok-skip-browser-warning":"true"},credentials:"include",body:JSON.stringify({name,args})}).then(r=>r.json());
    setRunRes(r); load();
  }
  if(!stats) return <div style={{padding:16,color:"var(--muted-app)"}}>Loading tools…</div>;

  const filtered = (stats.tools||[]).filter(t=>{
    if(search && !String(t.name).toLowerCase().includes(search.toLowerCase()) && !String(t.desc||"").toLowerCase().includes(search.toLowerCase()) && !String(t.full_desc||"").toLowerCase().includes(search.toLowerCase())) return false;
    if(statusFilter!=="all" && String(t.status)!==statusFilter) return false;
    return true;
  });

  return (
    <div style={{width:"100%"}}>
      {/* Stats */}
      <div className="tools-stats">
        <div className="tools-stat-card">
          <span className="tools-stat-icon tools-stat-icon--blue"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M12 2.5 3.5 7.5 12 12.5 20.5 7.5 12 2.5Z"/><path d="M3.5 7.5v9L12 21.5 20.5 16.5v-9"/><path d="M12 12.5v9"/></svg></span>
          <div>
            <div className="tools-stat-label">Total tools</div>
            <div className="tools-stat-value">{stats.total}</div>
          </div>
        </div>
        <div className="tools-stat-card">
          <span className="tools-stat-icon tools-stat-icon--green"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><circle cx="12" cy="12" r="8.5"/><path d="M8.5 12.2 11 14.7l4.5-5.5"/></svg></span>
          <div>
            <div className="tools-stat-label">Verified</div>
            <div className="tools-stat-value">{stats.verified}</div>
          </div>
        </div>
        <div className="tools-stat-card">
          <span className="tools-stat-icon tools-stat-icon--amber"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><circle cx="12" cy="12" r="8.5"/><path d="M12 8v5"/><circle cx="12" cy="16.5" r="1.1" fill="currentColor" stroke="none"/></svg></span>
          <div>
            <div className="tools-stat-label">Unverified</div>
            <div className="tools-stat-value">{stats.unverified}</div>
          </div>
        </div>
        <div className="tools-stat-card">
          <span className="tools-stat-icon tools-stat-icon--purple"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M4 16V8"/><path d="M8 16V10"/><path d="M12 16V12"/><path d="M16 16V9"/><path d="M20 16V13"/><path d="M2 18h20"/></svg></span>
          <div>
            <div className="tools-stat-label">Total uses</div>
            <div className="tools-stat-value">{stats.total_uses}</div>
          </div>
        </div>
      </div>

      {/* Ensure / build */}
      <div className="tools-ensure-card">
        <div className="tools-ensure-head">
          <div style={{display:"flex",gap:12,alignItems:"center"}}>
            <span className="tools-ensure-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4L14 13l-3-3 3.7-3.7z"/><circle cx="7.5" cy="17.5" r="1.2"/></svg></span>
            <div>
              <div className="tools-ensure-title">Ensure / build a tool</div>
              <div className="tools-ensure-sub">Type a task. Miss → LLM builds + tests (visible trace). Hit → reuse, 0 rebuild.</div>
            </div>
          </div>
          <button type="button" className="tools-how-btn" onClick={()=>alert("Hit: tool exists → reuse without rebuild.\nMiss: LLM drafts tool, runs in sandbox, verifies, then saves to registry.")}><span style={{fontSize:12,lineHeight:1}}>ⓘ</span> How it works</button>
        </div>

        <form onSubmit={ensure} className="tools-ensure-form">
          <label className="tools-input-wrap">
            <span className="tools-input-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M14 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M9 13h6M9 17h6"/></svg></span>
            <input name="task" required placeholder="e.g. simulate blast load on wall - compute pressure from charge and distance" />
          </label>
          <div className="tools-input-row">
            <label className="tools-input-wrap" style={{flex:1}}>
              <span className="tools-input-icon">{`{ }`}</span>
              <input name="sample" placeholder='sample JSON e.g. ("charge_kg":10,"distance_m":5) (optional)' />
            </label>
            <div className="tools-json-select">
              <span>JSON</span><span style={{opacity:.6, fontSize:10}}>▼</span>
            </div>
          </div>
          <button className="tools-ensure-btn" type="submit"><span style={{fontSize:10}}>▶</span> Ensure tool</button>
        </form>

        {!!trace.length && <pre className="tools-trace">{trace.join("\n")}</pre>}
        {last && <div className="tools-last-card">
          <div className="tools-last-meta">{last.hit?"HIT (reused)":"MISS (built)"} {last.reused?"0 rebuild":""} {last.entry?.name && `· ${last.entry.name}`}</div>
          {last.entry && <div className="tools-last-entry"><strong>{last.entry.desc}</strong> — v{last.entry.version} · uses {last.entry.uses} · {last.entry.status}</div>}
          {last.error && <div className="tools-last-error">{last.error}</div>}
        </div>}
      </div>

      {/* Registry header */}
      <div className="tools-registry-head">
        <div>
          <h3 className="tools-registry-title">Registry</h3>
          <p className="tools-registry-sub">All available tools, their purpose, and usage statistics.</p>
        </div>
        <div className="tools-registry-actions">
          <label className="tools-search-wrap">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><circle cx="11" cy="11" r="6.5"/><path d="M15.2 15.2 19 19"/></svg>
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search tools..." />
          </label>
          <label className="tools-status-select">
            <select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}>
              <option value="all">All status</option>
              <option value="verified">Verified</option>
              <option value="unverified">Unverified</option>
            </select>
            <span>▼</span>
          </label>
        </div>
      </div>

      {/* Table */}
      <div className="tools-table-wrap">
        <table className="tools-table">
          <thead>
            <tr>
              <th>NAME <span className="tools-sort">♦</span></th>
              <th>DESCRIPTION</th>
              <th>STATUS</th>
              <th>VERSION</th>
              <th>USES <span className="tools-sort">♦</span></th>
              <th>LAST RUN</th>
              <th>ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(t=>(
              <tr key={t.name}>
                <td className="tools-col-name">{t.name}</td>
                <td className="tools-col-desc">
                  <div className="tools-desc-title">{t.desc}</div>
                  <div className="tools-desc-sub">{String(t.full_desc||"").slice(0,90)}</div>
                </td>
                <td><span className={`tools-status-pill ${t.status==="verified"?"verified":""}`}><span className={`tools-status-dot ${t.status==="verified"?"verified":""}`}/> {t.status}</span></td>
                <td className="tools-col-version">v{t.version}</td>
                <td className="tools-col-uses">{t.uses}</td>
                <td><span className="tools-last-run">{"{"}"a":2{"}"}</span></td>
                <td>
                  <div style={{display:"flex",gap:8,alignItems:"center"}}>
                    <form onSubmit={e=>{e.preventDefault(); const v=new FormData(e.target).get("args"); run(t.name, v);}} style={{display:"flex",gap:0}}>
                      <button className="tools-run-btn" type="submit"><span style={{fontSize:9}}>▶</span> Run</button>
                    </form>
                    <button className="tools-more-btn" type="button" onClick={()=>{}}>···</button>
                  </div>
                </td>
              </tr>
            ))}
            {!filtered.length && <tr><td colSpan={7} className="muted" style={{padding:16,textAlign:"center"}}>No tools match.</td></tr>}
          </tbody>
        </table>
        {runRes && <pre className="tools-trace" style={{marginTop:10}}>{JSON.stringify(runRes, null, 2)}</pre>}
      </div>

      <p className="small muted" style={{marginTop:14, lineHeight:1.5}}>Persistence: files at <code>backend/tools/custom/*.py</code> + <code>models/tool_registry.yaml</code> — survives restarts. Reuse saves LLM build calls.</p>
    </div>
  );
}
