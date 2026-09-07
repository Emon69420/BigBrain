# Sovereign Industrial AI Workbench — Revised Technical Specification

**Version:** 2.0 — SIH 2026 MVP

## 1. Executive Summary

The Sovereign Industrial AI Workbench is a self-hosted AI platform for PSUs, refineries, defence-linked manufacturing units and government organizations handling confidential operational knowledge.

The core architecture is **tiered local intelligence**:

- **SLM (1–3B, quantized):** fast classification, extraction, short factual answers and lightweight routing.
- **LLM (7–14B, quantized):** multi-step reasoning, synthesis, drafting and high-value analysis.
- **Local VLM:** scanned documents, handwriting, photographs and P&ID/engineering-drawing understanding.

A **Model Router** selects the appropriate model based on task type, complexity and safety. **LangChain + LangGraph** orchestrate multi-step agents and local tools. Internal SOPs, manuals, reports and correspondence are retrieved through local RAG. Python calculations run inside a Docker sandbox.

High-impact outputs pass through a **Red-Team Agent** and, where required, a **Human Approval Gate**.

A live **Network Kill-Switch Dashboard** demonstrates that unauthorized external requests are blocked, providing visible proof of the sovereignty claim.

> **The product is not a private chatbot. It is a sovereign, auditable AI worker that uses the right local model for the right job.**

---

# 2. Problem

Industrial organizations perform large volumes of sensitive knowledge work:

- Approval notes
- Inspection reports
- SOP/manual lookup
- Engineering calculations
- Internal correspondence
- Spreadsheet analysis
- Internal code
- Scanned and handwritten documents
- P&IDs and engineering drawings

Public cloud AI may be prohibited for this information. Manual processing is safe but slow.

The workbench provides:

**Local AI + Agentic Automation + Internal RAG + Multimodal Understanding + Verifiable Security**

without requiring confidential data to be sent to external AI APIs.

---

# 3. Requirements Mapping

| Requirement | Solution |
|---|---|
| Sovereign / air-gapped AI | Local inference + egress controls |
| Multiple open-weight models | Model Registry + Router |
| Automatic model selection | Task + complexity routing |
| Mid-range GPU | Quantized SLM + LLM |
| Agentic behavior | LangGraph |
| Internal knowledge | Local RAG |
| Scanned PDFs | OCR + VLM |
| Handwriting | OCR/VLM |
| P&ID understanding | Local VLM + diagram-aware extraction |
| Code execution | Docker sandbox |
| Calculations | Sandboxed Python |
| Spreadsheet work | Python spreadsheet tools |
| Real deliverables | DOCX + XLSX/PPTX |
| Self-checking | Red-Team Agent |
| Human control | Approval gates |
| Proof of sovereignty | Live blocked-egress monitor |

---

# 4. High-Level Architecture

```text
┌────────────────────────────────────────────────────────────┐
│                       NEXT.JS UI                           │
│ Chat | Files | Agent Trace | Security | Audit | Approvals │
└────────────────────────────┬───────────────────────────────┘
                             ↓
┌────────────────────────────────────────────────────────────┐
│                         FASTAPI                            │
│ Auth | API | Tasks | Documents | Workflows | Audit        │
└────────────────────────────┬───────────────────────────────┘
                             ↓
┌────────────────────────────────────────────────────────────┐
│                   LANGCHAIN + LANGGRAPH                    │
│                  Supervisor / Agent Graph                  │
└────────────────────────────┬───────────────────────────────┘
                             ↓
                    ┌─────────────────┐
                    │  MODEL ROUTER   │
                    │ Task + Risk +   │
                    │ Complexity      │
                    └───────┬─────────┘
                            │
          ┌─────────────────┼─────────────────┐
          ↓                 ↓                 ↓
       ┌──────┐          ┌──────┐          ┌──────┐
       │ SLM  │          │ LLM  │          │ VLM  │
       │1–3B  │          │7–14B │          │Vision│
       └──────┘          └──────┘          └──────┘
          │                 │                 │
          └─────────────────┼─────────────────┘
                            ↓
                 ┌─────────────────────┐
                 │ Local Tool Layer    │
                 │ RAG | Files | Python│
                 │ Excel | DOCX | Calc │
                 └──────────┬──────────┘
                            ↓
                 ┌─────────────────────┐
                 │ PostgreSQL          │
                 │ Metadata | Chunks   │
                 │ Embeddings | Audit  │
                 └─────────────────────┘

        SECURITY: Egress Firewall + Docker Isolation
```

