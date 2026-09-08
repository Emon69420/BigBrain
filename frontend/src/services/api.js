// All API calls live here. Components never fetch() directly.
const BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";
let _org = localStorage.getItem("bb_org") || import.meta.env.VITE_ORG_ID || "default";
export function setOrg(id){ _org=id; localStorage.setItem("bb_org", id); }
export function getOrg(){ return _org; }

function headers() {
  return { "Content-Type": "application/json", "X-Org-Id": _org };
}
function withCreds(opts={}){ return { credentials:"include", ...opts }; }

async function post(path, body) {
  const r = await fetch(`${BASE}${path}`, { method:"POST", headers:headers(), body:JSON.stringify(body), ...withCreds() });
  const data = await r.json().catch(()=>({}));
  if(!r.ok) throw new Error(data.error || `Request failed (${r.status})`);
  return data;
}
async function get(path){
  const r = await fetch(`${BASE}${path}`, { headers:headers(), ...withCreds() });
  const data = await r.json().catch(()=>({}));
  if(!r.ok) throw new Error(data.error || `Request failed (${r.status})`);
  return data;
}

export async function askQuestion(text, user_dept="operations"){ return post("/ask",{text,user_dept}); }
export async function getHealth(){ return get("/health"); }
export async function runCode(code){ return post("/tools/run",{code}); }
export async function ingestDoc({title,content,dept="operations",docClass="open"}){ return post("/docs",{title,content,dept,class:docClass}); }
export async function listDocs(){ return get("/docs"); }
export async function deleteDoc(id){ const r=await fetch(`${BASE}/docs/${id}`,{method:"DELETE",headers:headers(),...withCreds()}); const d=await r.json().catch(()=>({})); if(!r.ok) throw new Error(d.error||`Delete failed`); return d; }
export async function getGraph(){ return get("/graph"); }
// auth
export async function register(email,name,password){ return post("/auth/register",{email,name,password}); }
export async function login(email,password){ return post("/auth/login",{email,password}); }
export async function logout(){ return post("/auth/logout",{}); }
export async function me(){ return get("/auth/me"); }
// chat threads
export async function listConversations(){ return get("/conversations"); }
export async function createConversation(title="New chat"){ return post("/conversations",{title}); }
export async function getMessages(cid){ return get(`/conversations/${cid}/messages`); }
export async function postMessage(cid, msg){ return post(`/conversations/${cid}/messages`,msg); }
