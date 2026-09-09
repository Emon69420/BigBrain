import { useEffect, useState } from "react";
import * as api from "../services/api.js";

const STALE_HOURS = 24;

function ago(ts){
  if(!ts) return "never";
  const s=Math.floor((Date.now()-new Date(ts).getTime())/1000);
  if(s<0) return "just now";
  if(s<60) return "just now";
  if(s<3600) return `${Math.floor(s/60)}m ago`;
  if(s<86400) return `${Math.floor(s/3600)}h ago`;
  return `${Math.floor(s/86400)}d ago`;
}

function isStale(ts){
  if(!ts) return false;
  return (Date.now()-new Date(ts).getTime()) > STALE_HOURS*3600*1000;
}

function Spark({ points }){
  const vals=(points||[]).map(p=>p.value_num).filter(v=>v!==null&&v!==undefined);
  if(vals.length<2) return <span className="small muted">not enough history</span>;
  const w=120,h=36,min=Math.min(...vals),max=Math.max(...vals),rg=(max-min)||1;
  const pts=vals.map((v,i)=>`${(i/(vals.length-1)*w).toFixed(1)},${(h-3-((v-min)/rg)*(h-6)).toFixed(1)}`).join(" ");
  return <svg width={w} height={h} aria-label="trend"><polyline points={pts} fill="none" stroke="var(--accent)" strokeWidth="1.5"/></svg>;
}

function BoardDetail({ id, onBack, embedded }){
  const [b,setB]=useState(null);
  const [hist,setHist]=useState({});
  const [msg,setMsg]=useState("");
  async function load(){
    try{
      const d=await api.getBoard(id);
      setB(d); setMsg("");
      const h={};
      for(const m of (d.metrics||[])){
        try{ const r=await api.getBoardHistory(id,m.key,30); h[m.key]=r.readings||[]; }
        catch{ h[m.key]=[]; }
      }
      setHist(h);
    }catch(e){ setMsg(e.message); }
  }
  useEffect(()=>{ load(); },[id]);
  async function save(e){
    e.preventDefault();
    const fd=new FormData(e.target);
    const values=(b.metrics||[]).map(m=>({metric_key:m.key, value:String(fd.get(m.key)??"").trim()})).filter(v=>v.value!=="");
    if(!values.length){ setMsg("Enter at least one value."); return; }
    try{
      const r=await api.submitReadings(id,values);
      setMsg(`Saved ${r.saved} reading(s).`);
      e.target.reset(); load();
    }catch(ex){ setMsg(ex.message); }
  }
  async function finalize(){
    try{ await api.finalizeBoard(id); setMsg("Board is live."); load(); }
    catch(e){ setMsg(e.message); }
  }
  if(!b) return <div>Loading board…{msg && <p className="small muted">{msg}</p>}</div>;
  const live = b.status==="live";
  return (
    <div>
      {!embedded && <button className="btn" style={{padding:"2px 10px", marginBottom:10}} onClick={onBack}>← All boards</button>}
      <h2 style={{margin:"0 0 4px"}}>{b.name}</h2>
      <p className="small muted" style={{margin:"0 0 12px"}}>
        {b.zone && <span className="badge" style={{marginRight:6}}>{b.zone}</span>}
        <span className="badge" style={live?null:{borderColor:"var(--accent)"}}>{b.status}</span>
      </p>
      {!live && (
        <div className="card" style={{marginBottom:12}}>
          <div className="small">Draft — reshape it in chat ("add …", "remove …"), then go live.</div>
          {!embedded && <div style={{marginTop:8}}><button className="btn btn-primary" onClick={finalize}>Finalize — make it live</button></div>}
        </div>
      )}
      <div style={{display:"grid", gap:10, gridTemplateColumns:"repeat(auto-fill,minmax(240px,1fr))"}}>
        {(b.latest||b.metrics.map(m=>({...m, value_text:null, recorded_at:null}))).map(m=>(
          <div key={m.key} className="card">
            <div className="small muted">{m.label}{m.unit?` (${m.unit})`:""}</div>
            <div style={{fontSize:26, fontWeight:700, margin:"4px 0"}}>
              {m.recorded_at ? <>{m.value_text}<span style={{fontSize:13, fontWeight:400}}>{m.unit?` ${m.unit}`:""}</span></> : <span className="muted">—</span>}
            </div>
            <div className="small">
              {m.recorded_at ? (
                <span style={isStale(m.recorded_at)?{color:"var(--danger)"}:null} className={isStale(m.recorded_at)?"": "muted"}>
                  updated {ago(m.recorded_at)}{isStale(m.recorded_at)?" · stale":""}
                </span>
              ) : <span className="muted">no readings yet</span>}
            </div>
            <div style={{marginTop:6}}><Spark points={hist[m.key]}/></div>
          </div>
        ))}
      </div>
      <div className="card" style={{marginTop:12}}>
        <h3 style={{margin:"0 0 8px"}}>{live ? "Update readings" : "Entry preview"}</h3>
        {!live && <p className="small muted" style={{margin:"0 0 8px"}}>These are the exact fields staff will fill — unlocked on finalize.</p>}
        <form onSubmit={save} style={{display:"grid", gap:8, maxWidth:420}}>
          {(b.metrics||[]).map(m=>(
            <label key={m.key} className="small">
              {m.label}{m.unit?` (${m.unit})`:""}
              <input name={m.key} className="input" style={{marginTop:4}}
                type={m.kind==="number"?"number":"text"} step="any"
                disabled={!live || embedded}
                placeholder={m.kind==="number"?"e.g. 4.2":"e.g. normal"}/>
            </label>
          ))}
          {live && !embedded && <div><button className="btn btn-primary" type="submit">Save readings</button></div>}
        </form>
      </div>
      {msg && <p className="small muted">{msg}</p>}
    </div>
  );
}

