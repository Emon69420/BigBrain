"""Brain service — reusable business logic. Routes call this, never Groq directly."""
from config import load_registry
from brain.groq_provider import GroqBrain
from brain.prompts import build_rag_prompt
from utils.observability import new_request_id, log_llm_call, timed, elapsed_ms

_registry = load_registry()
_brain = GroqBrain(_registry)


def _resolve_tool_args(entry_name, inputs, text, arg_map=None, tool_trace=None):
    """Map judge inputs (+query units) onto the tool's exact params. Placeholders pass through. Never invents values."""
    import inspect
    import re as _re2
    from tools.factory import load_tool, map_args_by_unit
    try:
        expected = list(inspect.signature(load_tool(entry_name).main).parameters.keys())
    except Exception:
        return dict(inputs or {})
    inputs = inputs or {}

    def _toks(s):
        return set(_re2.findall(r"[a-z0-9]+", str(s).lower()))

    args = {}
    for tool_arg, input_key in (arg_map or {}).items():
        exp_match = next((e for e in expected if e == tool_arg or e.split("_")[0] == tool_arg or tool_arg in e), tool_arg)
        if isinstance(input_key, str) and input_key.startswith("__from:"):
            args[exp_match] = input_key
        elif input_key in inputs:
            args[exp_match] = inputs[input_key]
        elif tool_arg in inputs:
            args[exp_match] = inputs[tool_arg]
    for exp in expected:
        if exp not in args:
            et = _toks(exp)
            best_k, best_s = None, 0
            for k, v in inputs.items():
                if isinstance(v, str) and v.startswith("__from:"):
                    continue
                kt = _toks(k)
                inter = len(et & kt)
                if inter > best_s:
                    best_s, best_k = inter, k
            if best_k and (best_s >= 2 or best_s >= len(et) / 2 or best_s >= len(_toks(best_k)) / 2):
                args[exp] = inputs[best_k]
    still = [e for e in expected if e not in args]
    if still:
        try:
            mapped = map_args_by_unit(text, expected)
            for e in still:
                if e in mapped:
                    args[e] = mapped[e]
                    if tool_trace is not None:
                        tool_trace.append(f"unit-mapped {e}={mapped[e]}")
        except Exception as _ue:
            if tool_trace is not None:
                tool_trace.append(f"unit-map failed: {_ue}")
    return args


