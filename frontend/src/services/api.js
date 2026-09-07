// All API calls live here. Components never fetch() directly.
const BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";
const ORG_ID = import.meta.env.VITE_ORG_ID || "default";

function headers() {
  return { "Content-Type": "application/json", "X-Org-Id": ORG_ID };
}

async function post(path, body) {
  const r = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(body),
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data.error || `Request failed (${r.status})`);
  return data;
}

export async function askQuestion(text, user_dept = "operations") {
  return post("/ask", { text, user_dept });
}

export async function getHealth() {
  const r = await fetch(`${BASE}/health`, { headers: headers() });
  const data = await r.json();
  if (!r.ok) throw new Error(data.error || `Request failed (${r.status})`);
  return data;
}

export async function runCode(code) {
  return post("/tools/run", { code });
}
