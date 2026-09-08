# BigBrain — Design Spec
### Sovereign Industrial AI Workbench — Visual System v1

---

## 1. Theme in one sentence

**A dark, unlit control room with one visible source of intelligence** — a soft neural-vortex glow standing in for "the brain" — surrounded by quiet, high-legibility instrumentation. The reference site's mood (near-black canvas, serif headline, hairline outlined buttons, circular "agent" orbs, no drop-shadows, no rounded-card SaaS kit) carries over almost directly, because a defence/industrial workbench and a "quietly confident AI lab" landing page want the same thing: restraint, and one glowing focal point instead of ten.

The difference: the reference is a marketing page, read once, scrolling. BigBrain is a working console — chat, audit tables, live risk states — read for hours, scanned constantly. So the vortex graphic gets *demoted* from hero to ambient accent (login screen + sidebar mark only), and in exchange the system gains something the landing page never needed: a **status-color language** for risk tiers, groundedness, and sovereignty state, because in this product "the color of a badge" is a safety-relevant fact, not a style choice.

---

## 2. Implementation components (21st.dev)

Two reference components anchor this spec to real, drop-in code rather than description alone:

**Background — `interactive-neural-vortex-background`**
```
npx @21st-dev/cli add minhxthanh/interactive-neural-vortex-background
```
```tsx
import InteractiveNeuralVortex from "@/components/ui/interactive-neural-vortex-background";

const DemoOne = () => {
  return <InteractiveNeuralVortex />;
};
export { DemoOne };
```
This *is* `accent.vortex` — don't recreate the glow with a CSS radial-gradient; mount this component directly. Per §5a/§10, it is mounted **only** on the login screen and the landing page hero (§6), at low opacity, behind the centered headline. It should not be mounted anywhere in the main app shell (chat, trace, audit) — those screens only get the small, contained echo of it described in the Chat Area spec (§7), which is a lightweight CSS glow on the active task/reasoning step, not this component.

**Primary button — `sneaky-button` (Button06)**
```
npx @21st-dev/cli add nextjsshop/sneaky-button
```
```tsx
import Button06 from "@/components/ui/button-06"; // or wherever the CLI places it

export default function DemoOne() {
  return <Button06 />;
}
```
This is the concrete implementation of the "hairline outlined button" used throughout — landing page CTA, `Sign in`, `Run calculation`, `Approve`, `Send to Red Team`. Don't introduce a second button component for secondary actions — restyle this same one with reduced opacity/`text.muted` border for secondary actions (e.g. `Send back`, `Cancel`) rather than adding a filled or shadowed variant, to keep the "no SaaS card-kit" discipline from §1 intact at the component level, not just the page level.

---

## 3. Color tokens

| Token | Hex | Use |
|---|---|---|
| `bg.void` | `#08090C` | App canvas, sidebar, chat background |
| `bg.panel` | `#101218` | Cards, table rows, trace panel — one flat tone, no gradient, no shadow |
| `bg.raised` | `#171A22` | Modals, approval-gate drawer, hover state |
| `line.hairline` | `#2A2E38` | 1px dividers — replaces borders/shadows everywhere |
| `text.primary` | `#EDEEF2` | Headlines, primary content |
| `text.muted` | `#8A8F9C` | Metadata, timestamps, eyebrow labels |
| `accent.vortex` | `#6C6BFF → #A56CFF` (radial gradient) | The one glow: login screen, sidebar mark, "agent thinking" pulse — never used as a UI color, only as light |

