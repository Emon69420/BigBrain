import { useEffect,useState } from "react";
import * as api from "../services/api.js";

export function KBView(){
  const [docs,setDocs]=useState([]);
  const [sel,setSel]=useState(null);
  const [chunks,setChunks]=useState([]);
  async function load(){ setDocs((await api.listDocs()).docs||[]); }
  useEffect(()=>{ load(); },[]);
  async function openDoc(d){
    setSel(d);
    // fetch chunks via raw query — add endpoint later, for now show stub
    // we reuse list + peek: call vector search with doc title as query to get its chunks
    try{
      const r=await fetch(`${import.meta.env.VITE_API_URL||"http://localhost:8000"}/ask`,{method:"POST",headers:{"Content-Type":"application/json","X-Org-Id":api.getOrg()},credentials:"include",body:JSON.stringify({text:d.title, retrieve:true})}).then(x=>x.json());
      setChunks(r.evidence?.filter(e=>e.doc_id===d.id)||[]);
    }catch{ setChunks([]); }
  }
  async function del(id){ if(!confirm("Delete doc "+id+"?")) return; await api.deleteDoc(id); load(); setSel(null); }
  return (
    <div>
      <div style={{display:"flex", justifyContent:"space-between", alignItems:"center"}}>
        <h2 style={{margin:0}}>Knowledge Base</h2><span className="badge">{docs.length} docs</span>
      </div>
      <div className="grid grid-2" style={{marginTop:14}}>
        <div>
          <table className="table">
            <thead><tr><th>Title</th><th>Dept</th><th></th></tr></thead>
            <tbody>
              {docs.map(d=>(
                <tr key={d.id} style={{cursor:"pointer", background: sel?.id===d.id?"var(--accent-soft)":""}} onClick={()=>openDoc(d)}>
                  <td>{d.title}</td><td style={{color:"var(--muted)"}}>{d.dept}</td><td><button className="btn" style={{padding:"4px 8px", fontSize:12}} onClick={e=>{e.stopPropagation(); del(d.id);}}>Delete</button></td>
                </tr>
              ))}
              {!docs.length && <tr><td colSpan={3} style={{color:"var(--muted)"}}>No docs in this org. Use Ingest.</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="card" style={{minHeight:200}}>
          {!sel && <div style={{color:"var(--muted)"}}>Select a doc to see its chunks.</div>}
          {sel && (<><strong>{sel.title}</strong> <span className="badge">id {sel.id}</span>
            <div style={{marginTop:8, display:"grid", gap:8}}>
              {chunks.map((c,i)=>(<div key={i} className="card" style={{padding:10, background:"#fafaf7"}}><div style={{fontSize:12, color:"var(--muted)"}}>chunk {i} {c.distance!=null&&`· dist ${c.distance.toFixed(3)}`}</div><div style={{whiteSpace:"pre-wrap", fontSize:13}}>{c.content}</div></div>))}
              {!chunks.length && <div style={{color:"var(--muted)", fontSize:13}}>No chunks yet (vector may be null — re-ingest after warmup).</div>}
            </div></>)}
        </div>
      </div>
    </div>
  );
}
