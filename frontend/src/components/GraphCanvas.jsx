// KB graph canvas — d3-force layout, hand-rolled SVG per design.md §8.
//
// Design rules implemented here:
//   · nodes = documents. Radius from chunk count + link degree; color from
//     department, never from risk (design.md §8 keeps those two palettes apart).
//   · edges = shared equipment tags; thickness = number of shared tags.
//   · hover = focus-and-context: that node's edges brighten, everything else
//     dims. No modal, no re-layout, no simulation restart.
//   · filtering DIMS non-matching nodes instead of removing them, so the shape
//     of the whole knowledge base stays visible while you narrow focus.
//   · layout is force-directed with one lobe per department; dragging pins.
//
// All interaction state is local — hovering or panning never re-renders the
// parent view. The simulation is pre-warmed before first paint, so the graph
// arrives already settled instead of exploding into place.
import { useEffect, useMemo, useRef, useState } from "react";
import { forceSimulation, forceManyBody, forceLink, forceCollide, forceX, forceY } from "d3-force";

const MIN_K = 0.32;
const MAX_K = 2.6;
// Labels only appear when there's room for them: the busiest ~18% of nodes
// carry one at rest, and hovering or searching reveals the rest.
const LABEL_BUDGET = 0.18;
const ZOOM_FOR_ALL_LABELS = 1.45;

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const slug = (s) => String(s || "other").toLowerCase().replace(/[^a-z0-9]+/g, "-") || "other";

// Canvas labels stay short — "WO-57041", not the full 60-char title. The whole
// title lives in the tooltip on hover and in the inspector on selection.
function shortLabel(title) {
  const t = String(title || "").trim();
  const head = t.split(":")[0].trim();
  if (t.includes(":") && head.length <= 24) return head;
  return t.length > 22 ? `${t.slice(0, 21)}…` : t;
}

