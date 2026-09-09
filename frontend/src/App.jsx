import { ChatBox } from "./components/ChatBox.jsx";
import { MessageList } from "./components/MessageList.jsx";
import { AgentTrace } from "./components/AgentTrace.jsx";
import { SecurityBadge } from "./components/SecurityBadge.jsx";
import { FileUpload, TextIngest } from "./components/FileUpload.jsx";
import { useAsk } from "./hooks/useAsk.js";
import { useIngest } from "./hooks/useIngest.js";

const toLocal = (v) => (v == null ? v : String(v).replace(/groq/gi, "local"));

// Layout only. Logic lives in hooks + services.
export default function App() {
  const { ask, loading, result, error } = useAsk();
  const { uploadFile, uploadText, uploading, last, error: ingestError } = useIngest();
  const steps = result?.task
    ? [
        `Classified: ${result.task.task_type} (${result.task.complexity})`,
        `Routed to: ${toLocal(result.model)}`,
        result.grounded
          ? `Retrieved ${result.evidence?.length ?? 0} chunks from org ${result.org_id}${result.evidence?.length ? "" : " — no match"}`
          : "Ungrounded (retrieve off)",
        "Answer generated" + (result.grounded ? " [grounded]" : ""),
      ]
    : [];
  return (
    <main style={{ padding: 24, fontFamily: "sans-serif" }}>
      <h1>BigBrain</h1>
      <SecurityBadge mode={result?.mode} />
      <ChatBox onSend={ask} loading={loading} />
      {error && <p style={{ color: "red" }}>Error: {error}</p>}
      <AgentTrace steps={steps} />
      <MessageList result={result} />
      <hr style={{ margin: "24px 0" }} />
      <h3>Ingest documents (org: {import.meta.env.VITE_ORG_ID || "default"})</h3>
      <FileUpload onFile={uploadFile} uploading={uploading} />
      <div style={{ height: 12 }} />
      <TextIngest onIngest={uploadText} uploading={uploading} />
      {last && <p style={{ color: "green" }}>Ingested #{last.id} into {last.org_id}</p>}
      {ingestError && <p style={{ color: "red" }}>Ingest error: {ingestError}</p>}
      <p style={{ fontSize: 12, color: "#666" }}>Only .txt/.md/.csv for now. PDF scan/P&ID upload comes next.</p>
    </main>
  );
}
