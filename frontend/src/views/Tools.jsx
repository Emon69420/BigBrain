import { useEffect, useState } from "react";
import * as api from "../services/api.js";

export function ToolsView(){
  const [stats,setStats]=useState(null);
  const [trace,setTrace]=useState([]);
  const [last,setLast]=useState(null);
  const [runRes,setRunRes]=useState(null);
  async function load(){ setStats(await fetch(`${import.meta.env.VITE_API_URL||"https://7db2-2401-9640-1802-d8dc-2-2-2-1.ngrok-free.app"}/tools/stats`,{headers:{"Content-Type":"application/json","X-Org-Id":api.getOrg(),"ngrok-skip-browser-warning":"true"},credentials:"include"}).then(r=>r.json())); }
  useEffect(()=>{ load(); },[]);
  async function ensure(e){
    e.preventDefault();
    const fd=new FormData(e.target);
    const task=fd.get("task");
    const sampleRaw=fd.get("sample")||"";
    let sample=null;
    if(sampleRaw) try{ sample=JSON.parse(sampleRaw); }catch{ sample=sampleRaw; }
    setTrace(["ensuring…"]);
    const r=await fetch(`${import.meta.env.VITE_API_URL||"https://7db2-2401-9640-1802-d8dc-2-2-2-1.ngrok-free.app"}/tools/ensure`,{method:"POST",headers:{"Content-Type":"application/json","X-Org-Id":api.getOrg(),"ngrok-skip-browser-warning":"true"},credentials:"include",body:JSON.stringify({task, sample_input:sample})}).then(r=>r.json());
    setLast(r);
    setTrace(r.trace||[]);
    load();
  }
  async function run(name, argsRaw){
    let args=null;
    if(argsRaw) try{ args=JSON.parse(argsRaw); }catch{ args=argsRaw; }
    const r=await fetch(`${import.meta.env.VITE_API_URL||"https://7db2-2401-9640-1802-d8dc-2-2-2-1.ngrok-free.app"}/tools/run`,{method:"POST",headers:{"Content-Type":"application/json","X-Org-Id":api.getOrg(),"ngrok-skip-browser-warning":"true"},credentials:"include",body:JSON.stringify({name,args})}).then(r=>r.json());
    setRunRes(r); load();
  }
  if(!stats) return <div>Loading tools…</div>;
  return (
    <div style={{width:"100%"}}>
      <div style={{display:"flex", gap:8, flexWrap:"wrap", marginBottom:12}}>
        <span className="badge">total {stats.total}</span>
        <span className="badge">verified {stats.verified}</span>
        <span className="badge">unverified {stats.unverified}</span>
        <span className="badge">total uses {stats.total_uses}</span>
      </div>
      <div className="card">
        <h3 style={{margin:"0 0 8px"}}>Ensure / build a tool</h3>
        <p className="small muted">Type a task. Miss → LLM builds + tests (visible trace). Hit → reuse, 0 rebuild.</p>
        <form onSubmit={ensure} style={{display:"grid", gap:8, marginTop:8}}>
          <input name="task" className="input" placeholder='e.g. simulate blast load on wall - compute pressure from charge and distance' required/>
          <input name="sample" className="input" placeholder='sample JSON e.g. {"charge_kg":10,"distance_m":5} (optional)'/>
          <button className="btn btn-primary">Ensure tool</button>
        </form>
        {!!trace.length && <pre style={{marginTop:10, background:"var(--bg-2)", padding:10, borderRadius:8, fontSize:12, whiteSpace:"pre-wrap"}}>{trace.join("\n")}</pre>}
        {last && <div className="card" style={{marginTop:8, background:"var(--bg-2)"}}>
          <div style={{fontSize:12, color:"var(--muted-2)"}}>{last.hit?"HIT (reused)":"MISS (built)"} {last.reused?"0 rebuild":""} {last.entry?.name && `· ${last.entry.name}`}</div>
          {last.entry && <div style={{fontSize:13}}><strong>{last.entry.desc}</strong> — v{last.entry.version} · uses {last.entry.uses} · {last.entry.status}</div>}
          {last.error && <div style={{color:"var(--danger)", fontSize:13}}>{last.error}</div>}
        </div>}
      </div>
      <div style={{marginTop:14}}>
        <h3>Registry</h3>
        <table className="table">
          <thead><tr><th>Name</th><th>Desc</th><th>Status</th><th>Uses</th><th>Run</th></tr></thead>
          <tbody>
            {stats.tools.map(t=>(
              <tr key={t.name}>
                <td style={{fontFamily:"var(--mono)", fontSize:13}}>{t.name}</td>
                <td style={{fontSize:13}}>{t.desc}<div className="small muted">{t.full_desc?.slice(0,80)}</div></td>
                <td><span className="badge" style={t.status==="verified"?{background:"var(--accent-soft)"}:null}>{t.status}</span> v{t.version}</td>
                <td>{t.uses}</td>
                <td>
                  <form onSubmit={e=>{e.preventDefault(); run(t.name, new FormData(e.target).get("args"));}} style={{display:"flex", gap:4}}>
                    <input name="args" className="input" placeholder='{"a":2}' style={{width:110, padding:"4px 6px", fontSize:12}}/>
                    <button className="btn" style={{padding:"4px 8px", fontSize:12}}>Run</button>
                  </form>
                </td>
              </tr>
            ))}
            {!stats.tools.length && <tr><td colSpan={5} className="muted">No tools yet — ensure one above.</td></tr>}
          </tbody>
        </table>
        {runRes && <pre style={{marginTop:10, background:"var(--bg-2)", padding:10, borderRadius:8, fontSize:12}}>{JSON.stringify(runRes, null, 2)}</pre>}
      </div>
      <p className="small muted" style={{marginTop:10}}>Persistence: files at <code>backend/tools/custom/*.py</code> + <code>models/tool_registry.yaml</code> — survives restarts. Reuse saves LLM build calls.</p>
    </div>
  );
}
