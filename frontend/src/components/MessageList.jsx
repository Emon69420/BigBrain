// Reusable message display. Takes result object, renders it.
export function MessageList({ result }) {
  if (!result) return <p>No answer yet.</p>;
  return (
    <div>
      <small>Model: {result.model} | Task: {result.task?.task_type}</small>
      <p>{result.answer}</p>
    </div>
  );
}
