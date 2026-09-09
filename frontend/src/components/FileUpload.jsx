// Reusable file upload UI. No API calls directly — uses onUpload prop.
export function FileUpload({ onFile, uploading }) {
  async function handle(e) {
    const file = e.target.files?.[0];
    if (file) await onFile(file);
    e.target.value = "";
  }
  return (
    <label className="ingest-drop" style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:8, cursor:"pointer", opacity: uploading? .6:1 }}>
      <input type="file" accept=".txt,.md,.csv" onChange={handle} disabled={uploading} hidden />
      <span style={{width:36,height:36,borderRadius:999,background:"#fff",color:"#08090C",display:"grid",placeItems:"center",fontSize:16}}>↑</span>
      <span style={{fontSize:13,fontWeight:650,color:"#fff"}}>{uploading ? "Uploading..." : "Click to upload .txt / .md / .csv"}</span>
      <span style={{fontSize:11,color:"#9AA0B0"}}>Drag & drop or browse · only .txt/.md/.csv</span>
    </label>
  );
}

// Simple text paste ingest.
export function TextIngest({ onIngest, uploading }) {
  function submit(e) {
    e.preventDefault();
    const fd = new FormData(e.target);
    const title = fd.get("title") || "pasted-doc";
    const content = fd.get("content") || "";
    if (content.trim()) onIngest(title, content);
    e.target.reset();
  }
  return (
    <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 10, width:"100%" }}>
      <input className="input" name="title" placeholder="Title (e.g. SOP-17)" style={{background:"rgba(255,255,255,.06)", borderColor:"rgba(255,255,255,.08)"}} />
      <textarea className="textarea" name="content" rows={5} placeholder="Paste document text here..." style={{background:"rgba(255,255,255,.06)", borderColor:"rgba(255,255,255,.08)", minHeight:140}} />
      <button className="btn" style={{background:"transparent", color:"#fff", border:"1px solid #fff", borderRadius:999, padding:"10px 16px", fontWeight:700, alignSelf:"flex-start", boxShadow:"none"}} disabled={uploading}>{uploading ? "Ingesting..." : "Ingest text →"}</button>
    </form>
  );
}
