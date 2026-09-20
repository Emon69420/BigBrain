import { useEffect, useId, useMemo, useState } from "react";
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

function fmt(v, digits=2){
  const n = Number(v);
  if(!Number.isFinite(n)) return String(v);
  return n.toLocaleString(undefined,{maximumFractionDigits:digits});
}

// Area trend with a gradient fill — reads as a shape, not a squiggle.
function Trend({ points, id }){
  const vals=(points||[]).map(p=>p.value_num).filter(v=>v!==null&&v!==undefined);
  if(vals.length<2) return <div className="bd-trend-empty">no history yet</div>;
  const w=240,h=48,pad=4;
  const min=Math.min(...vals),max=Math.max(...vals),rg=(max-min)||1;
  const x=i=>(i/(vals.length-1))*w;
  const y=v=>h-pad-((v-min)/rg)*(h-pad*2);
  const pts=vals.map((v,i)=>`${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const area=`M0,${h} L${vals.map((v,i)=>`${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" L")} L${w},${h} Z`;
  const lastX=x(vals.length-1), lastY=y(vals[vals.length-1]);
  return (
    <svg className="bd-trend" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-label="Trend of recent readings">
      <defs>
        <linearGradient id={`bd-grad-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.28"/>
          <stop offset="100%" stopColor="var(--accent)" stopOpacity="0"/>
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#bd-grad-${id})`} stroke="none"/>
      <polyline points={pts} fill="none" stroke="var(--accent)" strokeWidth="1.6" vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round"/>
      <circle cx={lastX} cy={lastY} r="2.6" fill="var(--accent)"/>
    </svg>
  );
}

function Delta({ readings }){
  const vals=(readings||[]).map(r=>r.value_num).filter(v=>v!==null&&v!==undefined);
  if(vals.length<2) return null;
  const d=vals[vals.length-1]-vals[vals.length-2];
  if(!Number.isFinite(d) || d===0) return <span className="bd-delta flat">no change</span>;
  return (
    <span className="bd-delta">
      {d>0?"▲":"▼"} {fmt(Math.abs(d))}
    </span>
  );
}

function MetricTile({ m, readings, uid }){
  const stale=m.recorded_at ? isStale(m.recorded_at) : false;
  const has=m.recorded_at!=null;
  return (
    <div className={`bd-tile${stale?" stale":""}`}>
      <div className="bd-tile-head">
        <span className="bd-tile-label">{m.label}</span>
        {m.unit && <span className="bd-tile-unit">{m.unit}</span>}
      </div>
      <div className="bd-tile-value">
        {has ? <>{fmt(m.value_text)}</> : <span className="bd-none">—</span>}
        {has && <Delta readings={readings}/>}
      </div>
      <div className="bd-tile-foot">
        {has ? (
          <span className={stale?"bd-stale-tag":"bd-tile-time"}>
            {stale && <span className="bd-warn-dot"/>}
            {stale ? `stale · ${ago(m.recorded_at)}` : `updated ${ago(m.recorded_at)}`}
          </span>
        ) : <span className="bd-tile-time">no readings yet</span>}
      </div>
      <Trend points={readings} id={uid}/>
    </div>
  );
}

function BoardDetail({ id, onBack, embedded }){
  const [b,setB]=useState(null);
  const [hist,setHist]=useState({});
  const [msg,setMsg]=useState("");
  const [msgKind,setMsgKind]=useState("info");
  const uid=useId().replace(/[^a-zA-Z0-9]/g,"");
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
    }catch(e){ setMsg(e.message); setMsgKind("error"); }
  }
  useEffect(()=>{ load(); },[id]);
  async function save(e){
    e.preventDefault();
    const fd=new FormData(e.target);
    const values=(b.metrics||[]).map(m=>({metric_key:m.key, value:String(fd.get(m.key)??"").trim()})).filter(v=>v.value!=="");
    if(!values.length){ setMsg("Enter at least one value."); setMsgKind("error"); return; }
    try{
      const r=await api.submitReadings(id,values);
      setMsgKind("ok"); setMsg(`Saved ${r.saved} reading(s).`);
      e.target.reset(); load();
    }catch(ex){ setMsgKind("error"); setMsg(ex.message); }
  }
  async function finalize(){
    try{ await api.finalizeBoard(id); setMsgKind("ok"); setMsg("Board is live."); load(); }
    catch(e){ setMsgKind("error"); setMsg(e.message); }
  }
  if(!b) return <div className="small muted">Loading board…{msg && <p>{msg}</p>}</div>;
  const live = b.status==="live";
  const metrics = b.latest || (b.metrics||[]).map(m=>({...m, value_text:null, recorded_at:null}));
  const filled = metrics.filter(m=>m.recorded_at).length;

  return (
    <div className="bd-page">
      {!embedded && (
        <button className="bd-back" onClick={onBack}>
          <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true">
            <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none"/>
          </svg>
          All boards
        </button>
      )}

      <header className="bd-head">
        <div className="bd-head-main">
          <h2 className="bd-title">{b.name}</h2>
          <div className="bd-head-meta">
            {b.zone && <span className="board-tag">{b.zone}</span>}
            <span className={`board-tag ${live?"live":"draft"}`}>
              <span className={`bd-status-dot${live?" live":""}`}/>
              {b.status}
            </span>
            <span className="bd-head-count mono">{filled}/{metrics.length} filled</span>
            {b.updated_at && <span className="bd-head-time">updated {ago(b.updated_at)}</span>}
          </div>
        </div>
      </header>

      {!live && (
        <div className="bd-notice">
          <div>
            <div className="bd-notice-title">Draft board</div>
            <div className="bd-notice-sub">
              Reshape it in chat ("add …", "remove …"), then go live. Fields below are the exact ones staff will fill.
            </div>
          </div>
          {!embedded && <button className="btn btn-primary" onClick={finalize}>Finalize — make it live</button>}
        </div>
      )}

      <div className="bd-grid">
        {metrics.map(m=>(
          <MetricTile key={m.key} m={m} readings={hist[m.key]} uid={`${uid}-${m.key}`}/>
        ))}
      </div>

      <div className="bd-form-card">
        <div className="bd-form-head">
          <h3>{live ? "Update readings" : "Entry preview"}</h3>
          {!live && <span className="small muted">unlocked on finalize</span>}
        </div>
        <form onSubmit={save} className="bd-form">
          {(b.metrics||[]).map(m=>(
            <label key={m.key} className="bd-field">
              <span className="bd-field-label">{m.label}{m.unit?` (${m.unit})`:""}</span>
              <input name={m.key} className="input"
                type={m.kind==="number"?"number":"text"} step="any"
                disabled={!live || embedded}
                placeholder={m.kind==="number"?"e.g. 4.2":"e.g. normal"}/>
            </label>
          ))}
          {live && !embedded && (
            <div className="bd-form-actions">
              <button className="btn btn-primary" type="submit">Save readings</button>
            </div>
          )}
        </form>
        {msg && <p className={`bd-msg ${msgKind}`}>{msg}</p>}
      </div>
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
  const [q,setQ]=useState("");
  const [status,setStatus]=useState("all");

  async function load(){
    try{ const r=await api.listBoards(); setBoards(r.dashboards||[]); setMsg(""); }
    catch(e){ setMsg(e.message); }
  }
  useEffect(()=>{ load(); },[]);

  const counts=useMemo(()=>{
    const c={all:0,live:0,draft:0};
    for(const b of boards||[]) { c.all++; if(c[b.status]!=null) c[b.status]++; }
    return c;
  },[boards]);

  const shown=useMemo(()=>{
    const needle=q.trim().toLowerCase();
    return (boards||[]).filter(b=>{
      if(status!=="all" && b.status!==status) return false;
      if(needle && !(b.name||"").toLowerCase().includes(needle) && !(b.zone||"").toLowerCase().includes(needle)) return false;
      return true;
    });
  },[boards,q,status]);

  if(sel) return <BoardDetail id={sel} onBack={()=>{ setSel(null); load(); }}/>;

  return (
    <div className="boards-page">
      <div className="boards-header">
        <div>
          <h2 className="boards-title">Boards</h2>
          <p className="boards-subtitle">
            Live zone and general boards. Create starts a chat — describe metrics, iterate, finalize.
          </p>
        </div>
        <button className="boards-create" onClick={()=>onBuild("Create a dashboard for Zone C tracking ")}>
          <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true">
            <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" fill="none"/>
          </svg>
          Create
        </button>
      </div>

      {boards && boards.length>0 && (
        <div className="boards-toolbar">
          <div className="kb-chip-group" role="group" aria-label="Filter boards by status">
            {["all","live","draft"].map(s=>(
              <button key={s} type="button"
                className={`kb-chip${status===s?" on":""}`}
                onClick={()=>setStatus(s)}
                disabled={s!=="all" && !counts[s]}>
                {s}
                <span className="kb-chip-n">{counts[s]}</span>
              </button>
            ))}
          </div>
          <span className="kb-filter-gap"/>
          <div className="kb-search boards-search">
            <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
              <circle cx="7" cy="7" r="4.2" stroke="currentColor" strokeWidth="1.4" fill="none"/>
              <path d="M10.2 10.2 14 14" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" fill="none"/>
            </svg>
            <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search boards…" aria-label="Search boards"/>
          </div>
        </div>
      )}

      {!boards && (
        <div className="boards-grid">
          {[0,1,2].map(i=> <div key={i} className="board-card skeleton" style={{animationDelay:`${i*90}ms`}}/>)}
        </div>
      )}

      {boards && !boards.length && (
        <div className="card board-empty">
          <div className="board-empty-mark"/>
          <div>No boards yet</div>
          <div className="small muted" style={{marginTop:4}}>
            Press Create and describe what to track — e.g. "Zone C pressure and temperature, twice a day".
          </div>
          <button className="btn btn-primary" style={{marginTop:14}} onClick={()=>onBuild("Create a dashboard for Zone C tracking ")}>
            Create your first board
          </button>
        </div>
      )}

      {boards && !!shown.length && (
        <div className="boards-grid">
          {shown.map(b=>(
            <button key={b.id} type="button" className="board-card" onClick={()=>setSel(b.id)}>
              <div className="board-card-head">
                <div className="board-card-title">{b.name}</div>
                <span className={`bd-status-dot${b.status==="live"?" live":""}`} title={b.status}/>
              </div>
              <div className="board-card-tags">
                {b.zone && <span className="board-tag">{b.zone}</span>}
                <span className={`board-tag ${b.status==="draft" ? "draft" : b.status==="live" ? "live" : ""}`}>{b.status}</span>
                <span className="board-tag">{(b.metrics||[]).length} metrics</span>
              </div>
              {(b.metrics||[]).length>0 && (
                <div className="board-card-metrics">
                  {(b.metrics||[]).slice(0,3).map(m=>(
                    <span key={m.key} className="board-card-metric">
                      {m.label}{m.unit?<em> {m.unit}</em>:null}
                    </span>
                  ))}
                  {(b.metrics||[]).length>3 && (
                    <span className="board-card-metric more">+{(b.metrics||[]).length-3}</span>
                  )}
                </div>
              )}
              <div className="board-card-foot">
                <span className="board-updated">updated {ago(b.updated_at)}</span>
                <span className="board-card-open">
                  Open
                  <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
                    <path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none"/>
                  </svg>
                </span>
              </div>
            </button>
          ))}
        </div>
      )}

      {boards && boards.length>0 && !shown.length && (
        <div className="card board-empty">
          <div>No boards match this filter.</div>
          <button className="btn" style={{marginTop:12}} onClick={()=>{setQ("");setStatus("all");}}>Clear filters</button>
        </div>
      )}

      {msg && <p className="small muted">{msg}</p>}
    </div>
  );
}
