// Reusable chat input. Props only, no API calls inside.
export function ChatBox({ onSend, loading }) {
  function submit(e) {
    e.preventDefault();
    const text = new FormData(e.target).get("q");
    if (text) onSend(text);
    e.target.reset();
  }
  return (
    <form onSubmit={submit}>
      <input name="q" placeholder="Ask BigBrain..." disabled={loading} />
      <button disabled={loading}>{loading ? "..." : "Send"}</button>
    </form>
  );
}