// Slim read-only embed for the chat preview drawer. One edit path lives
// on the Boards page; the drawer shows shape + values only.
export function BoardPreview({ id }){
  return <BoardDetail id={id} embedded/>;
}

export function BoardsView({ onBuild }){
  const [boards,setBoards]=useState(null);
  const [sel,setSel]=useState(null);
  const [msg,setMsg]=useState("");
  async function load(){
    try{ const r=await api.listBoards(); setBoards(r.dashboards||[]); setMsg(""); }
    catch(e){ setMsg(e.message); }
  }
  useEffect(()=>{ load(); },[]);
  if(sel) return <BoardDetail id={sel} onBack={()=>{ setSel(null); load(); }}/>;
  return (
    <div>
      <div className="boards-header">
        <h2 className="boards-title">Boards</h2>
        <button className="boards-create" onClick={()=>onBuild("Create a dashboard for Zone C tracking ")}>+ Create</button>
      </div>
      <p className="boards-subtitle">Live zone and general boards. Create starts a chat — describe metrics, iterate, finalize. Staff fill values from each board.</p>
      {!boards && <div>Loading boards…{msg && <p className="small muted">{msg}</p>}</div>}
      {boards && !boards.length && <div className="card small muted">No boards yet — press + Create and describe what to track.</div>}
      {boards && !!boards.length && (
        <div className="boards-grid">
          {boards.map(b=>(
            <div key={b.id} className="board-card" onClick={()=>setSel(b.id)}>
              <div className="board-card-head">
                <div className="board-card-title">{b.name}</div>
                <span className="board-card-menu">···</span>
              </div>
              <div className="board-card-tags">
                {b.zone && <span className="board-tag">{b.zone}</span>}
                <span className={`board-tag ${b.status==="draft" ? "draft" : b.status==="live" ? "live" : ""}`}>{b.status}</span>
                <span className="board-tag">{(b.metrics||[]).length} metrics</span>
              </div>
              <div className="board-updated">updated {ago(b.updated_at)}</div>
            </div>
          ))}
        </div>
      )}
      {msg && <p className="small muted">{msg}</p>}
    </div>
  );
}
