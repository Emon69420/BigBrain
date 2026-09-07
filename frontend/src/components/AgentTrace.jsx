// Reusable trace view. Takes steps array.
export function AgentTrace({ steps = [] }) {
  if (!steps.length) return null;
  return (
    <ul>
      {steps.map((s, i) => (
        <li key={i}>{s}</li>
      ))}
    </ul>
  );
}
