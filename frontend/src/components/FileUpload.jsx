// Reusable file upload UI. No API calls directly — uses onUpload prop.
export function FileUpload({ onFile, uploading }) {
  async function handle(e) {
    const file = e.target.files?.[0];
    if (file) await onFile(file);
    e.target.value = "";
  }
  return (
    <label style={{ display: "inline-block", border: "1px dashed #888", padding: 12, cursor: "pointer" }}>
      <input type="file" accept=".txt,.md,.csv" onChange={handle} disabled={uploading} hidden />
      {uploading ? "Uploading..." : "Click to upload .txt / .md / .csv"}
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
    <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 8, maxWidth: 480 }}>
      <input name="title" placeholder="Title (e.g. SOP-17)" />
      <textarea name="content" rows={4} placeholder="Paste document text here..." />
      <button disabled={uploading}>{uploading ? "..." : "Ingest text"}</button>
    </form>
  );
}
