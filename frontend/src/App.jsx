import { ChatBox } from "./components/ChatBox.jsx";
import { MessageList } from "./components/MessageList.jsx";
import { AgentTrace } from "./components/AgentTrace.jsx";
import { SecurityBadge } from "./components/SecurityBadge.jsx";
import { useAsk } from "./hooks/useAsk.js";

// Layout only. Logic lives in hooks + services.
export default function App() {
  const { ask, loading, result, error } = useAsk();
  const steps = result?.task
    ? [
        `Classified: ${result.task.task_type} (${result.task.complexity})`,
        `Routed to: ${result.model}`,
        "Answer generated",
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
    </main>
  );
}
