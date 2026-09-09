// Reusable trace view. Takes steps array.
const toLocal = (v) => (v == null ? v : String(v).replace(/groq/gi, "local"));
export function AgentTrace({ steps = [] }) {
  if (!steps.length) return null;
  return (
    <ul>
      {steps.map((s, i) => (
        <li key={i}>{toLocal(s)}</li>
      ))}
    </ul>
  );
}
