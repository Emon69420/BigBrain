"""Query rewriter — always-on, Groq SLM, JSON mode. Port of beyondchats searchQueriesPrompt."""
import json, os, re

SYSTEM = """Extract the core search intent from the user's last message and convert into 1-3 concise keyword-based search queries.
Replace pronouns with referenced entities using history.
Guidelines:
- Only for org-related queries. If greeting/thanks/smalltalk, return {"search_queries":[],"is_search_required":false}.
- Always English queries, 1-6 keywords each.
- Also set answer_effort: low=direct lookup, medium=combine few facts, high=multi-step/math/tradeoffs.
Respond strictly as JSON: {"search_queries":[...],"is_search_required":bool,"answer_effort":"low|medium|high"}"""

def _parse(text):
    try:
        m=re.search(r"\{.*\}", text, re.S)
        if m: return json.loads(m.group(0))
    except: pass
    return None

def rewrite(last_msg, history_text=""):
    # history_text: last 2 user msgs joined for pronoun resolution
    prompt = history_text + "\nUser last: " + last_msg if history_text else "User last: "+last_msg
    # try Groq slm via existing provider
    try:
        from brain.groq_provider import GroqBrain
        from config import load_registry
        reg=load_registry(); brain=GroqBrain(reg)
        # use LLM slot (120B everywhere)
        msg=[{"role":"system","content":SYSTEM},{"role":"user","content":prompt}]
        raw,_=brain.chat_full("groq-llm", msg)
        data=_parse(raw)
        if data and isinstance(data.get("search_queries"), list):
            qs=[q.strip() for q in data["search_queries"] if q and q.strip()][:3]
            return {"queries":qs, "is_search_required":bool(data.get("is_search_required", len(qs)>0)), "effort":data.get("answer_effort","medium"), "raw":raw}
    except Exception as e:
        pass
    # fallback: raw query as single search
    t=last_msg.strip()
    low=t.lower()
    if len(t.split())<=2 and any(w in low for w in ["hi","hello","thanks","thank you","hey"]):
        return {"queries":[], "is_search_required":False, "effort":"low", "raw":"fallback-smalltalk"}
    return {"queries":[t], "is_search_required":True, "effort":"medium", "raw":"fallback"}

def extract_keywords(text):
    # tiny keyword extractor: split, drop stopwords
    stops=set(["the","is","a","an","and","or","what","whats","what's","is","are","of","for","in","on","to","with","about","explain","define","tell","me","sop","sops"])
    toks=re.findall(r"[A-Za-z0-9]+", text.lower())
    return [t for t in toks if t not in stops][:6]
