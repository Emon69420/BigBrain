import { ChatBox } from "./components/ChatBox.jsx";
import { MessageList } from "./components/MessageList.jsx";
import { SecurityBadge } from "./components/SecurityBadge.jsx";
import { useAsk } from "./hooks/useAsk.js";

// Layout only. Logic lives in hooks + services.
export default function App() {
  const { ask, loading, result } = useAsk();
  return (
    <main style={{ padding: 24, fontFamily: "sans-serif" }}>
      <h1>BigBrain</h1>
      <SecurityBadge mode={result?.mode} />
      <ChatBox onSend={ask} loading={loading} />
      <MessageList result={result} />
    </main>
  );
}