export function GraphCanvas({
  nodes,
  edges,
  selectedId,
  matchIds,          // Set of ids passing the filters, or null when unfiltered
  colorMap,          // node id -> hex
  deptColors,        // dept -> hex
  activeDept,
  deptCounts,
  pinned = {},
  onSelect,
  onPin,
  onDeptClick,
  onUnpinAll,
}) {
  const hostRef = useRef(null);
  const tipRef = useRef(null);
  const simRef = useRef(null);
  const simNodeById = useRef({});
  const viewRef = useRef({ k: 1, x: 0, y: 0 });
  const posCache = useRef({});

  const [size, setSize] = useState({ w: 0, h: 0 });
  const [pos, setPos] = useState({});
  const [view, setViewState] = useState({ k: 1, x: 0, y: 0 });
  const [hoverId, setHoverId] = useState(null);
  const [ready, setReady] = useState(false);

  // Mirrored synchronously so wheel/pan/drag handlers can read the live
  // transform without waiting for a re-render.
  function setView(next) {
    viewRef.current = typeof next === "function" ? next(viewRef.current) : next;
    setViewState(viewRef.current);
  }

  // ── measurement ───────────────────────────────────────────────────────────
  useEffect(() => {
    const el = hostRef.current;
    if (!el) return;
    const measure = () => {
      const w = el.clientWidth, h = el.clientHeight;
      setSize((s) => (s.w === w && s.h === h ? s : { w, h }));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // ── derived graph facts ───────────────────────────────────────────────────
  const facts = useMemo(() => {
    const degree = {};
    const neighbors = {};
    for (const e of edges) {
      degree[e.a] = (degree[e.a] || 0) + 1;
      degree[e.b] = (degree[e.b] || 0) + 1;
      (neighbors[e.a] || (neighbors[e.a] = new Set())).add(e.b);
      (neighbors[e.b] || (neighbors[e.b] = new Set())).add(e.a);
    }
    const depts = [...new Set(nodes.map((n) => n.dept || "other"))].sort();
    const ranked = [...nodes].sort((a, b) => (degree[b.id] || 0) - (degree[a.id] || 0));
    const cut = ranked.length
      ? degree[ranked[Math.min(ranked.length - 1, Math.floor(ranked.length * LABEL_BUDGET))].id] || 0
      : 0;
    return { degree, neighbors, depts, labelCut: cut };
  }, [nodes, edges]);

  const simNodes = useMemo(
    () =>
      nodes.map((n) => {
        const d = facts.degree[n.id] || 0;
        return {
          ...n,
          degree: d,
          short: shortLabel(n.title),
          // Small orbs, a few larger hubs — the mesh, not the dots, carries the
          // picture. Range lands around 6–17px radius.
          r: 4 + Math.min(8, Math.sqrt(n.chunks || 1) * 1.8) + Math.min(5, d * 0.5),
        };
      }),
    [nodes, facts]
  );

  const simLinks = useMemo(
    () => edges.map((e) => ({ source: e.a, target: e.b, weight: e.weight || 1, tags: e.tags || [] })),
    [edges]
  );

  // ── layout ────────────────────────────────────────────────────────────────
  // `pinned` is deliberately not a dependency: pinning a node must not restart
  // the layout. Drag/pin writes fx/fy on the live sim nodes instead.
  useEffect(() => {
    const el = hostRef.current;
    if (!el || !simNodes.length) return;
    const w = el.clientWidth || 900;
    const h = el.clientHeight || 620;

    // One anchor ring position per department → visible lobes instead of a
    // single undifferentiated hairball.
    const depts = facts.depts;
    const R = Math.min(w, h) * 0.35;
    const anchors = {};
    depts.forEach((d, i) => {
      const a = depts.length === 1 ? 0 : (2 * Math.PI * i) / depts.length - Math.PI / 2;
      anchors[d] = { x: w / 2 + Math.cos(a) * R, y: h / 2 + Math.sin(a) * R };
    });

    simNodes.forEach((n, i) => {
      const a = anchors[n.dept || "other"] || { x: w / 2, y: h / 2 };
      n.ax = a.x;
      n.ay = a.y;
      const cached = posCache.current[n.id];
      if (cached) {
        n.x = cached.x;
        n.y = cached.y;
      } else {
        // Golden-angle seed: same data lays out the same way every load.
        const j = ((i * 137.508) % 360) * (Math.PI / 180);
        n.x = a.x + Math.cos(j) * (16 + (i % 5) * 8);
        n.y = a.y + Math.sin(j) * (16 + (i % 6) * 7);
      }
      const p = pinned[n.id];
      if (p) {
        n.fx = p.x;
        n.fy = p.y;
      } else {
        n.fx = null;
        n.fy = null;
      }
    });

    const links = simLinks.map((l) => ({ ...l })); // fresh copies — d3 rewrites source/target
    const sim = forceSimulation(simNodes)
      .alphaMin(0.02)
      .force("charge", forceManyBody().strength((d) => -170 - Math.min(d.degree, 12) * 34).distanceMax(560))
      .force(
        "link",
        forceLink(links)
          .id((d) => d.id)
          .distance((l) => 92 + 46 / (l.weight || 1))
          // Same-department links pull hard, cross-department links barely pull:
          // that is what turns one hairball into readable lobes joined by bridges.
          .strength((l) => {
            const sa = typeof l.source === "object" ? l.source.dept : null;
            const sb = typeof l.target === "object" ? l.target.dept : null;
            return sa && sa === sb ? 0.3 : 0.1;
          })
      )
      .force("collide", forceCollide().radius((d) => d.r + 8).strength(0.85).iterations(2))
      .force("ax", forceX((d) => d.ax).strength(0.105))
      .force("ay", forceY((d) => d.ay).strength(0.105))
      .stop();

    simRef.current = sim;
    simNodeById.current = Object.fromEntries(simNodes.map((n) => [n.id, n]));

    const writePositions = () => {
      const next = {};
      for (const n of simNodes) {
        const p = { x: n.x, y: n.y };
        next[n.id] = p;
        posCache.current[n.id] = p;
      }
      setPos(next);
    };

    // Pre-warm: settle the layout while the canvas is still blank, then frame
    // it. Nothing is painted mid-explosion.
    for (let i = 0; i < 260; i++) sim.tick();

    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const n of simNodes) {
      minX = Math.min(minX, n.x - n.r);
      maxX = Math.max(maxX, n.x + n.r);
      minY = Math.min(minY, n.y - n.r);
      maxY = Math.max(maxY, n.y + n.r);
    }
    const pad = 52;
    const k = clamp(
      Math.min(w / (maxX - minX + pad * 2), h / (maxY - minY + pad * 2)),
      MIN_K,
      1.25
    );
    setView({ k, x: w / 2 - ((minX + maxX) / 2) * k, y: h / 2 - ((minY + maxY) / 2) * k });
    writePositions();
    setReady(true);

    // A short live settle afterwards, so the graph breathes the last pixels
    // into place rather than appearing frozen.
    sim.on("tick", writePositions);
    sim.alpha(0.2).restart();
    const stop = setTimeout(() => sim.stop(), 1100);
    return () => {
      clearTimeout(stop);
      sim.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [simNodes, simLinks, facts.depts]);

  // ── viewport ──────────────────────────────────────────────────────────────
  function zoomAt(sx, sy, factor) {
    setView((v) => {
      const k = clamp(v.k * factor, MIN_K, MAX_K);
      if (Math.abs(k - v.k) < 1e-4) return v;
      return { k, x: sx - (sx - v.x) * (k / v.k), y: sy - (sy - v.y) * (k / v.k) };
    });
  }
  function zoomBy(factor) {
    setView((v) => {
      const k = clamp(v.k * factor, MIN_K, MAX_K);
      if (Math.abs(k - v.k) < 1e-4) return v;
      const cx = size.w / 2, cy = size.h / 2;
      return { k, x: cx - (cx - v.x) * (k / v.k), y: cy - (cy - v.y) * (k / v.k) };
    });
  }

  useEffect(() => {
    const el = hostRef.current;
    if (!el) return;
    // Native listener: React's onWheel is passive, so it can't preventDefault.
    const onWheel = (e) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      const sx = e.clientX - r.left;
      const sy = e.clientY - r.top;
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY) && !e.ctrlKey) {
        setView((v) => ({ ...v, x: v.x - e.deltaX, y: v.y }));
        return;
      }
      zoomAt(sx, sy, Math.exp(-e.deltaY * 0.0016));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const el = hostRef.current;
    if (!el) return;
    const onMove = (e) => {
      const tip = tipRef.current;
      if (!tip) return;
      const r = el.getBoundingClientRect();
      const tw = tip.offsetWidth || 240;
      const th = tip.offsetHeight || 100;
      let x = e.clientX - r.left + 18;
      let y = e.clientY - r.top + 16;
      if (x + tw > r.width - 8) x = e.clientX - r.left - tw - 14;
      if (y + th > r.height - 8) y = e.clientY - r.top - th - 14;
      tip.style.transform = `translate3d(${Math.max(8, x)}px, ${Math.max(8, y)}px, 0)`;
    };
    el.addEventListener("mousemove", onMove);
    return () => el.removeEventListener("mousemove", onMove);
  }, []);

  function fitView(maxK = 1.5) {
    const pts = Object.values(pos);
    if (!pts.length || !size.w || !size.h) return;
    const xs = pts.map((p) => p.x);
    const ys = pts.map((p) => p.y);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);
    const pad = 64;
    const k = clamp(
      Math.min(size.w / (maxX - minX + pad * 2), size.h / (maxY - minY + pad * 2)),
      MIN_K,
      maxK
    );
    setView({ k, x: size.w / 2 - ((minX + maxX) / 2) * k, y: size.h / 2 - ((minY + maxY) / 2) * k });
  }

  function resetLayout() {
    onUnpinAll?.();
    for (const n of Object.values(simNodeById.current)) {
      n.fx = null;
      n.fy = null;
    }
    posCache.current = {};
    simRef.current?.alpha(0.9).restart();
    setTimeout(() => simRef.current?.stop(), 1400);
  }

  function startPan(e) {
    if (e.button !== 0) return;
    const v0 = viewRef.current;
    const sx = e.clientX, sy = e.clientY;
    let moved = false;
    const move = (ev) => {
      const dx = ev.clientX - sx, dy = ev.clientY - sy;
      if (Math.abs(dx) + Math.abs(dy) > 3) moved = true;
      setView({ k: v0.k, x: v0.x + dx, y: v0.y + dy });
    };
    const up = () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
      if (!moved) onSelect?.(null); // click on empty canvas clears selection
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  }

  function startNodeDrag(e, node) {
    if (e.button !== 0) return;
    e.stopPropagation();
    const live = simNodeById.current[node.id];
    if (!live) return;
    const v0 = viewRef.current;
    const sx = e.clientX, sy = e.clientY;
    const x0 = live.x, y0 = live.y;
    let dragged = false;
    const move = (ev) => {
      if (!dragged && Math.abs(ev.clientX - sx) + Math.abs(ev.clientY - sy) <= 3) return;
      dragged = true;
      const nx = x0 + (ev.clientX - sx) / v0.k;
      const ny = y0 + (ev.clientY - sy) / v0.k;
      live.fx = nx;
      live.fy = ny;
      live.x = nx;
      live.y = ny;
      setPos((p) => ({ ...p, [node.id]: { x: nx, y: ny } }));
      simRef.current?.alpha(0.16).restart();
    };
    const up = () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
      if (dragged) {
        // let the neighborhood settle around the new pin instead of freezing
        simRef.current?.alpha(0.3).restart();
        onPin?.(node.id, live.fx, live.fy);
      } else {
        onSelect?.(node); // a click, not a drag
      }
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  }

  function unpin(id) {
    const live = simNodeById.current[id];
    if (live) {
      live.fx = null;
      live.fy = null;
    }
    onPin?.(id, null, null);
    simRef.current?.alpha(0.5).restart();
  }

  // ── render ────────────────────────────────────────────────────────────────
  const focusId = hoverId || selectedId || null;
  const focusNbrs = focusId ? facts.neighbors[focusId] : null;
  const hoverNode = hoverId ? simNodes.find((n) => n.id === hoverId) : null;
  const k = view.k;

  // One place decides how a node reads, so the node layer and the label layer
  // can never disagree about who is dimmed or labelled.
  function visual(n) {
    const filtered = !!matchIds && !matchIds.has(n.id);
    const isSel = selectedId === n.id;
    const isFocus = focusId === n.id;
    const isNbr = !!focusNbrs?.has(n.id);
    const dim = (!!focusId && !isFocus && !isNbr) || filtered;
    const matched = !!matchIds && matchIds.has(n.id);
    const showLabel =
      !dim &&
      (isFocus || isNbr || isSel || matched || k >= ZOOM_FOR_ALL_LABELS || n.degree >= facts.labelCut);
    return { filtered, isSel, isFocus, isNbr, dim, matched, showLabel };
  }

  return (
    <div
      ref={hostRef}
      className="kb-canvas"
      onMouseDown={startPan}
      role="application"
      aria-label="Knowledge graph — documents as nodes, shared equipment tags as links"
    >
      <svg className="kb-svg" width={size.w || 900} height={size.h || 620} role="img" aria-hidden="true">
        <defs>
          {facts.depts.map((d) => {
            const col = deptColors?.[d] || "#8fa6c8";
            return (
              <g key={d}>
                <radialGradient id={`kb-orb-${slug(d)}`} cx="34%" cy="30%" r="82%">
                  <stop offset="0%" stopColor="#ffffff" stopOpacity="0.34" />
                  <stop offset="34%" stopColor={col} stopOpacity="0.92" />
                  <stop offset="100%" stopColor={col} stopOpacity="0.5" />
                </radialGradient>
                <radialGradient id={`kb-halo-${slug(d)}`}>
                  <stop offset="0%" stopColor={col} stopOpacity="0.34" />
                  <stop offset="52%" stopColor={col} stopOpacity="0.11" />
                  <stop offset="100%" stopColor={col} stopOpacity="0" />
                </radialGradient>
              </g>
            );
          })}
        </defs>

        <g transform={`translate(${view.x},${view.y}) scale(${k})`}>
          {/* edges — hairlines, curved slightly so dense neighborhoods stay readable */}
          <g className="kb-edge-layer">
            {simLinks.map((l, i) => {
              const a = typeof l.source === "object" ? l.source.id : l.source;
              const b = typeof l.target === "object" ? l.target.id : l.target;
              const pa = pos[a], pb = pos[b];
              if (!pa || !pb) return null;
              const hot = !!focusId && (a === focusId || b === focusId);
              if (hot) return null; // hot edges render in the layer above
              const filtered = !!matchIds && (!matchIds.has(a) || !matchIds.has(b));
              const dim = !!focusId || filtered;
              const dx = pb.x - pa.x, dy = pb.y - pa.y;
              const len = Math.hypot(dx, dy) || 1;
              const bow = Math.min(24, len * 0.07);
              const cx = (pa.x + pb.x) / 2 - (dy / len) * bow;
              const cy = (pa.y + pb.y) / 2 + (dx / len) * bow;
              return (
                <path
                  key={i}
                  d={`M${pa.x.toFixed(1)},${pa.y.toFixed(1)} Q${cx.toFixed(1)},${cy.toFixed(1)} ${pb.x.toFixed(1)},${pb.y.toFixed(1)}`}
                  className="kb-edge"
                  stroke="#a8c4ff"
                  strokeWidth={0.6 + Math.min(2.2, (l.weight - 1) * 0.5)}
                  opacity={filtered ? 0.05 : dim ? 0.1 : 0.28}
                />
              );
            })}
          </g>

          {/* hovered node's edges, on top of the mesh so the connection reads */}
          <g className="kb-edge-layer">
            {simLinks.map((l, i) => {
              const a = typeof l.source === "object" ? l.source.id : l.source;
              const b = typeof l.target === "object" ? l.target.id : l.target;
              if (!focusId || (a !== focusId && b !== focusId)) return null;
              const pa = pos[a], pb = pos[b];
              if (!pa || !pb) return null;
              const col = colorMap?.[a === focusId ? a : b] || colorMap?.[a] || "#8fa6c8";
              const dx = pb.x - pa.x, dy = pb.y - pa.y;
              const len = Math.hypot(dx, dy) || 1;
              const bow = Math.min(24, len * 0.07);
              const cx = (pa.x + pb.x) / 2 - (dy / len) * bow;
              const cy = (pa.y + pb.y) / 2 + (dx / len) * bow;
              const d = `M${pa.x.toFixed(1)},${pa.y.toFixed(1)} Q${cx.toFixed(1)},${cy.toFixed(1)} ${pb.x.toFixed(1)},${pb.y.toFixed(1)}`;
              return (
                <g key={i}>
                  <title>{(l.tags || []).join(", ")}</title>
                  <path d={d} className="kb-edge kb-edge-glow" stroke={col} strokeWidth={(0.6 + Math.min(2.2, (l.weight - 1) * 0.5)) + 3} />
                  <path d={d} className="kb-edge kb-edge-hot" stroke={col} strokeWidth={(0.6 + Math.min(2.2, (l.weight - 1) * 0.5)) + 0.8} />
                </g>
              );
            })}
          </g>

          {/* nodes */}
          {simNodes.map((n, i) => {
            const p = pos[n.id];
            if (!p) return null;
            const col = colorMap?.[n.id] || deptColors?.[n.dept] || "#8fa6c8";
            const { dim, isSel, isFocus } = visual(n);
            return (
              <g
                key={n.id}
                className={`kb-node-g${dim ? " kb-dim" : ""}${isFocus ? " kb-on" : ""}`}
                transform={`translate(${p.x.toFixed(1)},${p.y.toFixed(1)})`}
                onMouseEnter={() => setHoverId(n.id)}
                onMouseLeave={() => setHoverId((h) => (h === n.id ? null : h))}
                onMouseDown={(e) => startNodeDrag(e, n)}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  if (pinned[n.id]) unpin(n.id);
                }}
              >
                <title>{`${n.title} — ${n.dept} · ${n.chunks} chunks · ${n.degree} links`}</title>
                <g className="kb-node-in" style={{ "--i": Math.min(i, 44) }}>
                  {(isFocus || isSel) && <circle r={n.r * 3.1} fill={`url(#kb-halo-${slug(n.dept)})`} />}
                  <circle
                    className="kb-orb"
                    r={n.r}
                    fill={`url(#kb-orb-${slug(n.dept)})`}
                    stroke={col}
                    strokeOpacity={dim ? 0.22 : 0.85}
                    strokeWidth={1.1}
                  />
                  {/* specular highlight — the orb motif from design.md §7a */}
                  <ellipse cx={-n.r * 0.26} cy={-n.r * 0.3} rx={n.r * 0.38} ry={n.r * 0.26} fill="#fff" opacity={dim ? 0.05 : 0.16} />
                  {(isSel || isFocus) && <circle className="kb-ring" r={n.r + 4.5} stroke={col} />}
                  {pinned[n.id] && <circle className="kb-pin" r={2.6} cx={n.r * 0.72} cy={-n.r * 0.72} />}
                </g>
              </g>
            );
          })}

          {/* labels ride above every node, so a dense neighborhood never buries them */}
          <g className="kb-label-layer">
            {simNodes.map((n) => {
              const p = pos[n.id];
              if (!p || !visual(n).showLabel) return null;
              const lw = n.short.length * 5.9 + 14;
              return (
                <g
                  key={n.id}
                  className="kb-label"
                  transform={`translate(${p.x.toFixed(1)},${p.y.toFixed(1)}) translate(0, ${(n.r + 6).toFixed(1)}) scale(${(1 / k).toFixed(3)})`}
                >
                  <rect x={-lw / 2} y={0} width={lw} height={16} rx={8} />
                  <text y={11.5} textAnchor="middle">{n.short}</text>
                </g>
              );
            })}
          </g>
        </g>
      </svg>

      {/* ── overlays ── */}
      {facts.depts.length > 1 && (
        <div className="kb-legend" onMouseDown={(e) => e.stopPropagation()}>
          <div className="kb-legend-head">Departments</div>
          {facts.depts.map((d) => (
            <button
              key={d}
              type="button"
              className={`kb-legend-row${activeDept === d ? " on" : ""}`}
              onClick={() => onDeptClick?.(d)}
              title={`Focus ${d}`}
            >
              <span className="kb-dot" style={{ background: deptColors?.[d] || "#8fa6c8" }} />
              <span className="kb-legend-name">{d}</span>
              <span className="kb-legend-n">{deptCounts?.[d] ?? 0}</span>
            </button>
          ))}
        </div>
      )}

      <div className="kb-controls" onMouseDown={(e) => e.stopPropagation()}>
        <button type="button" onClick={() => zoomBy(1.25)} title="Zoom in" aria-label="Zoom in">
          <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" fill="none" /></svg>
        </button>
        <button type="button" onClick={() => zoomBy(1 / 1.25)} title="Zoom out" aria-label="Zoom out">
          <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M3 8h10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" fill="none" /></svg>
        </button>
        <span className="kb-zoom-val">{Math.round(k * 100)}%</span>
        <button type="button" onClick={() => fitView()} title="Fit graph to view" aria-label="Fit graph to view">
          <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M2 6V2h4M14 6V2h-4M2 10v4h4M14 10v4h-4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" fill="none" /></svg>
        </button>
        <button type="button" onClick={resetLayout} title="Release pinned nodes and re-run layout" aria-label="Reset layout">
          <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M13 8a5 5 0 1 1-1.6-3.7M13 2.5V6h-3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" fill="none" /></svg>
        </button>
      </div>

      <div className="kb-status">
        <span className="kb-status-live" data-ready={ready ? "1" : "0"} />
        {matchIds ? (
          <span>
            <strong>{matchIds.size}</strong> of {nodes.length} documents match
          </span>
        ) : (
          <span>
            <strong>{nodes.length}</strong> documents · <strong>{edges.length}</strong> links ·{" "}
            <strong>{facts.depts.length}</strong> departments
          </span>
        )}
        <span className="kb-status-hint">scroll to zoom · drag to pan · click to inspect · drag a node to pin</span>
      </div>

      <div ref={tipRef} className={`kb-tip${hoverNode ? " show" : ""}`} aria-hidden="true">
        {hoverNode && (
          <>
            <div className="kb-tip-title">{hoverNode.title}</div>
            <div className="kb-tip-sub">
              <span className="kb-dot" style={{ background: deptColors?.[hoverNode.dept] || "#8fa6c8" }} />
              {hoverNode.dept} · {hoverNode.class} · {hoverNode.chunks} chunks · {hoverNode.degree} links
            </div>
            {hoverNode.tags?.length > 0 && (
              <div className="kb-tip-tags">
                {hoverNode.tags.slice(0, 5).map((t) => (
                  <span key={t}>{t}</span>
                ))}
                {hoverNode.tags.length > 5 && <span className="kb-tip-more">+{hoverNode.tags.length - 5}</span>}
              </div>
            )}
            {pinned[hoverNode.id] && <div className="kb-tip-pin">pinned — double-click to release</div>}
          </>
        )}
      </div>
    </div>
  );
}
