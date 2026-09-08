// KB graph canvas — d3-force layout, hand-rolled SVG per design.md §8.
// Nodes sized by chunk count, colored by dept (muted categorical, never risk colors).
// Edges = shared equipment tags, thickness by count. Hover dims rest, click opens drawer.
import { useEffect, useMemo, useRef, useState } from "react";

import { forceSimulation, forceManyBody, forceCenter, forceLink, forceCollide } from "d3-force";

const DEPT_COLORS = {
  operations: "#7d8aa5",
  engineering: "#a89c8c",
  safety: "#8f7fb8",
};
function deptColor(dept) {
  return DEPT_COLORS[(dept || "").toLowerCase()] || "#7d8aa5";
}

export function GraphCanvas({ nodes, edges, selectedId, hoverId, onHover, onSelect, pinned, onPin }) {
  const ref = useRef(null);
  const [pos, setPos] = useState({});
  const [size, setSize] = useState({ w: 800, h: 520 });

  const simNodes = useMemo(() => nodes.map((n) => ({ ...n, r: 14 + Math.min(22, (n.chunks || 0) * 4) })), [nodes]);
  const simLinks = useMemo(() => edges.map((e) => ({ source: e.a, target: e.b, weight: e.weight, tags: e.tags })), [edges]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const wb = new ResizeObserver(() => setSize({ w: el.clientWidth || 800, h: el.clientHeight || 520 }));
    wb.observe(el);
    return () => wb.disconnect();
  }, []);

  useEffect(() => {
    if (!simNodes.length) return;
    const sim = forceSimulation(simNodes)
      .force("charge", forceManyBody().strength(-260))
      .force("center", forceCenter(size.w / 2, size.h / 2))
      .force("collide", forceCollide().radius((d) => d.r + 26))
      .force("link", forceLink(simLinks).id((d) => d.id).distance(130).strength(0.4));
    // respect pinned positions
    simNodes.forEach((n) => {
      if (pinned[n.id]) { n.fx = pinned[n.id].x; n.fy = pinned[n.id].y; }
      else { n.fx = null; n.fy = null; }
    });
    sim.on("tick", () => {
      const p = {};
      simNodes.forEach((n) => { p[n.id] = { x: n.x, y: n.y }; });
      setPos({ ...p });
    });
    const stop = setTimeout(() => sim.stop(), 4000);
    return () => { clearTimeout(stop); sim.stop(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [simNodes, simLinks, size.w, size.h]);

  const draggedRef = useRef(false);
  function dragNode(id, startEv, svg) {
    const node = simNodes.find((n) => n.id === id);
    const sx = startEv.clientX, sy = startEv.clientY;
    draggedRef.current = false;
    const move = (ev) => {
      if (Math.abs(ev.clientX - sx) + Math.abs(ev.clientY - sy) > 4) draggedRef.current = true;
      const r = svg.getBoundingClientRect();
      const x = ev.clientX - r.left, y = ev.clientY - r.top;
      if (node) { node.fx = x; node.fy = y; }
      setPos((p) => ({ ...p, [id]: { x, y } }));
    };
    const up = (ev) => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
      if (node) onPin(id, node.fx, node.fy);
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  }

  const linkById = useMemo(() => {
    const m = {};
    simLinks.forEach((l) => {
      const a = typeof l.source === "object" ? l.source.id : l.source;
      const b = typeof l.target === "object" ? l.target.id : l.target;
      m[`${a}-${b}`] = l; m[`${b}-${a}`] = l;
    });
    return m;
  }, [simLinks]);

  function edgeHot(a, b) {
    if (!hoverId) return false;
    return a === hoverId || b === hoverId;
  }

  return (
    <div ref={ref} className="kb-canvas">
      <svg width="100%" height="100%" role="img" aria-label="Knowledge graph">
        {simLinks.map((l, i) => {
          const a = typeof l.source === "object" ? l.source.id : l.source;
          const b = typeof l.target === "object" ? l.target.id : l.target;
          const pa = pos[a], pb = pos[b];
          if (!pa || !pb) return null;
          const hot = edgeHot(a, b);
          return (
            <g key={i}>
              <title>{(l.tags || []).join(", ")}</title>
              <line x1={pa.x} y1={pa.y} x2={pb.x} y2={pb.y}
                className={`kb-edge${hot ? " hot" : ""}`}
                strokeWidth={1 + Math.min(3, (l.weight || 1) - 1)}
                opacity={hoverId && !hot ? 0.25 : 1} />
            </g>
          );
        })}
        {simNodes.map((n) => {
          const p = pos[n.id];
          if (!p) return null;
          const dim = hoverId && hoverId !== n.id && !linkById[`${hoverId}-${n.id}`];
          const isSel = selectedId === n.id;
          return (
            <g key={n.id} className={`kb-node${dim ? " dim" : ""}`}
              transform={`translate(${p.x},${p.y})`}
              onMouseEnter={() => onHover(n.id)} onMouseLeave={() => onHover(null)}
              onClick={() => { if (!draggedRef.current) onSelect(n); draggedRef.current = false; }}
              onMouseDown={(e) => {
                e.stopPropagation();
                dragNode(n.id, e, e.currentTarget.ownerSVGElement);
              }}>
              <title>{n.title} — {n.dept} · {n.chunks} chunks</title>
              <circle r={n.r} fill="none" stroke={deptColor(n.dept)} strokeWidth={isSel ? 2.5 : 1.5} opacity={dim ? 0.35 : 1} />
              {pinned[n.id] && <circle r={2.5} fill="var(--muted)" cx={n.r - 2} cy={-n.r + 2} />}
              <text y={n.r + 15} textAnchor="middle">{n.title}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