---

# 5. Technology Stack

### Frontend
- Next.js

### Backend
- Python
- FastAPI

### Agent Orchestration
- LangChain
- LangGraph

### Primary LLM
- Sarvam open-weight model
- vLLM for local serving

### SLM
- 1–3B quantized local model
- Exact model selected after GPU benchmarking

### Vision
- Local open-weight VLM
- Qwen2-VL/InternVL-class implementation may be evaluated for the prototype

### Embeddings
- Sentence Transformers

### Reranking
- Clash Rerank, subject to confirmation that the chosen implementation is self-hostable
- If not, replace with a verified local/open reranker before deployment

### Database
- PostgreSQL

### Document Generation
- python-docx
- openpyxl
- python-pptx

### Sandbox
- Docker

### Authentication
- Lightweight custom organization-specific authentication/RBAC for the prototype

### Deployment
- Organization-controlled GPU server/workstation
- Or approved IndiaAI-associated cloud infrastructure

---

# 6. SLM + LLM Hybrid Architecture

The hybrid model design is a core part of the Model Router.

Most industrial interactions are not deep reasoning tasks.

Examples:

```text
"What is the P-204 tag?"
"Extract equipment IDs."
"What is the inspection interval?"
"Classify this request."
```

These go to the SLM.

Complex tasks go to the larger model:

```text
"Compare three inspection reports and draft an approval note."
"Determine whether repair or replacement is justified."
"Analyze multiple documents and produce a recommendation."
```

### Routing principle

```text
Simple → SLM
Complex → LLM
Vision → VLM
Numeric calculation → Python sandbox
```

This reduces latency and GPU usage while preserving stronger reasoning for tasks that need it.

---

# 7. Model Router

The router determines:

1. Task type
2. Complexity
3. Risk level
4. Required modality
5. Appropriate model

### Task taxonomy

- General/factual
- Extraction
- Document summarization
- Drafting
- Coding
- Vision/OCR/P&ID
- Calculation
- Multi-document reasoning

### Example

| Task | Route |
|---|---|
| Extract P-204 | SLM |
| Short SOP lookup | SLM |
| Multi-document summary | LLM |
| Approval-note drafting | LLM |
| Coding + testing | LLM + sandbox |
| P&ID understanding | VLM |
| Engineering calculation | LLM + Python |
| High-risk recommendation | LLM + RAG + Red Team |

### Safety override

The router must not optimize only for speed.

Anything involving engineering recommendations, approval notes, safety or high-impact decisions is escalated to the LLM and appropriate validation regardless of the initial SLM classification.

---

# 8. GPU Strategy

The target is a single mid-range GPU.

Recommended prototype configuration:

```text
SLM: 1–3B, 4-bit quantized
LLM: 7–14B, 4-bit quantized
VLM: loaded on demand
```

If the SLM and LLM fit simultaneously, both can remain resident.

If they do not, the system can load/swap the larger model when required.

The prototype should record:

- VRAM usage
- Model load time
- Inference latency
- Tokens/sec
- Selected model
- Task category

This turns the routing strategy into a measurable engineering decision.

---

# 9. Hot-Swappable Model Registry

Models must be configuration-driven rather than hard-coded.

Example:

```yaml
models:
  - name: sarvam-main
    type: llm
    tasks: [reasoning, drafting, summarization]

  - name: local-small
    type: slm
    tasks: [classification, extraction, short-answer]

  - name: local-vision
    type: vlm
    tasks: [vision, ocr, pid]
```

Adding a model should require registration and benchmarking, not redesign of the application.

A stretch demo can show a new model being registered without changing agent code.

---

# 10. Local RAG

Organization documents form the private knowledge base:

- SOPs
- Manuals
- Inspection reports
- Internal correspondence
- Past approvals
- Engineering documents

Pipeline:

```text
Documents
 ↓
Parsing / OCR
 ↓
Chunking
 ↓
Sentence Transformers
 ↓
PostgreSQL
 ↓
Retriever
 ↓
Reranker
 ↓
Evidence
 ↓
LLM
```

Each retrieved item preserves:

- Document ID
- Page/section
- Version
- Department
- Classification
- Approval status

Retrieval is permission-aware; users must never receive documents outside their authorization.

---

# 11. Multimodal P&ID / Engineering Drawing Understanding

The system must go beyond plain OCR.

It should demonstrate extraction of:

- Equipment tags
- Line identifiers
- Instrument tags
- Valve labels
- Text annotations
- Approximate relationships

