"""Brain service — reusable business logic. Routes call this, never Groq directly."""
from config import load_registry
from brain.groq_provider import GroqBrain
from brain.prompts import build_rag_prompt
from utils.observability import new_request_id, log_llm_call, timed, elapsed_ms

_registry = load_registry()
_brain = GroqBrain(_registry)


def ask_question(text, user_dept="operations", org_id="default", request_id=None, retrieve=True, history_text=""):
    """Full ask pipeline. Always-on rewriter + RRF + floor + grounded prompt. Logs every call."""
    request_id = request_id or new_request_id()
    task = _brain.classify_task(text)
    model_key = _brain.route(task)
    model_id = _brain.registry.get(model_key, {}).get("model_id", "")
    evidence = []
    grounded = False
    general_knowledge = False
    search_queries=[text]
    tool_used = None
    tool_trace = []
    judge_out = None
    if retrieve:
        try:
            from data.service import hybrid_search
            evidence = hybrid_search(text, user_dept, limit=5, org_id=org_id, queries=[text])
        except Exception:
            evidence = []
        # --- judge after retrieval: sees evidence + tools + query ---
        try:
            from brain.judge import judge as judge_fn
            from tools.factory import list_registry
            tool_descs = list_registry()
            judge_out = judge_fn(text, evidence, tool_descs, history_text)
            decision = judge_out.get("decision","docs" if evidence else "general")
            tool_trace.append(f"judge: {decision} ({judge_out.get('reason','')[:60]})")
        except Exception as e:
            tool_trace.append(f"judge failed open: {e}")
            decision = "docs" if evidence else "general"
            judge_out = {"decision":decision, "tool_task":""}
        # act on decision — exact hit / chain / single full build (never half-built)
        if decision in ("tool_only","docs_plus_tool"):
            tool_task = (judge_out.get("tool_task") or text).strip()
            try:
                from tools.factory import score_fit, plan_chain, execute_chain, find_tool
                from tools.builder import ensure_tool
                from tools.runner import run_tool
                # 1) try single exact hit
                hit_entry = None
                for t in __import__('tools.factory', fromlist=['list_registry']).list_registry():
                    if score_fit(tool_task, t) == "exact":
                        hit_entry = t
                        break
                if hit_entry:
                    # reuse without building
                    t_res = {"hit": True, "entry": hit_entry, "trace": [f"exact hit: {hit_entry['name']}"]}
                    tool_trace.append(t_res["trace"][0])
                else:
                    # 2) try chain of exact tools (max 3, validated)
                    chain = plan_chain(tool_task)
                    if chain:
                        tool_trace.append(f"chain proposed: {' -> '.join(s['tool'] for s in chain)}")
                        # need initial args from query
                        init_args = {}
                        try:
                            # extract initial args for chain via judge's tool_task numbers
                            import json, re
                            # use same arg extraction for first step's tool
                            pass
                        except: pass
                        exec_res = execute_chain(chain, initial_args=None)
                        tool_trace.extend(exec_res.get("trace", []))
                        if exec_res.get("ok"):
                            # chain succeeded — synthesize a virtual tool_used
                            tool_used = {"name": " -> ".join(s["tool"] for s in chain), "hit": True, "uses": 0, "result": str(exec_res["result"]), "decision": decision, "chain": True}
                            evidence = [{"content": f"Tool chain {' -> '.join(s['tool'] for s in chain)} result: {tool_used['result']}", "doc_id": chain[-1]["tool"], "title": f"tool:{chain[-1]['tool']}", "dept": user_dept, "class": "open", "distance": 0.0, "tool": True, "chain": True, "newly_created": False}] + evidence
                            # skip single-tool path
                            hit_entry = "CHAIN_DONE"
                        else:
                            tool_trace.append(f"chain failed: {exec_res.get('error')} -> fallback to single full build")
                            hit_entry = None
                    if hit_entry != "CHAIN_DONE":
                        # not hit and chain not viable -> build one full tool
                        if not hit_entry:
                            t_res = ensure_tool(tool_task, sample_input=None, created_by="auto", org_id=org_id)
                            tool_trace.extend(t_res.get("trace", []))
                            hit_entry = t_res.get("entry")
                            t_hit = t_res.get("hit", False)
                        else:
                            t_hit = True
                            t_res = {"hit": True}
                        if hit_entry and hit_entry != "CHAIN_DONE":
                            entry = hit_entry
                            args = {}
                            try:
                                full = entry.get("full_desc","") or entry.get("desc","")
                                arg_prompt = f"Tool {entry['name']} expects:\n{full}\nQuery: {text}\nTool task: {tool_task}\nReturn JSON with exact arg names only. Numbers only. Return JSON only."
                                raw,_ = _brain.chat_full("groq-llm", [{"role":"user","content":arg_prompt}])
                                import json, re
                                m=re.search(r"\{.*\}", raw, re.S)
                                if m: args=json.loads(m.group(0))
                            except: args={}
                            run_res = run_tool(entry["name"], args if args else None)
                            newly = not t_hit
                            if run_res.get("ok"):
                                tool_used = {"name": entry["name"], "hit": t_hit, "uses": entry.get("uses",0), "result": run_res.get("stdout") or str(run_res.get("result")), "decision":decision, "newly_created": newly}
                                evidence = [{"content": f"Tool {entry['name']} result: {tool_used['result']}", "doc_id": entry["name"], "title": f"tool:{entry['name']}", "dept": user_dept, "class": "open", "distance": 0.0, "tool": True, "newly_created": newly}] + evidence
                            else:
                                tool_used = {"name": entry["name"], "error": run_res.get("error"), "hit": t_hit, "decision":decision, "newly_created": newly}
                                tool_trace.append(f"run failed: {run_res.get('error')}")
            except Exception as e:
                tool_trace.append(f"tool auto failed: {e}")
        elif decision == "general":
            # no retrieval needed already, but we already retrieved — just keep evidence empty for general badge
            pass
        # docs: keep evidence as is
        prompt = build_rag_prompt(text, evidence if decision != "general" else [])
        grounded = decision != "general"
        general_knowledge = decision == "general" or (len([e for e in evidence if not e.get("tool")]) == 0 and not tool_used)
        search_queries = [judge_out.get("tool_task") or text] if judge_out else [text]
    t0 = timed()
    try:
        answer, usage = _brain.chat_full(model_key, [{"role": "user", "content": prompt}])
        latency = elapsed_ms(t0)
        log_llm_call(request_id, org_id, user_dept, task, model_key, model_id,
                     prompt, answer, usage, latency)
    except Exception as e:
        latency = elapsed_ms(t0)
        err = str(e)
        log_llm_call(request_id, org_id, user_dept, task, model_key, model_id,
                     prompt, None, None, latency, error=err)
        raise
    out = {
        "task": task, "model": model_key, "model_id": model_id,
        "answer": answer, "mode": "harness-groq+localpg",
        "request_id": request_id, "org_id": org_id,
        "grounded": grounded, "general_knowledge": general_knowledge if retrieve else True,
        "evidence": evidence if retrieve else [],
        "search_queries": search_queries if retrieve else [],
        "tool_used": tool_used,
        "tool_trace": tool_trace,
        "judge": judge_out,
    }
    return out


def get_router_info():
    return _registry["router"]
