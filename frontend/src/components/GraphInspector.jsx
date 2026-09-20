// Right-hand inspector for the knowledge graph. One document, everything the
// graph knows about it: metadata, shared equipment tags, the neighbours it is
// linked to (clickable — walks the graph without leaving the page), and the
// stored chunks. Read-only apart from delete.
import { useMemo } from "react";

const PALETTE_FALLBACK = "#8fa6c8";

function Row({ label, value, mono }) {
  return (
    <div className="kb-insp-row">
      <span className="kb-insp-k">{label}</span>
      <span className={`kb-insp-v${mono ? " mono" : ""}`}>{value}</span>
    </div>
  );
}

export function GraphInspector({
  doc,
  nodes,
  edges,
  colorMap,
  deptColors,
  chunks = [],
  chunksLoading,
  onSelect,
  onClose,
  onDelete,
}) {
  const byId = useMemo(() => Object.fromEntries(nodes.map((n) => [n.id, n])), [nodes]);

  const connections = useMemo(() => {
    if (!doc) return [];
    return edges
      .filter((e) => e.a === doc.id || e.b === doc.id)
      .map((e) => {
        const otherId = e.a === doc.id ? e.b : e.a;
        return { node: byId[otherId], tags: e.tags || [], weight: e.weight || 1 };
      })
      .filter((c) => c.node)
      .sort((a, b) => b.weight - a.weight);
  }, [doc, edges, byId]);

  // The panel is persistent on wide screens, so it teaches the interaction
  // instead of collapsing to nothing; on narrow screens CSS hides it.
  if (!doc) {
    return (
      <aside className="kb-inspector empty" aria-hidden="true">
        <div className="kb-insp-empty">
          <div className="kb-insp-empty-mark" />
          <p className="kb-insp-empty-title">No document selected</p>
          <p className="kb-insp-empty-sub">
            Click a node to see its department, shared equipment tags, linked documents and stored chunks.
          </p>
        </div>
      </aside>
    );
  }

  const deptCol = deptColors?.[doc.dept] || colorMap?.[doc.id] || PALETTE_FALLBACK;

  return (
    <aside className="kb-inspector" aria-label={`Document ${doc.title}`}>
      <header className="kb-insp-head">
        <div className="kb-insp-head-main">
          <span className="kb-dot lg" style={{ background: deptCol }} />
          <div className="kb-insp-title-wrap">
            <h3 className="kb-insp-title" title={doc.title}>{doc.title}</h3>
            <div className="kb-insp-sub mono">doc #{doc.id}</div>
          </div>
        </div>
        <button className="kb-insp-close" onClick={onClose} aria-label="Close inspector">
          <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
            <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" fill="none" />
          </svg>
        </button>
      </header>

      <div className="kb-insp-body">
        <section className="kb-insp-section">
          <div className="kb-insp-grid">
            <Row label="Department" value={doc.dept} />
            <Row label="Class" value={doc.class} />
            <Row label="Chunks" value={doc.chunks} mono />
            <Row label="Links" value={connections.length} mono />
          </div>
        </section>

        <section className="kb-insp-section">
          <div className="kb-insp-label">
            Shared equipment tags <span className="kb-insp-count">{doc.tags?.length || 0}</span>
          </div>
          {doc.tags?.length ? (
            <div className="kb-tag-list">
              {doc.tags.map((t) => (
                <span key={t} className="kb-tag">{t}</span>
              ))}
            </div>
          ) : (
            <p className="kb-insp-none">No equipment tags found in this document.</p>
          )}
        </section>

        <section className="kb-insp-section">
          <div className="kb-insp-label">
            Linked documents <span className="kb-insp-count">{connections.length}</span>
          </div>
          {connections.length ? (
            <div className="kb-conn-list">
              {connections.slice(0, 40).map(({ node, tags, weight }) => (
                <button
                  key={node.id}
                  type="button"
                  className="kb-conn"
                  onClick={() => onSelect?.(node)}
                  title={`Shared: ${tags.join(", ")}`}
                >
                  <span className="kb-dot" style={{ background: colorMap?.[node.id] || PALETTE_FALLBACK }} />
                  <span className="kb-conn-title">{node.title}</span>
                  <span className="kb-conn-meta mono">{weight} tag{weight > 1 ? "s" : ""}</span>
                </button>
              ))}
              {connections.length > 40 && (
                <p className="kb-insp-none">+{connections.length - 40} more</p>
              )}
            </div>
          ) : (
            <p className="kb-insp-none">No shared equipment tags with any other document.</p>
          )}
        </section>

        <section className="kb-insp-section">
          <div className="kb-insp-label">
            Stored chunks <span className="kb-insp-count">{chunksLoading ? "…" : chunks.length}</span>
          </div>
          {chunksLoading && (
            <div className="kb-skel-wrap">
              {[0, 1, 2].map((i) => (
                <div key={i} className="kb-skel" style={{ animationDelay: `${i * 90}ms` }} />
              ))}
            </div>
          )}
          {!chunksLoading && chunks.map((c, i) => (
            <article key={i} className="kb-chunk">
              <div className="kb-chunk-head mono">chunk {i}</div>
              <p className="kb-chunk-text">{c.content}</p>
            </article>
          ))}
          {!chunksLoading && !chunks.length && (
            <p className="kb-insp-none">No chunks retrieved for this document.</p>
          )}
        </section>
      </div>

      <footer className="kb-insp-foot">
        <button className="kb-danger" onClick={() => onDelete?.(doc)}>
          <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
            <path d="M3 5h10M6.5 5V3.5h3V5M4.5 5l.7 8h5.6l.7-8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" fill="none" />
          </svg>
          Delete document
        </button>
      </footer>
    </aside>
  );
}
