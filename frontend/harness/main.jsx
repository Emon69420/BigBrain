// Throwaway visual harness: renders the real KBView against a mocked /graph so
// the canvas can be screenshotted without auth or a backend. Not shipped.
import { useEffect } from "react";
import ReactDOM from "react-dom/client";
import "../src/styles.css";
import { KBView } from "../src/views/KB.jsx";

let seed = 12345;
const rnd = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
const pickN = (arr, n) => {
  const out = [];
  let guard = 0;
  while (out.length < n && guard++ < 200) {
    const v = arr[Math.floor(rnd() * arr.length)];
    if (!out.includes(v)) out.push(v);
  }
  return out;
};

const TAGS = ["P-204","L-204A","V-17","PT-204","FT-101","E-301","K-201","C-101","T-501","P-101A","FV-210","TT-118","PSV-402","HX-305","B-12","M-77","GT-09","D-455"];

const TEMPLATES = {
  maintenance: (i) => `WO-${51000 + i * 137}: Turnaround Mechanical Seal Replacement`,
  maintenance2: (i) => `SOP-MNT-${3000 + i * 37}: Lube Oil Replacement Procedure`,
  operations: (i) => `SOP-OP-${1000 + i * 29}: Startup Procedure Section ${i}`,
  engineering: (i) => `P&ID ${101 + i * 7}: Flare Gas Recovery Unit`,
  safety: (i) => `Safety Alert 2025-${String(i + 1).padStart(2, "0")}: Overpressure Event`,
  safety2: (i) => `Near Miss Report NM-${400 + i * 3}: Steam Line Leak`,
  inspection: (i) => `Inspection Q${(i % 4) + 1}-2025: Section ${i} Visual Inspection`,
};

const PLAN = [
  ["maintenance", 12], ["maintenance2", 6], ["operations", 8],
  ["engineering", 7], ["safety", 5], ["safety2", 5], ["inspection", 9],
];

const nodes = [];
const byId = {};
let n = 0;
for (const [kind, count] of PLAN) {
  for (let i = 0; i < count; i++) {
    const id = ++n;
    const dept = kind.startsWith("maintenance") ? "maintenance"
      : kind.startsWith("safety") ? "safety"
      : kind === "operations" ? "operations"
      : kind === "engineering" ? "engineering" : "inspection";
    const doc = {
      id,
      title: TEMPLATES[kind](i),
      dept,
      class: rnd() > 0.7 ? "restricted" : "open",
      chunks: 2 + Math.floor(rnd() * 26),
      tags: pickN(TAGS, 2 + Math.floor(rnd() * 2)),
    };
    nodes.push(doc);
    byId[id] = doc;
  }
}

const edges = [];
for (let i = 0; i < nodes.length; i++) {
  for (let j = i + 1; j < nodes.length; j++) {
    const shared = nodes[i].tags.filter((t) => nodes[j].tags.includes(t));
    if (shared.length) edges.push({ a: nodes[i].id, b: nodes[j].id, tags: shared, weight: shared.length });
  }
}

const graph = { org_id: "default", nodes, edges };

const CHUNKS = nodes.slice(0, 3).map((d, i) => ({
  doc_id: d.id,
  content: `Chunk ${i} of ${d.title}. Torque the flange bolts to 240 Nm in a star pattern and confirm the ${d.tags[0]} isolation valve is tagged before breaking containment.`,
}));

const realFetch = window.fetch;
window.fetch = async (url, opts = {}) => {
  const path = String(url);
  const body = path.includes("/ask") ? { evidence: CHUNKS, answer: "", grounded: true } : graph;
  return { ok: true, status: 200, json: async () => body, text: async () => JSON.stringify(body) };
};
void realFetch;

function FakeSidebar() {
  return (
    <aside className="sidebar" style={{ width: 280 }}>
      <div className="sidebar-brand">
        <span className="sidebar-brand-text">BigBrain</span>
        <span className="sidebar-brand-badge">Sovereign</span>
      </div>
      <nav className="sidebar-nav">
        {["Chat", "Boards", "Knowledge Base", "Tools", "Ingest", "Security"].map((l) => (
          <div key={l} className={`sidebar-nav-item${l === "Knowledge Base" ? " active" : ""}`}>{l}</div>
        ))}
      </nav>
    </aside>
  );
}

function Harness() {
  useEffect(() => {
    if (!location.search.includes("sel")) return;
    // click a well-connected node so the inspector state renders too
    const t = setTimeout(() => {
      const groups = [...document.querySelectorAll(".kb-node-g")];
      const target = groups[Math.floor(groups.length / 2)] || groups[0];
      if (!target) return;
      target.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, button: 0, clientX: 400, clientY: 400 }));
      window.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, clientX: 400, clientY: 400 }));
    }, 1500);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="shell">
      <FakeSidebar />
      <div className="main-col">
        <div className="topbar">
          <span className="eyebrow" style={{ fontSize: 11 }}>Workspace</span>
          <span className="status-pill"><span className="status-dot" />idle</span>
        </div>
        <div className="content">
          <KBView />
        </div>
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<Harness />);
