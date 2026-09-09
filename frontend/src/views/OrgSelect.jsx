import { useEffect,useState } from "react";
import * as api from "../services/api.js";

export function OrgSelect({ orgs, onPick }){
  const [counts,setCounts]=useState({});
  useEffect(()=>{ (async()=>{ const m={}; for(const o of orgs){ try{ const r=await fetch(`${import.meta.env.VITE_API_URL||"https://22ed-2401-9640-1802-d8dc-2-2-2-1.ngrok-free.app"}/docs`,{headers:{"Content-Type":"application/json","X-Org-Id":o.id,"ngrok-skip-browser-warning":"true"},credentials:"include"}).then(x=>x.json()); m[o.id]=r.docs?.length??0;}catch{ } } setCounts(m); })(); },[orgs]);
  if(!orgs.length) return <div className="card" style={{maxWidth:520, margin:"32px auto"}}>No orgs yet. Ask admin to add you.</div>;
  return (
    <div style={{maxWidth:1100, margin:"0 auto", padding:24}}>
      <div className="eyebrow">Select workspace</div>
      <h2>Choose your org</h2>
      <p style={{color:"var(--muted)"}}>One server, isolated data. Pick where you work today.</p>
      <div className="grid grid-3" style={{marginTop:14}}>
        {orgs.map(o=>(
          <div key={o.id} className="card org-card" onClick={()=>onPick(o.id)}>
            <div style={{display:"flex", justifyContent:"space-between"}}><strong>{o.name}</strong><span className="badge">{o.role}</span></div>
            <div style={{fontFamily:"var(--mono)", fontSize:12, color:"var(--muted)"}}>{o.id}</div>
            <div style={{marginTop:10, fontSize:13, color:"var(--muted)"}}>{counts[o.id]!=null?`${counts[o.id]} docs`:"…"} · click to enter →</div>
          </div>
        ))}
      </div>
    </div>
  );
}