def _satisfiable(entry_name, args):
    """All required main() params covered by args? Returns (ok, missing_list). Defaults count as covered."""
    import inspect
    from tools.factory import load_tool
    try:
        sig = inspect.signature(load_tool(entry_name).main)
    except Exception as e:
        return False, [f"load-failed: {e}"]
    missing = [p.name for p in sig.parameters.values()
               if p.default is inspect.Parameter.empty
               and p.kind in (inspect.Parameter.POSITIONAL_OR_KEYWORD, inspect.Parameter.KEYWORD_ONLY)
               and p.name not in (args or {})]
    return (len(missing) == 0), missing


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
    decision = "general"
    redteam_out = {"verdict": "pass", "findings": []}
    # --- dashboard-maker builder pre-check: template replies, no LLM call ---
    try:
        from brain.boards import handle_builder as _board_builder
        _bhit = _board_builder(text, org_id)
    except Exception as _be:
        tool_trace.append(f"builder pre-check failed open: {_be}")
        _bhit = None
    if _bhit:
        _banswer, _bjudge, _bevidence, _btrace = _bhit
        tool_trace.extend(_btrace)
        _bred = {"verdict": "pass", "findings": [],
                 "note": "builder template: echoes user labels + DB state, no claims",
                 "regenerated": False, "rejected_draft": None}
        _did = None
        try:
            from brain.decision import record_decision as _rec
            _did = _rec(request_id, org_id, text, task, model_key, model_id,
                        _bevidence, None, _bred, _bjudge)
            if _did:
                tool_trace.append(f"decision: {_did}")
        except Exception as _de:
            tool_trace.append(f"decision record failed open: {_de}")
        return {
            "task": task, "model": model_key, "model_id": model_id,
            "answer": _banswer, "mode": "harness-groq+localpg",
            "request_id": request_id, "org_id": org_id,
            "grounded": True, "general_knowledge": False,
            "evidence": _bevidence,
            "search_queries": [text],
            "tool_used": None,
            "tool_trace": tool_trace,
            "judge": _bjudge,
            "redteam": _bred,
            "decision_id": _did,
        }
    if retrieve:
        try:
            from data.service import hybrid_search
            evidence = hybrid_search(text, user_dept, limit=5, org_id=org_id, queries=[text])
        except Exception:
            evidence = []
        # --- dashboard reader: attach latest board values for value questions ---
        try:
            from brain.boards import handle_board_reader as _board_reader
            _bev, _btrace = _board_reader(text, org_id)
            if _bev:
                evidence = list(evidence) + _bev
                tool_trace.append(_btrace)
        except Exception as _be2:
            tool_trace.append(f"board reader failed open: {_be2}")
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
            # deterministic input repair: judge gave no inputs but query has quantities
            if not (tool_task_obj.get("inputs") or {}):
                try:
                    from tools.factory import extract_inputs as _extract_inputs
                    _rep = _extract_inputs(text)
                    if _rep:
                        tool_task_obj["inputs"] = _rep
                        tool_trace.append(f"inputs repaired deterministically: {sorted(_rep.keys())}")
                except Exception as _ex:
                    tool_trace.append(f"input repair failed: {_ex}")
            try:
                from brain.selector import select as select_fn
                from tools.builder import ensure_tool
                from tools.runner import run_tool
                from tools.factory import list_registry as _list
                # 1) selector decides sufficient/partial/none
                sel = select_fn(tool_task_obj, _list())
                tool_trace.append(f"selector: {sel.get('verdict')} selected {len(sel.get('selected',[]))} missing {len(sel.get('missing',[]))}")
                # 2) build missing — separate reused (hit) vs truly built
                built = []
                reused = []
                for miss in sel.get("missing", []):
                    purpose = miss.get("purpose") or miss.get("task") or tool_task_str
                    if not (purpose or "").strip():
                        tool_trace.append("skip empty missing-purpose (no junk builds)")
                        continue
                    inputs = miss.get("inputs", {})
                    t_res = ensure_tool(purpose, sample_input=inputs if inputs else None, created_by="auto", org_id=org_id)
                    tool_trace.extend(t_res.get("trace", []))
                    if t_res.get("entry"):
                        if t_res.get("hit"):
                            reused.append(t_res["entry"])
                            tool_trace.append(f"reused {t_res['entry']['name']} (0 rebuild)")
                        else:
                            built.append(t_res["entry"])
                    else:
                        tool_trace.append(f"build failed for {purpose}: {t_res.get('error')}")
                # 3) caller: run selected (existing) + built (new) — deterministic, no half-built
                # for sufficient: run the selected single (or chain if multiple)
                to_run = sel.get("selected", [])
                consumed = set()  # each tool executes at most once per question
                needs_exact = False  # set when chain skipped for unsatisfiable args -> last-resort exact build
                rejected = set()  # tools proven unsatisfiable for this question — never re-pick or re-run
                # if selector said sufficient with one tool, run it; if chain (multiple), run via execute_chain
                if len(to_run) == 1 and not built:
                    entry = next((t for t in _list() if t["name"]==to_run[0].get("tool")), None)
                    if entry:
                        inputs = tool_task_obj.get("inputs", {}) or {}
                        args = _resolve_tool_args(entry["name"], inputs, text, to_run[0].get("arg_map"), tool_trace)
                        if not args:
                            args = inputs
                        was_hit = True
                        rebuilt_exact = False
                        ok_sat, missing_sat = _satisfiable(entry["name"], args)
                        if not ok_sat:
                            tool_trace.append(f"gate: {entry['name']} missing {missing_sat} -> exact build instead")
                            rejected.add(entry["name"])
                            run_res = {"ok": False, "error": f"missing args {missing_sat}"}
                        elif entry["name"] in consumed:
                            tool_trace.append(f"skip dup run: {entry['name']}")
                            run_res = {"ok": False, "error": "duplicate-run-skipped"}
                        else:
                            consumed.add(entry["name"])
                            run_res = run_tool(entry["name"], args)
                        if (not run_res.get("ok")) and inputs and any(s in str(run_res.get("error", "")).lower() for s in ("missing", "unexpected keyword", "positional argument")):
                            # arg mismatch -> build one exact tool for frozen inputs, run once
                            try:
                                t2 = ensure_tool(f"{tool_task_str} [exact args {sorted(inputs.keys())}]", sample_input=inputs, created_by="auto", org_id=org_id, exclude=rejected)
                                tool_trace.extend(t2.get("trace", []))
                                if t2.get("entry") and not t2.get("hit"):
                                    r2 = run_tool(t2["entry"]["name"], inputs)
                                    if r2.get("ok"):
                                        run_res = r2
                                        entry = t2["entry"]
                                        rebuilt_exact = True
                                        was_hit = False
                                        tool_trace.append(f"rebuilt exact: {entry['name']}")
                            except Exception as e2:
                                tool_trace.append(f"rebuild fallback failed: {e2}")
                        # reject empty-args success (tool with defaults that hides missing inputs)
                        if run_res.get("ok") and not args:
                            try:
                                sig2 = __import__('inspect').signature(__import__('tools.factory', fromlist=['load_tool']).load_tool(entry["name"]).main)
                                if len(sig2.parameters) > 0:
                                    run_res = {"ok": False, "error": "tool ran without inputs but requires params — not trusted"}
                            except: pass
                        newly = rebuilt_exact
                        if run_res.get("ok"):
                            tool_used = {"name": entry["name"], "hit": was_hit, "uses": entry.get("uses",0), "result": run_res.get("stdout") or str(run_res.get("result")), "decision":decision, "newly_created": newly}
                            evidence = [{"content": f"Tool {entry['name']} result: {tool_used['result']}", "doc_id": entry["name"], "title": f"tool:{entry['name']}", "dept": user_dept, "class": "open", "distance": 0.0, "tool": True, "newly_created": newly}] + evidence
                        else:
                            tool_used = {"name": entry["name"], "error": run_res.get("error"), "hit": was_hit, "decision":decision, "newly_created": newly}
                elif to_run or built or reused:
                    # chain or multiple: use execute_chain with built tools included
                    # build a step list from selector + built
                    steps = []
                    for s in to_run:
                        steps.append({"tool": s.get("tool"), "args": _resolve_tool_args(s.get("tool"), tool_task_obj.get("inputs",{}), text, s.get("arg_map"), tool_trace)})
                    # append built as final steps if any
                    for b in built:
                        steps.append({"tool": b["name"], "args": tool_task_obj.get("inputs",{})})
                    for r in reused:
                        if not any(s["tool"]==r["name"] for s in steps):
                            steps.append({"tool": r["name"], "args": tool_task_obj.get("inputs",{})})
                    # each tool executes at most once per question
                    steps = [s for s in steps if s["tool"] not in consumed]
                    if not steps and built:
                        steps = [{"tool": built[0]["name"], "args": tool_task_obj.get("inputs",{})}]
                    # satisfaction gate per step (same fill rule execute_chain uses: step args + initial)
                    merged_initial = tool_task_obj.get("inputs", {}) or {}
                    bad_steps = []
                    for s in steps:
                        sargs = s.get("args", {}) or {}
                        flow_fed = {k for k, v in sargs.items() if isinstance(v, str) and v.startswith("__from:")}
                        marg = dict(merged_initial)
                        marg.update({k: v for k, v in sargs.items() if k not in flow_fed})
                        ok_sat, missing_sat = _satisfiable(s["tool"], marg)
                        missing_sat = [m for m in missing_sat if m not in flow_fed]
                        if missing_sat:
                            bad_steps.append((s["tool"], missing_sat))
                    if bad_steps:
                        tool_trace.append(f"chain skipped, unsatisfiable: {bad_steps} -> exact build instead")
                        needs_exact = True
                        for _bn, _ in bad_steps:
                            rejected.add(_bn)
                    else:
                        for s in steps:
                            consumed.add(s["tool"])
                    if steps and not bad_steps:
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
                    if entry["name"] in consumed:
                        tool_trace.append(f"skip dup run: {entry['name']}")
                        run_res = {"ok": False, "error": "duplicate-run-skipped"}
                    else:
                        consumed.add(entry["name"])
                        run_res = run_tool(entry["name"], args)
                        if run_res.get("ok") and not args:
                            try:
                                import inspect as _insp3
                                sig4 = _insp3.signature(__import__('tools.factory', fromlist=['load_tool']).load_tool(entry["name"]).main)
                                if len(sig4.parameters) > 0:
                                    run_res = {"ok": False, "error": "tool ran without inputs but requires params — not trusted"}
                            except: pass
                    if run_res.get("ok"):
                        tool_used = {"name": entry["name"], "hit": False, "uses": 0, "result": run_res.get("stdout") or str(run_res.get("result")), "decision":decision, "newly_created": True}
                        evidence = [{"content": f"Tool {entry['name']} result: {tool_used['result']}", "doc_id": entry["name"], "title": f"tool:{entry['name']}", "dept": user_dept, "class": "open", "distance": 0.0, "tool": True, "newly_created": True}] + evidence
                if not tool_used and (not built and not to_run and not reused or needs_exact):
                    # nothing ran (or chain skipped for unsatisfiable args) — ensure one full tool as last resort
                    # rejected tools are excluded so the gate cannot be re-hit by the same wrong tool
                    t_res = ensure_tool(tool_task_str, sample_input=tool_task_obj.get("inputs"), created_by="auto", org_id=org_id, exclude=rejected)
                    tool_trace.extend(t_res.get("trace", []))
                    entry = t_res.get("entry")
                    if entry:
                        args = tool_task_obj.get("inputs",{})
                        if entry["name"] in consumed:
                            tool_trace.append(f"skip dup run: {entry['name']}")
                            run_res = {"ok": False, "error": "duplicate-run-skipped"}
                        else:
                            consumed.add(entry["name"])
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
    # --- red team: adversarial review of the drafted answer, then flag-and-deliver ---
    redteam_out = {"verdict": "pass", "findings": [], "regenerated": False, "rejected_draft": None}
    try:
        from brain.redteam import review as redteam_review
        redteam_out = redteam_review(answer, evidence, tool_used, decision, org_id, question=text)
        redteam_out.setdefault("regenerated", False)
        redteam_out.setdefault("rejected_draft", None)
        tool_trace.append(f"redteam: {redteam_out['verdict']} ({len(redteam_out['findings'])} findings)")
        if redteam_out["verdict"] == "fail":
            # ONE bounded regenerate with findings injected, then deliver flagged whatever results
            redteam_out["rejected_draft"] = answer[:300]
            try:
                fix_prompt = (prompt + "\n\nRED TEAM REJECTED your draft for these reasons:\n- "
                              + "\n- ".join(redteam_out["findings"][:6])
                              + "\nFix every finding or explicitly mark the claim unverified. Answer again:")
                t1 = timed()
                answer2, usage2 = _brain.chat_full(model_key, [{"role": "user", "content": fix_prompt}])
                log_llm_call(request_id, org_id, user_dept, task, model_key, model_id,
                             fix_prompt, answer2, usage2, elapsed_ms(t1))
                answer = answer2
                redteam_out["regenerated"] = True
                tool_trace.append("redteam: regenerated once with findings injected")
            except Exception as e2:
                tool_trace.append(f"redteam regenerate failed: {e2} — delivering flagged original")
    except Exception as e3:
        tool_trace.append(f"redteam harness failed open: {e3}")
        redteam_out = {"verdict": "flag", "findings": [f"red-team unavailable: {e3}"], "regenerated": False, "rejected_draft": None}
    # --- decision DNA: persist one queryable row per answer (fail-open, never blocks) ---
    decision_id = None
    try:
        from brain.decision import record_decision
        decision_id = record_decision(
            request_id, org_id, text, task, model_key, model_id,
            evidence, tool_used, redteam_out, judge_out,
        )
        if decision_id:
            tool_trace.append(f"decision: {decision_id}")
    except Exception as e4:
        tool_trace.append(f"decision record failed open: {e4}")
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
        "redteam": redteam_out,
        "decision_id": decision_id,
    }
    return out


def get_router_info():
    return _registry["router"]
