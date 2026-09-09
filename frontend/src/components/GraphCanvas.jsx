// KB graph canvas — d3-force layout, hand-rolled SVG per design.md §8.
// Hover state is LOCAL (no parent re-render, no sim restarts on mouse move).
// Nodes colored by connected component; sim settles fast and stops.
import { useEffect, useMemo, useRef, useState } from "react";

import { forceSimulation, forceManyBody, forceCenter, forceLink, forceCollide, forceX, forceY } from "d3-force";

export function GraphCanvas({ nodes, edges, selectedId, colorMap, onSelect, pinned, onPin }) {
  const ref = useRef(null);
  const [pos, setPos] = useState({});
  const [size, setSize] = useState({ w: 800, h: 520 });
  const [hoverId, setHoverId] = useState(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const panRef = useRef(null);

  const simNodes = useMemo(() => nodes.map((n) => ({ ...n, r: 14 + Math.min(22, (n.chunks || 0) * 4) })), [nodes]);
  const simLinks = useMemo(() => edges.map((e) => ({ source: e.a, target: e.b, weight: e.weight, tags: e.tags })), [edges]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setSize((s) => {
      const w = el.clientWidth || 800, h = el.clientHeight || 520;
      return (Math.abs(w - s.w) < 2 && Math.abs(h - s.h) < 2) ? s : { w, h };
    });
    measure();
    const t1 = setTimeout(measure, 300);
    const wb = new ResizeObserver(measure);
    wb.observe(el);
    return () => { clearTimeout(t1); wb.disconnect(); };
  }, []);

  useEffect(() => {
    if (!simNodes.length) return;
    simNodes.forEach((n, i) => {
      if (n.x == null || n.y == null) {
        const a = (2 * Math.PI * i) / Math.max(1, simNodes.length);
        n.x = size.w / 2 + Math.cos(a) * Math.min(size.w, size.h) * 0.38;
        n.y = size.h / 2 + Math.sin(a) * Math.min(size.w, size.h) * 0.38;
      }
    });
    const sim = forceSimulation(simNodes)
      .velocityDecay(0.35)
      .alphaMin(0.12)
      .force("charge", forceManyBody().strength(-260))
      .force("center", forceCenter(size.w / 2, size.h / 2))
      .force("gx", forceX(size.w / 2).strength(0.08))
      .force("gy", forceY(size.h / 2).strength(0.08))
      .force("collide", forceCollide().radius((d) => d.r + 36))
      .force("link", forceLink(simLinks).id((d) => d.id).distance(170).strength(0.35));
    simNodes.forEach((n) => {
      if (pinned[n.id]) { n.fx = pinned[n.id].x; n.fy = pinned[n.id].y; }
      else { n.fx = null; n.fy = null; }
    });
    sim.on("tick", () => {
      const p = {};
      simNodes.forEach((n) => { p[n.id] = { x: n.x, y: n.y }; });
      setPos({ ...p });
    });
    const stop = setTimeout(() => sim.stop(), 1500);
    return () => { clearTimeout(stop); sim.stop(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [simNodes, simLinks]);

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
    const up = () => {
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

  function changeZoom(delta) {
    setZoom((z) => Math.max(0.45, Math.min(2.4, +(z + delta).toFixed(2))));
  }

  function wheelZoom(e) {
    e.preventDefault();
    if (Math.abs(e.deltaX) > Math.abs(e.deltaY) || e.shiftKey) {
      setPan((p) => ({ x: p.x - e.deltaX - (e.shiftKey ? e.deltaY : 0), y: p.y }));
      return;
    }
    changeZoom(e.deltaY > 0 ? -0.1 : 0.1);
  }

  function startPan(e) {
    if (e.target !== e.currentTarget && e.target.tagName !== "svg") return;
    const start = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y };
    panRef.current = start;
    const move = (ev) => setPan({ x: start.px + ev.clientX - start.x, y: start.py + ev.clientY - start.y });
    const end = () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", end);
      panRef.current = null;
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", end);
  }

  function resetView() {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }

  return (
    <div ref={ref} className="kb-canvas" onWheel={wheelZoom} onMouseDown={startPan}>
      <div className="kb-zoom-controls" aria-label="Graph zoom controls">
        <button type="button" onClick={() => changeZoom(0.15)} aria-label="Zoom in">+</button>
        <span>{Math.round(zoom * 100)}%</span>
        <button type="button" onClick={() => changeZoom(-0.15)} aria-label="Zoom out">−</button>
        <button type="button" onClick={resetView} aria-label="Reset view">Reset</button>
      </div>
      <svg width={size.w} height={size.h} role="img" aria-label="Knowledge graph" style={{ display: "block" }}>
        <g transform={`translate(${pan.x} ${pan.y}) translate(${size.w / 2} ${size.h / 2}) scale(${zoom}) translate(${-size.w / 2} ${-size.h / 2})`}>
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
          const col = (colorMap && colorMap[n.id]) || "#7d8aa5";
          return (
            <g key={n.id} className={`kb-node${dim ? " dim" : ""}`}
              transform={`translate(${p.x},${p.y})`}
              onMouseEnter={() => setHoverId(n.id)} onMouseLeave={() => setHoverId(null)}
              onClick={() => { if (!draggedRef.current) onSelect(n); draggedRef.current = false; }}
              onMouseDown={(e) => {
                e.stopPropagation();
                dragNode(n.id, e, e.currentTarget.ownerSVGElement);
              }}>
              <title>{n.title} — {n.dept} · {n.chunks} chunks</title>
              <circle r={n.r} fill={col} fillOpacity={dim ? 0.08 : 0.2} stroke={col} strokeWidth={isSel ? 2.8 : 1.8} opacity={dim ? 0.35 : 1} />
              {pinned[n.id] && <circle r={2.5} fill="var(--muted)" cx={n.r - 2} cy={-n.r + 2} />}
              <text y={n.r + 15} textAnchor="middle">{n.title.length > 24 ? `${n.title.slice(0, 22)}…` : n.title}</text>
            </g>
          );
        })}
        </g>
      </svg>
    </div>
  );
}
