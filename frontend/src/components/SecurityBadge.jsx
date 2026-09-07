// Reusable security badge. Takes mode string.
export function SecurityBadge({ mode }) {
  const local = (mode || "").includes("localpg");
  return <span>{local ? "LOCAL DB ✓" : mode || "…"}</span>;
}
