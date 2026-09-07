// All API calls live here. Components never fetch() directly.
const BASE = "";

export async function askQuestion(text, user_dept = "operations") {
  const r = await fetch(`${BASE}/ask`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, user_dept }),
  });
  return r.json();
}

export async function getHealth() {
  const r = await fetch(`${BASE}/health`);
  return r.json();
}

export async function runCode(code) {
  const r = await fetch(`${BASE}/tools/run`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code }),
  });
  return r.json();
}