Example:

```text
P-204
 ↓
L-204A
 ↓
V-17
 ↓
PT-204
```

The original image should be displayed alongside extracted entities.

The MVP does not need CAD-grade diagram reconstruction. Correctly identifying several tags and relationships from a realistic P&ID is sufficient to demonstrate the capability.

---

# 12. Handwritten / Scanned Document Pipeline

```text
Scan / Photo
    ↓
Document type detection
    ↓
OCR / VLM
    ↓
Structured findings
    ↓
RAG
    ↓
Agent
```

Uncertain recognition must remain visible.

Example:

```text
Equipment: P-204       ✓
Temperature: 87°C      ✓
Cause: "bearing ???"   ⚠ Verify
```

The system must not turn uncertain handwriting into false certainty.

---

# 13. Agentic Workflow

LangGraph maintains task state and executes multiple steps.

```text
START
 ↓
Understand task
 ↓
Security classification
 ↓
Model routing
 ↓
Plan
 ↓
Retrieve evidence
 ↓
Use tools
 ↓
Reason / draft
 ↓
Validate
 ↓
Red Team
 ↓
Risk check
 ↓
Human approval?
 ├── No → Finalize
 └── Yes → Wait → Approve → Finalize
```

This is visible through the Agent Trace UI.

---

# 14. Local Tools

### File tools
- Read
- Write
- Search
- List

### Document tools
- PDF parsing
- OCR
- Document comparison
- DOCX generation

### Calculation tools
- Python
- NumPy
- Pandas
- Domain formulas

### Spreadsheet tools
- Read XLSX
- Modify XLSX
- Generate analysis

### Internal search
- RAG
- Metadata filtering
- Evidence lookup

---

# 15. Sandboxed Code Execution

The LLM never executes arbitrary code directly on the host.

```text
Task
 ↓
LLM writes Python
 ↓
Docker sandbox
 ↓
Execute
 ↓
Capture stdout/stderr
 ↓
Validate
 ↓
Return code + steps + result
```

Sandbox controls:

- No external network
- CPU limit
- Memory limit
- Execution timeout
- Restricted filesystem
- Controlled package set

This is especially important for engineering calculations because the numerical result comes from actual execution rather than next-token prediction.

---

# 16. Real Deliverables

The prototype produces real files, not only chat text.

### DOCX
- Approval notes
- Inspection summaries
- Recommendations

### XLSX
- Calculations
- Inspection tables
- Data analysis

### PPTX
- Management summaries
- Decision briefings

Where appropriate, generated outputs should include evidence references and Decision DNA IDs.

---

# 17. Agentic Trace UI

The frontend should stream the agent's actual execution:

```text
✓ Reading inspection report
✓ Extracting equipment tags
✓ Searching SOP-17
✓ Retrieved 4 evidence sections
✓ Searching previous inspection records
✓ Running calculation
→ Drafting approval note
→ Red Team review
→ Awaiting human approval
```

This provides direct visual proof of agentic behavior.

---

# 18. AI Red Team

The Red Team is a separate reasoning pass whose goal is to find why the primary recommendation could be wrong.

Primary agent:

> Recommend replacing P-204.

Red Team checks:

- Unsupported claims
- Missing evidence
- Outdated documents
- Superseded SOPs
- Contradictory evidence
- Calculation errors
- Unverified assumptions

Example:

```text
RED TEAM

⚠ Vendor quote is outdated
⚠ Current SOP version not used
⚠ Failure cause is unconfirmed

→ HUMAN VERIFICATION REQUIRED
```

The Red Team is mandatory for high-risk outputs.

---

# 19. Human Approval Gate

Risk tiers:

```text
LOW
Search / extraction / summarization

MEDIUM
Analysis / drafting

HIGH
Engineering recommendation / approval note

CRITICAL
Irreversible or externally consequential action
```

High and critical actions cannot be finalized without human approval.

---

# 20. Decision DNA

Decision DNA is kept lightweight for the MVP.

For every important decision:

```text
Decision ID
 ↓
Source documents
 ↓
Retrieved evidence
 ↓
Model used
 ↓
Tools used
 ↓
Recommendation
 ↓
Red Team findings
 ↓
Human approval
```

This allows a user to later answer:

> "Why was this decision made?"

without searching through an entire chat history.

---

# 21. Live Network Kill-Switch

This is a mandatory SIH demonstration.

Dashboard:

