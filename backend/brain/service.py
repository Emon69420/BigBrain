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
        # --- 4-stage pipeline: selector -> builder -> caller (smart, no half-built) ---
        if decision in ("tool_only","docs_plus_tool"):
            tool_task_obj = judge_out.get("tool_task") or {"purpose": text, "inputs": {}}
            # normalize: judge may return string for backward compat
            if isinstance(tool_task_obj, str):
                tool_task_obj = {"purpose": tool_task_obj, "inputs": {}}
            tool_task_str = tool_task_obj.get("purpose", text)
            try:
                from brain.selector import select as select_fn
                from tools.builder import ensure_tool
                from tools.runner import run_tool
                from tools.factory import list_registry as _list
                # 1) selector decides sufficient/partial/none
                sel = select_fn(tool_task_obj, _list())
                tool_trace.append(f"selector: {sel.get('verdict')} selected {len(sel.get('selected',[]))} missing {len(sel.get('missing',[]))}")
                # 2) build missing (exactly those not covered)
                built = []
                for miss in sel.get("missing", []):
                    purpose = miss.get("purpose") or miss.get("task") or tool_task_str
                    inputs = miss.get("inputs", {})
                    t_res = ensure_tool(purpose, sample_input=inputs if inputs else None, created_by="auto", org_id=org_id)
                    tool_trace.extend(t_res.get("trace", []))
                    if t_res.get("entry"):
                        built.append(t_res["entry"])
                    else:
                        tool_trace.append(f"build failed for {purpose}: {t_res.get('error')}")
                # 3) caller: run selected (existing) + built (new) — deterministic, no half-built
                # for sufficient: run the selected single (or chain if multiple)
                to_run = sel.get("selected", [])
                # if selector said sufficient with one tool, run it; if chain (multiple), run via execute_chain
                if len(to_run) == 1 and not built:
                    # single exact hit reuse
                    entry = next((t for t in _list() if t["name"]==to_run[0].get("tool")), None)
                    if entry:
                        # extract args from judge inputs + arg_map
                        arg_map = to_run[0].get("arg_map", {})
                        args = {}
                        for tool_arg, input_key in (arg_map or {}).items():
                            if input_key in (tool_task_obj.get("inputs",{}) or {}):
                                args[tool_arg] = tool_task_obj["inputs"][input_key]
                        if not args:
                            # fallback: ask LLM to map correctly using full_desc
                            try:
                                full = entry.get("full_desc","")
                                ap = f"Tool {entry['name']} expects:\n{full}\nInputs available: {tool_task_obj.get('inputs',{})}\nReturn JSON with exact tool arg names. Return JSON only."
                                raw,_ = _brain.chat_full("groq-slm", [{"role":"user","content":ap}])
                                import json, re; m=re.search(r"\{.*\}", raw, re.S)
                                if m: args=json.loads(m.group(0))
                            except: args = tool_task_obj.get("inputs",{})
                        run_res = run_tool(entry["name"], args)
                        newly = False
                        if run_res.get("ok"):
                            tool_used = {"name": entry["name"], "hit": True, "uses": entry.get("uses",0), "result": run_res.get("stdout") or str(run_res.get("result")), "decision":decision, "newly_created": newly}
                            evidence = [{"content": f"Tool {entry['name']} result: {tool_used['result']}", "doc_id": entry["name"], "title": f"tool:{entry['name']}", "dept": user_dept, "class": "open", "distance": 0.0, "tool": True, "newly_created": newly}] + evidence
                        else:
                            tool_used = {"name": entry["name"], "error": run_res.get("error"), "hit": True, "decision":decision, "newly_created": newly}
                elif to_run or built:
                    # chain or multiple: use execute_chain with built tools included
                    # build a step list from selector + built
                    steps = []
                    for s in to_run:
                        steps.append({"tool": s.get("tool"), "args": {k: tool_task_obj.get("inputs",{}).get(v, v) for k,v in (s.get("arg_map") or {}).items()}})
                    # append built as final steps if any
                    for b in built:
                        # try to run built with original inputs
                        steps.append({"tool": b["name"], "args": tool_task_obj.get("inputs",{})})
                    if not steps and built:
                        steps = [{"tool": built[0]["name"], "args": tool_task_obj.get("inputs",{})}]
                    if steps:
                        from tools.factory import execute_chain
                        exec_res = execute_chain(steps, initial_args=tool_task_obj.get("inputs",{}))
                        tool_trace.extend(exec_res.get("trace", []))
                        if exec_res.get("ok"):
                            names = " -> ".join(s["tool"] for s in steps)
                            # newly_created if any built in chain
                            newly_chain = len(built) > 0
                            tool_used = {"name": names, "hit": len(built)==0, "uses": 0, "result": str(exec_res["result"]), "decision":decision, "chain": len(steps)>1, "newly_created": newly_chain}
                            evidence = [{"content": f"Tool chain {names} result: {tool_used['result']}", "doc_id": steps[-1]["tool"], "title": f"tool:{steps[-1]['tool']}", "dept": user_dept, "class": "open", "distance": 0.0, "tool": True, "chain": len(steps)>1, "newly_created": newly_chain}] + evidence
                        else:
                            tool_trace.append(f"chain exec failed: {exec_res.get('error')}")
                # fallback: if nothing selected/built but we have a built single (none case)
                if not tool_used and built:
                    # single newly built tool not yet run (selector none case)
                    entry = built[0]
                    args = tool_task_obj.get("inputs",{})
                    run_res = run_tool(entry["name"], args)
                    if run_res.get("ok"):
                        tool_used = {"name": entry["name"], "hit": False, "uses": 0, "result": run_res.get("stdout") or str(run_res.get("result")), "decision":decision, "newly_created": True}
                        evidence = [{"content": f"Tool {entry['name']} result: {tool_used['result']}", "doc_id": entry["name"], "title": f"tool:{entry['name']}", "dept": user_dept, "class": "open", "distance": 0.0, "tool": True, "newly_created": True}] + evidence
                if not tool_used and not built and not to_run:
                    # selector said none but builder failed — ensure one full tool as last resort
                    t_res = ensure_tool(tool_task_str, sample_input=tool_task_obj.get("inputs"), created_by="auto", org_id=org_id)
                    tool_trace.extend(t_res.get("trace", []))
                    entry = t_res.get("entry")
                    if entry:
                        args = tool_task_obj.get("inputs",{})
                        run_res = run_tool(entry["name"], args)
                        newly = not t_res.get("hit", False)
                        if run_res.get("ok"):
                            tool_used = {"name": entry["name"], "hit": t_res.get("hit", False), "uses": entry.get("uses",0), "result": run_res.get("stdout") or str(run_res.get("result")), "decision":decision, "newly_created": newly}
                            evidence = [{"content": f"Tool {entry['name']} result: {tool_used['result']}", "doc_id": entry["name"], "title": f"tool:{entry['name']}", "dept": user_dept, "class": "open", "distance": 0.0, "tool": True, "newly_created": newly}] + evidence
            except Exception as e:
                import traceback; tool_trace.append(f"tool pipeline failed: {e} {traceback.format_exc()[:200]}")
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