**Status colors** (the system the reference doesn't need but BigBrain must have):

| State | Hex | Meaning |
|---|---|---|
| `risk.low` | `#4ADE80` | Search / extraction / summarization |
| `risk.medium` | `#FBBF24` | Analysis / drafting |
| `risk.high` | `#FB923C` | Engineering recommendation / approval note |
| `risk.critical` | `#F87171` | Irreversible / externally consequential |
| `state.sovereign` | `#4ADE80` | Kill-switch dashboard: 0 external calls |
| `state.blocked` | `#F87171` | Egress blocked event |
| `state.unverified` | `#EAB308` | Low-confidence OCR/handwriting token (the "⚠ Verify" case) |

Rule: status colors appear only as a **2px left-border, a small dot, or badge text** — never as a fill on a large surface. The canvas stays near-black regardless of risk level; only the badge changes. This is deliberate — a red panel every time something is "high risk" would train users to stop noticing it.

---

## 4. Typography

- **Display / headings:** a slab-serif or humanist serif with some presence — e.g. `Fraunces` or `Source Serif 4` — used only for page-level titles ("Agent Trace," "Audit Timeline," the login headline). Matches the reference's serif hero line; on BigBrain this reads as "considered, non-generic-SaaS" rather than decorative.
- **UI / body:** a clean grotesque — e.g. `Inter` or `IBM Plex Sans` — for everything users read quickly: chat text, table cells, buttons, nav.
- **Data / IDs:** `IBM Plex Mono` for anything that is literally data — event IDs, tag numbers (`P-204`, `L-204A`), Decision DNA IDs, timestamps. This is the one deliberate monospace use, and it's functional (these strings are copy-pasted, diffed, greppable) rather than decorative.
- Nav and small labels use **sentence case**, not tracked-out caps — the reference's "FEATURES / SHOWCASE / PRICING" caps styling is fine for a 5-item marketing nav; the app sidebar is only 4 items today (`Chat`, `Knowledge Base`, `Tools`, `Ingest`) but will grow as P1 features land (Security Monitor, Audit, Approvals per §9), so sentence case is the choice that stays legible whether the list is 4 items or 8.

---

## 5. Layout concepts

### 5a. Login / cold-start screen (the one place the vortex is the hero)

```
┌───────────────────────────────────────────┐
│                                    b [seal]│
│                                             │
│         (neural vortex glow, low-opacity,  │
│          centered, slow drift)             │
│                                             │
│         Sovereign Industrial AI Workbench  │
│         Your documents. Your GPU. No exit. │
│                                             │
│         [ ORG ID ]   [ SIGN IN → ]         │
└───────────────────────────────────────────┘
```
Center-aligned, exactly like the reference hero. This is the only screen allowed a big centered moment — everywhere else is left-aligned, dense, working-tool layout.

### 5b. Main app shell

This replaces the earlier generic three-column sketch with the shell as it actually exists today (per the uploaded screenshots): a fixed top bar, a two-part left sidebar (icon rail + text nav), the workspace content, and the same right context panel from the chat spec.

```
┌──┬──────────────────────────────────────────────────┬─────────────┐
│  │ BB  BigBrain    default ▾        WORKSPACE   ● grounded │      │
│  ├──────────────────────────────────────────────────┤             │
│ ▤│ Chat                                              │  CONTEXT    │
│ ▤│ Knowledge Base                                    │  PANEL      │
│ ▤│ Tools                                             │  Sources(n) │
│ ▤│ Ingest                                            │  Reasoning  │
│ ▤│                                                    │  Risk: HIGH │
│ ▤│                                                    │             │
│ ▤│                                                    │             │
│  ├──────────────────────────────────────────────────┤             │
│  │ Refinery A Ops                                    │             │
│  │ ops@refinery.in                    Sign out        │             │
└──┴──────────────────────────────────────────────────┴─────────────┘
```

**Top bar** — `BB` mark + `BigBrain` wordmark (left), workspace/org switcher (`default ▾`) beside it, a right-aligned `WORKSPACE` label acting as a breadcrumb for the current section, and a small live status pill in the far corner (`● grounded` in `risk.low` green, flips to `text.muted`/`state.unverified` when the last answer wasn't grounded in a document) — this is the one place a user gets an always-visible, one-glance answer to "is what I'm reading actually sourced," without opening the Sources drawer.

**Icon rail** — the narrow far-left strip. In the current build this rail is carrying leftover template icons (Discord, Instagram, X/Twitter marks) — those need to go; they read as a social-app sidebar, not an industrial tool, and would actively undermine the sovereignty pitch in §6. Replace with a small set of monochrome, hairline-stroke glyphs for the same nav items already in the text list beside it (chat bubble, a node/graph glyph for Knowledge Base, a wrench for Tools, a tray-with-arrow for Ingest), rendered in `text.muted` and brightening to `text.primary` only for the active item — no filled icon backgrounds, no color-per-icon. If the rail is meant to hold a *different* set of destinations than the text nav (rather than duplicating it), each icon needs a text label on hover, since an unlabeled icon-only rail is the fastest way to make a security-conscious user unsure what they're clicking.

**Text nav** — plain sentence-case labels (`Chat`, `Knowledge Base`, `Tools`, `Ingest`), no icons needed here since the rail already carries them, active item marked with a `bg.panel` row highlight (already visible in the screenshot) rather than a colored indicator — consistent with §3's rule that color is reserved for state, not for "where am I."

**Account footer** — pinned to the bottom of the sidebar, not floating: current org/user identity (`Refinery A Ops`, `ops@refinery.in`) in body sans over `text.muted` email, `Sign out` as a plain text action, no button chrome — this is a low-frequency action and doesn't need visual weight competing with the nav above it.

**Workspace content + context panel** — unchanged from the chat spec (§7) and Knowledge Base spec (§8): whichever section is selected in the text nav renders in the center column, with the right context panel present only where it's relevant (chat and Knowledge Base doc-selection; not shown on Tools or Ingest, which don't have evidence to surface).

**Nav items still to land** — per the project's own "not built yet" list, the Security Monitor, Red Team, Approval Gate, and Audit Timeline (§9) don't have a home in today's 4-item nav. Add them as their own top-level items (`Security`, `Audit`) rather than burying them inside `Tools` — these are trust-and-oversight surfaces a plant safety lead or auditor needs to find in one glance, not utilities to dig for.

Overall: left-aligned, dense, no centering anywhere below the login screen — the reference's generous whitespace becomes generous *row height* instead (comfortable line spacing in the nav and tables, not empty page margin).

---

## 6. Landing page spec

This is the public marketing page — the only screen in the whole system that gets to be a "hero moment," reusing the reference layout almost section-for-section, but rewritten around what BigBrain actually is (not a generic "AI agent builder" pitch).

```
┌───────────────────────────────────────────────────┐
│  ◉ mark          Product   Security   Docs   LOGIN │
│                                                     │
│         (InteractiveNeuralVortex, full-bleed,      │
│          behind headline, ~30% opacity)            │
│                                                     │
│      A sovereign AI workbench for               │
│      confidential industrial work.                │
│      Local models. Your GPU. Nothing leaves.       │
│                                                     │
│              [ Request a briefing → ]              │
│                                                     │
├───────────────────────────────────────────────────┤
│   Right model,      Grounded in       Human stays  │
│   right job          your docs        in control   │
│   SLM/LLM/VLM        Local RAG, cites  Red Team +   │
│   routed per task    document IDs      approval gate│
├───────────────────────────────────────────────────┤
│         [ inset screenshot: chat + task list ]      │
│         [ inset screenshot: kill-switch monitor ]   │
├───────────────────────────────────────────────────┤
│   Deployment                                       │
│   Org GPU server   |   Approved IndiaAI cloud       │
├───────────────────────────────────────────────────┤
│   Prove it to your security team                   │
│   0 external requests. Live, on your network.      │
│              [ Request a briefing → ]              │
├───────────────────────────────────────────────────┤
│  Product   Security                    ◉ ◉         │
│  BigBrain Lab — org-controlled deployment only      │
└───────────────────────────────────────────────────┘
```

Content mapping from the reference:
- Hero headline/subhead → the sovereignty pitch, not a feature list (matches §27 of the technical spec's "final positioning" — never pitch this as a private ChatGPT).
- The 3-column feature grid ("Pay-as-you-go / Scales with you / Transparent") → becomes **Right model, right job / Grounded in your docs / Human stays in control** — the three ideas a procurement officer or plant safety lead actually needs to hear, in the same restrained icon-title-description rhythm.
- The reference's inset app-screenshot panel → real product screenshots: the chat area with a live Task List Card, and the kill-switch Security Monitor mid-block. These are the two most visually distinctive, truthful things the product does — better proof than illustration.
- The reference's "orb" agent avatars → not reused here; there's no "meet your agents" section, because BigBrain's agents aren't a personality-driven roster, they're a routed model layer. Forcing that motif onto the landing page would be decoration instead of communication.
- The pricing section → repurposed as **Deployment**, a two-item comparison (org GPU server vs. approved IndiaAI cloud) instead of pricing tiers, since this product isn't sold per-seat.
- The waitlist CTA repeated 3× → reduced to 2 occurrences (hero + closing section), per §12's note that one primary action per screen beats a repeated conversion nudge; a defence/industrial buyer reads this as confidence, not urgency.
- No orb-avatar "showcase" grid, no per-card hover-lift — same motion discipline as §10.

---

## 7. Chat area spec

The chat area is the product's real surface — everything else supports it. It gets the same restraint as §5b, plus two concrete components lifted directly from working-agent UI patterns rather than the marketing reference, because a chat console has needs the landing page never has to solve: showing a multi-step plan mid-flight, and letting a user audit *why* an answer was reached without reading a wall of text.

### 7a. Message list

Left-aligned assistant turns, right-aligned user turns, no bubble fill or shadow — a hairline top-divider between turns is the only separator (matches §1's no-card-kit rule). Every assistant turn opens with the **model badge** — a reuse of the landing page's own orb motif (the circular avatars behind "Event Planner," "Marketing Coach" in the reference): a small filled circle, color-neutral (grayscale gradient, not risk-colored) — solid white-gray sphere for SLM, a slightly larger two-tone sphere for LLM, a faceted circle for VLM — paired with a tag pill (`groq-slm` / `sarvam-main` / `local-vision`), so the "which brain answered" signal is always visible at a glance, never buried in settings.

### 7b. Task List Card — the plan, pinned

When a request triggers a multi-step agent run (per the technical spec's §13 workflow — plan → retrieve → tools → draft → Red Team → approval), the chat area pins a **Task List Card** at the top of that turn, mirroring the reference todo-card pattern exactly:

```
┌──────────────────────────────────────────────┐
│  Drafting approval note — P-204          4/7  │
│                                                │
│  ✓  Read inspection reports          6 files  │
│  ✓  Extract equipment tags                    │
│      ✓  Extract P-204                         │
│      ✓  Extract L-204A                        │
│  ○  Draft approval note          in progress  │
│     ▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬ (vortex-gradient underline, animated)
│  ○  Red Team review                           │
│  ⊗  Human approval               blocked      │
└──────────────────────────────────────────────┘
```

Spec:
- Card surface is `bg.panel`, no border — sits flush in the message flow, not floating as a modal.
- Title left, `n/total` counter right, both in body sans, title weight 600.
- Done row: circular checkmark icon in `risk.low` green, `text.primary` label, optional muted metadata at right (`6 files`, `Sources (4)`).
- In-progress row: empty circle outline, label in `text.primary`, right-aligned `in progress` in `text.muted`, and — this is the one place the vortex motif earns a second appearance — a thin **`accent.vortex` gradient underline** beneath the label that animates left-to-right while active. This replaces the reference's plain white progress underline with the product's own signature glow, so "the AI is actively working on this line" and "this is BigBrain" are communicated in the same stroke.
- Blocked row: circular icon with an X in `risk.critical` red, right-aligned reason in `text.muted` (`blocked on approval`, `blocked on Red Team`) — reusing the exact reference pattern (`blocked on tests`) but with BigBrain's own gate names.
- Pending row: empty circle outline, `text.muted` label, no metadata.
- Nested sub-steps: indented one level, smaller circle icons, connecting only to their parent row (no separate vertical rule needed at this depth — keep it to two levels max, per the reference).

### 7c. Reasoning Timeline — the disclosure, collapsed by default

Beneath (or instead of) the Task List Card, each assistant turn can carry a collapsible **Reasoning** disclosure — closed by default so the chat stays calm, expandable when a user wants to audit a specific answer:

```
Reasoning...                                    ⌄
 ●  Read SOP-17 to confirm the current inspection interval.
 ●  ✓ Searched local RAG
 ●  Interval is 6 months per SOP-17 §3.2. Returning grounded answer.
```

Spec:
- Header row: `Reasoning…` in body sans, `text.muted`, with a chevron that rotates on expand/collapse — no accordion border, just the chevron state change.
- Vertical connector: a single `line.hairline` rule running through small filled dots (`text.muted` gray, not colored) at each step — this is a **thinking trace**, distinct in tone from the Task List Card's colored status icons, because reasoning steps aren't pass/fail, they're narration.
- Tool-use steps get a small `risk.low` green checkmark inline before the tool name (`✓ Searched local RAG`, `✓ Ran calculation`) — the one moment of color in an otherwise monochrome trace, so a tool call visibly stands out from plain reasoning text.
- Plain reasoning lines are `text.muted`, slightly smaller than message body text, to keep the visual weight of the disclosure below the actual answer above it.
- A hairline divider closes the disclosure block, matching the reference's own trailing rule.
- This component is what §10's "trace-step glow pulse" refers to for reduced-motion users — with motion off, dots render static and the chevron snaps instead of rotating.

### 7d. Evidence / Sources drawer

Unchanged in spirit from the original spec: hairline-divided rows in the right context panel (§5b), doc title in body sans, `[doc:ID]` in mono, small green dot for grounded answers, `text.muted` italics for `Not found in your docs.` — sits alongside, not inside, the Task List Card and Reasoning Timeline, since sources are evidence *for* an answer, not a step *in* reaching it.

### 7e. Uncertain OCR / handwriting inline flag

```
Equipment: P-204        (plain text)
Temperature: 87°C       (plain text)
Cause: "bearing ???"    (state.unverified underline, ⚠ Verify tooltip)
```
Lives inline in the message body wherever a transcribed document is quoted — same rule as before: no modal, no banner, the flag sits on the word itself.

### 7f. Input bar

A single hairline-outlined field spanning the workspace width, `sneaky-button`-style send action at the right, model-badge indicator showing which model *will* route the next message (editable only in an advanced-mode toggle — most users shouldn't need to think about this turn to turn).

---

## 8. Knowledge Base — graph view

The uploaded screenshot shows the current `Knowledge Base` tab as a flat title/dept table (`SOP-17 — operations`, `SOP Guide — operations`) with a "select a doc to see its chunks" placeholder. That's a database view wearing a UI. It also throws away real information the backend already has — dept, classification, version, shared equipment tags across documents, superseded-by relationships — none of which a flat list can show. This maps directly onto the technical spec's own §25 P2 roadmap item, **Institutional Memory Graph**: the graph view proposed here is the honest MVP expression of that idea, not a separate feature to build later.

```
┌────────────────────────────────────────────────────────────┐
│  Knowledge Base                    [ search ] [ operations ▾ ] [ ✓ classified ▾ ] │
│                                                              │
│              ●──────●  SOP-17                               │
│             ╱        ╲                                      │
│         ●──●          ●  P-204 Inspection Log                │
│        SOP Guide      │  ·╌╌╌╌╌ (superseded by, dashed)      │
│                        ●  SOP-17 v1  (dimmed, muted)         │
│                                                               │
│  ┌ selected: SOP-17 ─────────────┐                           │
│  │ operations · v2 · approved     │                           │
│  │ 6 chunks                       │                           │
│  │ ─ chunk 1: "Inspection interval│                           │
│  │   for P-204 is 6 months"       │                           │
│  └─────────────────────────────────┘                          │
└────────────────────────────────────────────────────────────┘
```

**Canvas**
- Full-bleed `bg.void`, no card boundary — the graph *is* the page, same discipline as the chat area giving the message list the full column.
- No animated vortex here — per §10's motion rule, the vortex stays reserved for login/landing. But a **static** (non-moving) version of the same radial gradient, at ~4% opacity, can sit fixed behind the canvas as a faint texture — the one deliberate exception, because this screen is *literally* a node graph and the shared visual language (soft violet-blue radiance behind circular nodes) is earned here, not decorative. It must never animate on this screen; motion is reserved for actual data changes (a node appearing on ingest, an edge brightening on hover).

**Nodes = documents**
- Circle per document, reusing the orb motif from §7a — but sized by chunk count (more chunks, bigger circle) rather than styled by model type, and colored by **department**, using a small muted categorical palette distinct from the risk-color set so the two systems are never confused at a glance: e.g. `dept.operations` slate-blue, `dept.engineering` warm-gray, `dept.safety` deeper violet. Reserve `risk.*` colors exclusively for safety/approval state, never for department.
- Label beneath each node in body sans (`SOP-17`), with dept/version as a smaller mono caption only on hover or selection — not always-on, to keep the canvas quiet at rest.
- A thin `risk.critical` red ring (not a fill) appears around any node whose current version has been flagged outdated by the Red Team — a graph is precisely where "this SOP version is stale" becomes visible as a place in the network, not just a warning buried in one chat turn.

**Edges = relationships, not decoration**
- Solid hairline edge: documents sharing an equipment tag, line ID, or instrument tag (the same entities extracted in the P&ID/OCR pipeline) — this is the graph's real payoff, since it's the one place a user can see "these five documents all mention P-204" without searching.
- Dashed hairline edge with a small arrowhead: version supersession (`SOP-17 v1 → SOP-17 v2`) — the superseded node renders dimmed (`text.muted`-level opacity), still present but visually deprioritized, never deleted from the graph.
- Edge thickness scales with the number of shared entities — two documents that share one tag get a thin line, five tags get a noticeably thicker one. No labels on edges by default; a hovered edge shows its shared-tag list in a small tooltip.
- Unrelated nodes have **no edge at all** rather than a faint one — an absent edge is itself information (these documents have never been connected by evidence), and drawing a token line to "not leave it empty" would misrepresent that.

**Interaction**
- Hover a node: its direct edges brighten to `text.primary`-level line color, everything else in the graph dims slightly — focus-and-context, not a modal, not a re-layout.
- Click a node: opens the same right-side drawer pattern as the chat area's Evidence/Sources panel (§7d) — dept, classification, version, approval status, and the chunk list — so a user learns this drawer pattern once and it means the same thing everywhere in the product.
- Search/filter bar sits where the table header used to be: text search plus dept and classification filter chips, styled as hairline-outlined toggle pills, not filled tabs — filtering dims non-matching nodes rather than removing them, so the shape of the whole knowledge base stays visible even while narrowing focus.
- Layout is force-directed and lets a user drag a node to pin it; pinned nodes get a small dot indicator so it's clear the position is manual, not computed.

**Empty / sparse states**
Per §1's writing guidance, an empty or newly-ingested knowledge base isn't an error: a single small centered node with the label `Ingest your first document` and a `sneaky-button` action, no illustration, no apology — an invitation to act, not a failure message.

---

## 9. Other component specs

**Security Monitor (kill-switch dashboard)**
Takes the reference's 3-column icon/stat layout and reuses it verbatim as a stat row:
```
External Requests   0        Blocked Egress   1        Local Calls   47
```
Big number in serif display type (matches reference's confident numerals), label in muted sans below. A single status line beneath in mono: `STATUS: SOVEREIGN` in `state.sovereign` green, flips to `state.blocked` red for the demo trigger moment — this is the "falsifiable proof" moment from the technical spec, so it deserves the most confident numeral treatment on the page.

**Red Team panel**
Reuses the reference's clean list-with-icon pattern, rendered in `risk.high` orange rather than a filled alert box:
```
⚠ Vendor quote is outdated
⚠ Current SOP version not used
⚠ Failure cause is unconfirmed
→ HUMAN VERIFICATION REQUIRED
```

**Approval Gate**
A `bg.raised` drawer sliding from the right, header colored by risk tier (2px top border only, not a fill), two hairline-outlined buttons: `Approve` / `Send back`. No modal overlay dimming the whole screen — approvals happen alongside the trace, not instead of seeing it.

**P&ID viewer**
Original image left, extracted-entity list right, connected by thin leader lines in `line.hairline` — same restraint as the reference's inset app-screenshot panels (rounded frame, no drop shadow, just a 1px border).

---

## 10. Motion

One deliberate moment per surface, per the reference's own discipline (it uses exactly one big page-load reveal, not per-card hover fades):
- **The vortex drifts slowly and continuously** on the login screen and the landing-page hero — this is the "personality" beat, and only appears in those two places.
- **The vortex-gradient underline** on an in-progress Task List row is the one place its glow re-appears inside the working app — a small, contained echo, not a repeat of the full background (§7b).
- Everywhere else, motion is **purely functional**: a task row flipping to done, a Reasoning chevron rotating open, a badge changing color on a real state change, a drawer sliding in on approval. No hover-lift on cards, no fade-slide-up on scroll — this is a console people stare at all day, and decorative motion there reads as noise, not craft.

---

## 11. Quality floor

- All status color meaning is also carried in text/icon (never color alone) — colorblind-safe and print/screenshot-safe for audit exports.
- Serif display type stays large-scale only (headings, big numerals); body text is always the grotesque sans at a size that holds up in dense tables.
- Every hairline-divided list/table remains legible with a screen reader — rows are real table/list markup, not divs styled to look like rows.
- Reduced-motion setting disables the vortex drift, the Task List underline animation, and the Reasoning chevron rotation, falling back to a static gradient, a static bar, and an instant open/close.

---

## 12. What was deliberately *not* carried over from the reference

- The centered, large-whitespace marketing layout — kept only for the login screen and the landing-page hero.
- Tracked-out ALL-CAPS nav labels — dropped in the sidebar so it stays legible as it grows from today's 4 items toward 8+.
- Multiple repeated CTA buttons ("Waitlist" appears 3× on the reference landing page) — BigBrain's own landing page keeps it to 2, and the working app has one primary action per screen, not a repeated conversion nudge.
- The reference's "meet your agents" orb-avatar showcase grid — not used on the landing page; BigBrain's models are a routed backend layer, not a cast of characters, so personifying them there would misrepresent the product.
