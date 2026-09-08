import { useEffect, useState } from "react";
import * as api from "../services/api.js";
import { GraphCanvas } from "../components/GraphCanvas.jsx";

export function KBView(){
  const [graph,setGraph]=useState({nodes:[],edges:[]});
  const [q,setQ]=useState("");
  const [dept,setDept]=useState("all");
  const [sel,setSel]=useState(null);
  const [chunks,setChunks]=useState([]);
  const [hoverId,setHoverId]=useState(null);
  const [pinned,setPinned]=useState({});
  const [err,setErr]=useState("");

  async function load(){
    try{ setErr(""); setGraph(await api.getGraph()); }
    catch(e){ setErr(e.message); }
  }
  useEffect(()=>{ load(); },[]);

  const depts=["all",...new Set(graph.nodes.map(n=>n.dept))];
  function visible(n){
    if(dept!=="all" && n.dept!==dept) return false;
    if(q && !(n.title.toLowerCase().includes(q.toLowerCase()) || n.tags.some(t=>t.toLowerCase().includes(q.toLowerCase())))) return false;
    return true;
  }
  const visNodes=graph.nodes.filter(visible);
  const visIds=new Set(visNodes.map(n=>n.id));
  const visEdges=graph.edges.filter(e=>visIds.has(e.a)&&visIds.has(e.b));

  async function openDoc(d){
    setSel(d);
    try{
      const r=await fetch(`${import.meta.env.VITE_API_URL||"http://localhost:8000"}/ask`,{method:"POST",headers:{"Content-Type":"application/json","X-Org-Id":api.getOrg()},credentials:"include",body:JSON.stringify({text:d.title, retrieve:true})}).then(x=>x.json());
      setChunks(r.evidence?.filter(e=>e.doc_id===d.id)||[]);
    }catch{ setChunks([]); }
  }
  async function del(id){ if(!confirm("Delete doc "+id+"?")) return; await api.deleteDoc(id); setSel(null); load(); }
  function pin(id,x,y){ setPinned(p=>({...p,[id]:{x,y}})); }

  return (
    <div>
      <div style={{display:"flex", gap:8, alignItems:"center", flexWrap:"wrap"}}>
        <h2 style={{margin:0}}>Knowledge Base</h2>
        <span className="badge">{graph.nodes.length} docs · {graph.edges.length} links</span>
        <span style={{flex:1}}/>
        <input className="input" style={{width:200}} placeholder="search titles, tags…" value={q} onChange={e=>setQ(e.target.value)}/>
        {depts.map(d=> <button key={d} className={`kb-chip${dept===d?" on":""}`} onClick={()=>setDept(d)}>{d}</button>)}
      </div>
      {err && <div className="card" style={{marginTop:12, color:"var(--danger)"}}>{err}</div>}
      {!err && graph.nodes.length===0 && (
        <div className="card" style={{marginTop:14, textAlign:"center", padding:40}}>
          <div style={{width:18,height:18,borderRadius:"50%",border:"1px solid var(--line)",margin:"0 auto 10px"}}/>
          <div>Ingest your first document</div>
          <div className="small muted" style={{marginTop:4}}>It will appear here as a node, linked by shared equipment tags.</div>
        </div>
      )}
      {graph.nodes.length>0 && (
        <div style={{marginTop:12, position:"relative"}}>
          <GraphCanvas nodes={visNodes} edges={visEdges} selectedId={sel?.id} hoverId={hoverId}
            onHover={setHoverId} onSelect={openDoc} pinned={pinned} onPin={pin}/>
          <div className={`drawer${sel?" open":""}`}>
            {!sel && <div style={{padding:16}} className="muted">Select a node.</div>}
            {sel && (<>
              <div className="drawer-head">
                <div><strong>{sel.title}</strong><div className="small muted mono">id {sel.id} · {sel.dept} · {sel.class} · {sel.chunks} chunks</div>
                <div className="small muted mono" style={{marginTop:4}}>{sel.tags.join("  ")||"no equipment tags"}</div></div>
                <button className="btn" onClick={()=>setSel(null)}>×</button>
              </div>
              <div style={{padding:12, display:"grid", gap:8}}>
                {chunks.map((c,i)=>(<div key={i} className="card" style={{padding:10}}><div className="small muted">chunk {i}</div><div style={{whiteSpace:"pre-wrap", fontSize:13}}>{c.content}</div></div>))}
                {!chunks.length && <div className="small muted">No chunks loaded.</div>}
                <button className="btn" style={{color:"var(--risk-critical)"}} onClick={()=>del(sel.id)}>Delete document</button>
              </div>
            </>)}
          </div>
        </div>
      )}
    </div>
  );
}
