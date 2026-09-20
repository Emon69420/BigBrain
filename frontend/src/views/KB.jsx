import { useEffect, useMemo, useRef, useState } from "react";
import * as api from "../services/api.js";
import { GraphCanvas } from "../components/GraphCanvas.jsx";
import { GraphInspector } from "../components/GraphInspector.jsx";

// Stable category palette. Colors identify departments, not risk or status —
// the risk palette stays reserved for safety state (design.md §8).
const DEPT_PALETTE = ["#60a5fa", "#2dd4bf", "#a78bfa", "#f472b6", "#fbbf24", "#34d399", "#fb7185", "#38bdf8", "#c084fc", "#94a3b8"];

export function KBView() {
  const [graph, setGraph] = useState({ nodes: [], edges: [] });
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [dept, setDept] = useState("all");
  const [cls, setCls] = useState("all");
  const [isolate, setIsolate] = useState(false);
  const [sel, setSel] = useState(null);
  const [chunks, setChunks] = useState([]);
  const [chunksLoading, setChunksLoading] = useState(false);
  const [pinned, setPinned] = useState({});
  const [err, setErr] = useState("");
  const chunkReq = useRef(0);

  async function load() {
    try {
      setErr("");
      setGraph(await api.getGraph());
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, []);

  // Colors are derived from the FULL graph (departments sorted), so filtering,
  // isolating and searching never recolor a node — the legend always matches.
  const deptColors = useMemo(() => {
    const ds = [...new Set(graph.nodes.map((n) => n.dept || "other"))].sort();
    const m = {};
    ds.forEach((d, i) => { m[d] = DEPT_PALETTE[i % DEPT_PALETTE.length]; });
    return m;
  }, [graph.nodes]);

  const colorMap = useMemo(
    () => Object.fromEntries(graph.nodes.map((n) => [n.id, deptColors[n.dept || "other"]])),
    [graph.nodes, deptColors]
  );

  const deptCounts = useMemo(() => {
    const m = {};
    for (const n of graph.nodes) m[n.dept || "other"] = (m[n.dept || "other"] || 0) + 1;
    return m;
  }, [graph.nodes]);

  const depts = useMemo(() => ["all", ...Object.keys(deptCounts)], [deptCounts]);
  const classes = useMemo(
    () => ["all", ...[...new Set(graph.nodes.map((n) => n.class).filter(Boolean))].sort()],
    [graph.nodes]
  );

  const needle = q.trim().toLowerCase();
  const filtering = needle !== "" || dept !== "all" || cls !== "all";

  // matchIds drives dimming. Filtering dims instead of removing, so the shape
  // of the whole knowledge base stays visible while you narrow focus (§8).
  const matchIds = useMemo(() => {
    if (!filtering) return null;
    const s = new Set();
    for (const n of graph.nodes) {
      if (dept !== "all" && (n.dept || "other") !== dept) continue;
      if (cls !== "all" && n.class !== cls) continue;
      if (needle && !(n.title || "").toLowerCase().includes(needle)
        && !(n.tags || []).some((t) => t.toLowerCase().includes(needle))) continue;
      s.add(n.id);
    }
    return s;
  }, [graph.nodes, dept, cls, needle, filtering]);

  const hardFilter = isolate && matchIds;
  const visNodes = useMemo(
    () => (hardFilter ? graph.nodes.filter((n) => matchIds.has(n.id)) : graph.nodes),
    [graph.nodes, hardFilter, matchIds]
  );
  const visEdges = useMemo(
    () => (hardFilter ? graph.edges.filter((e) => matchIds.has(e.a) && matchIds.has(e.b)) : graph.edges),
    [graph.edges, hardFilter, matchIds]
  );

  // Selection must survive a reload: keep the freshest copy of the doc.
  const selDoc = useMemo(
    () => (sel ? graph.nodes.find((n) => n.id === sel.id) || sel : null),
    [sel, graph.nodes]
  );

  async function openDoc(d) {
    if (!d) { setSel(null); return; }
    setSel(d);
    setChunks([]);
    setChunksLoading(true);
    const token = ++chunkReq.current;
    try {
      const r = await api.retrieveForDoc(d.title);
      if (token !== chunkReq.current) return; // a newer selection won
      setChunks((r.evidence || []).filter((e) => String(e.doc_id) === String(d.id)));
    } catch {
      if (token === chunkReq.current) setChunks([]);
    } finally {
      if (token === chunkReq.current) setChunksLoading(false);
    }
  }

  async function del(id) {
    if (!confirm(`Delete document #${id}?`)) return;
    await api.deleteDoc(id);
    setSel(null);
    setPinned((p) => { const n = { ...p }; delete n[id]; return n; });
    load();
  }

  function pin(id, x, y) {
    setPinned((p) => {
      const n = { ...p };
      if (x == null || y == null) delete n[id];
      else n[id] = { x, y };
      return n;
    });
  }

  const matched = matchIds ? matchIds.size : graph.nodes.length;

  return (
    <div className="kb-page">
      <header className="kb-header">
        <div className="kb-head-row">
          <div className="kb-head-title">
            <h2>Knowledge Base</h2>
            <p>Documents as nodes, shared equipment tags as links. Hover to trace a link, click to inspect.</p>
          </div>

          <div className="kb-search">
            <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
              <circle cx="7" cy="7" r="4.2" stroke="currentColor" strokeWidth="1.4" fill="none" />
              <path d="M10.2 10.2 14 14" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" fill="none" />
            </svg>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search titles or equipment tags…"
              aria-label="Search documents"
            />
            {q && (
              <button type="button" className="kb-search-clear" onClick={() => setQ("")} aria-label="Clear search">
                <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
                  <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none" />
                </svg>
              </button>
            )}
          </div>
        </div>

        <div className="kb-filters">
          <div className="kb-chip-group" role="group" aria-label="Filter by department">
            {depts.map((d) => (
              <button
                key={d}
                type="button"
                className={`kb-chip${dept === d ? " on" : ""}`}
                onClick={() => setDept(d)}
              >
                {d !== "all" && <span className="kb-dot" style={{ background: deptColors[d] }} />}
                {d}
                {d !== "all" && <span className="kb-chip-n">{deptCounts[d]}</span>}
              </button>
            ))}
          </div>

          {classes.length > 2 && (
            <>
              <span className="kb-filter-sep" />
              <div className="kb-chip-group" role="group" aria-label="Filter by classification">
                {classes.map((c) => (
                  <button
                    key={c}
                    type="button"
                    className={`kb-chip quiet${cls === c ? " on" : ""}`}
                    onClick={() => setCls(c)}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </>
          )}

          <span className="kb-filter-gap" />

          {filtering && (
            <span className="kb-match-note">
              <strong>{matched}</strong> of {graph.nodes.length} match
            </span>
          )}
          <label className={`kb-switch${isolate ? " on" : ""}`} title="Hide non-matching nodes instead of dimming them">
            <input type="checkbox" checked={isolate} onChange={(e) => setIsolate(e.target.checked)} disabled={!filtering} />
            <span className="kb-switch-track"><span className="kb-switch-thumb" /></span>
            isolate
          </label>
          {filtering && (
            <button className="kb-btn-quiet" onClick={() => { setQ(""); setDept("all"); setCls("all"); setIsolate(false); }}>
              Clear
            </button>
          )}
          <button className="kb-btn-quiet" onClick={load} title="Reload the graph from the server">
            <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
              <path d="M13 8a5 5 0 1 1-1.6-3.7M13 2.5V6h-3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" fill="none" />
            </svg>
            Refresh
          </button>
        </div>
      </header>

      {err && <div className="card" style={{ color: "var(--danger)" }}>{err}</div>}

      {loading && !graph.nodes.length && (
        <div className="kb-skeleton" aria-label="Loading graph">
          <div className="kb-skeleton-canvas" />
        </div>
      )}

      {!loading && !err && !graph.nodes.length && (
        <div className="card kb-empty">
          <div className="kb-empty-mark" />
          <div>Ingest your first document</div>
          <div className="small muted" style={{ marginTop: 4 }}>
            It will appear here as a node, linked to others by shared equipment tags.
          </div>
        </div>
      )}

      {graph.nodes.length > 0 && (
        <div className={`kb-body${selDoc ? " has-sel" : ""}`}>
          <div className="kb-graph-wrap">
            <GraphCanvas
              nodes={visNodes}
              edges={visEdges}
              selectedId={selDoc?.id}
              matchIds={isolate ? null : matchIds}
              colorMap={colorMap}
              deptColors={deptColors}
              activeDept={dept}
              deptCounts={deptCounts}
              pinned={pinned}
              onSelect={openDoc}
              onPin={pin}
              onDeptClick={(d) => setDept((cur) => (cur === d ? "all" : d))}
              onUnpinAll={() => setPinned({})}
            />
          </div>
          <GraphInspector
            doc={selDoc}
            nodes={graph.nodes}
            edges={graph.edges}
            colorMap={colorMap}
            deptColors={deptColors}
            chunks={chunks}
            chunksLoading={chunksLoading}
            onSelect={openDoc}
            onClose={() => setSel(null)}
            onDelete={(d) => del(d.id)}
          />
        </div>
      )}
    </div>
  );
}
