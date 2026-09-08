// BigBrain mark — abstract brain: cranium outline, midline, symmetric sulci.
// Stroke-only, currentColor, legible at 16–32px.
export default function BrainMark({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
      <path d="M12 3.5c-4.3 0-7.5 3.4-7.5 7.8 0 2 .8 3.8 2 5.1.4 1.6 1.8 2.9 3.5 3 .6.5 1.3.8 2 .8s1.4-.3 2-.8c1.7-.1 3.1-1.4 3.5-3 1.2-1.3 2-3.1 2-5.1 0-4.4-3.2-7.8-7.5-7.8z" />
      <path d="M12 3.5v16.9" />
      <path d="M9.2 8.2c-1.1.3-1.9 1.2-1.9 2.3M9.6 13.6c-.9.4-1.5 1.1-1.5 2.1M14.8 8.2c1.1.3 1.9 1.2 1.9 2.3M14.4 13.6c.9.4 1.5 1.1 1.5 2.1" />
    </svg>
  );
}