```text
SECURITY MONITOR

External Requests       0
External AI APIs        0
External DNS            0
Blocked Egress          1
Local Model Calls       47

STATUS: SOVEREIGN ✓
```

### Live demo sequence

1. Run a normal local workflow.
2. Show zero external requests.
3. Trigger an intentional external URL/API request.
4. Network policy blocks it.
5. Dashboard increments `Blocked Egress`.
6. Local workflow continues.

This makes the sovereignty claim visible and falsifiable.

---

# 22. Security Architecture

```text
User
 ↓
Authentication
 ↓
RBAC / Department Permissions
 ↓
Data Classification
 ↓
Permission-aware Retrieval
 ↓
Tool Permission Check
 ↓
Docker Isolation
 ↓
Network Egress Control
 ↓
Audit Logging
```

The frontend is not treated as the security boundary. Authorization is enforced by backend services.

---

# 23. Audit Logging

Important events are logged:

- Login
- Document access
- Classification
- Model routing
- Model invocation
- Retrieval
- Tool execution
- Sandbox execution
- Red Team
- Approval
- File generation
- Network block

Example:

```json
{
  "event_id": "EVT-19281",
  "event": "MODEL_ROUTED",
  "task_type": "document_drafting",
  "selected_model": "sarvam-main",
  "risk": "HIGH",
  "timestamp": "2026-08-25T19:12:21"
}
```

---

# 24. Recommended SIH Demo

The demo should map directly to the official requirements.

## Demo A — SLM Routing

Input:

> "What is the inspection interval in SOP-17?"

Display:

```text
LOW COMPLEXITY
→ SLM
→ Fast response
```

## Demo B — LLM Agent

Input:

> "Read these inspection reports and draft an approval note for P-204."

Display:

```text
HIGH COMPLEXITY
→ Sarvam LLM
→ RAG
→ Tool execution
→ Red Team
→ Human approval
```

## Demo C — P&ID

Upload a scanned P&ID.

Display:

```text
VLM
→ P-204
→ L-204A
→ V-17
→ PT-204
```

## Demo D — Engineering Calculation

Show:

```text
LLM → Python
     ↓
Docker Sandbox
     ↓
Intermediate steps
     ↓
Verified result
```

## Demo E — Sovereignty

Trigger external access:

```text
External Request
      ↓
BLOCKED
      ↓
Dashboard: Blocked Egress +1
```

---

# 25. MVP Priority

## P0 — Mandatory

1. Sarvam through vLLM
2. SLM + LLM model router
3. Local VLM
4. Internal RAG
5. LangGraph agent
6. Docker sandbox
7. Verified engineering calculation
8. DOCX generation
9. Live network kill-switch
10. Agent trace UI

## P1 — High-value

11. Red Team
12. Human approval
13. Audit timeline
14. XLSX/PPTX generation
15. Hot-swappable model registry
16. Regional-language interaction using Sarvam

## P2 — Roadmap

17. Institutional Memory Graph
18. Contradiction Detector
19. What Changed? Intelligence
20. Shadow Worker
21. Automation Red Team

These P2 features should not delay the core judged capabilities.

---

# 26. Success Criteria

The prototype is successful when a judge can visibly confirm:

- Two or more task types are automatically routed to appropriate local models.
- A scanned document is understood locally.
- A P&ID/engineering drawing demonstrates meaningful visual extraction.
- The agent performs multiple steps and uses tools.
- A calculation is actually executed in a sandbox.
- Internal documents ground the response.
- A real Word deliverable is generated.
- High-risk output receives Red-Team validation.
- Human approval is enforced.
- An external request is visibly blocked.
- The system records the complete execution trace.

---

# 27. Final Positioning

Do not pitch this as:

> **"A private ChatGPT."**

Pitch it as:

> **"A sovereign AI workbench that dynamically allocates local compute, understands confidential industrial documents, executes multi-step work, verifies its own outputs, and proves that organizational data never needs to leave the controlled environment."**

The architectural story is:

```text
RIGHT TASK
    ↓
RIGHT MODEL
    ↓
RIGHT TOOLS
    ↓
RIGHT EVIDENCE
    ↓
RED TEAM
    ↓
HUMAN CONTROL
    ↓
AUDITABLE OUTPUT
```

## One-line architecture

**Next.js → FastAPI → LangGraph → Model Router → SLM / Sarvam LLM / Local VLM → RAG + Tools → Red Team → Human Approval → Deliverables + Audit, protected by Docker isolation and a live network kill-switch.**
