// Reusable message display. Shows answer + grounded sources.
export function MessageList({ result }) {
  if (!result) return <p>No answer yet.</p>;
  const ev = result.evidence || [];
  return (
    <div>
      <small>Model: {result.model} | Task: {result.task?.task_type}{result.grounded ? " | Grounded" : ""}</small>
      <p>{result.answer}</p>
      <div style={{ marginTop: 12, borderTop: "1px solid #ddd", paddingTop: 8 }}>
        <strong>Sources ({ev.length}) {ev.length === 0 && result.grounded ? "— Not found in your docs" : ""}</strong>
        {ev.length > 0 && (
          <ul style={{ fontSize: 13 }}>
            {ev.map((e, i) => (
              <li key={i}>
                [doc:{e.doc_id}] {e.title} — {String(e.content).slice(0, 120)}
                {e.distance != null && <em> (dist {Number(e.distance).toFixed(3)})</em>}
              </li>
            ))}
          </ul>
        )}
        {ev.length === 0 && result.grounded && <p style={{ fontSize: 13, color: "#666" }}>No company docs matched this query. Upload the relevant doc and ask again.</p>}
      </div>
    </div>
  );
}
