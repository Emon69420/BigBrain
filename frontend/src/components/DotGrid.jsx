// DotGrid — animated canvas dot pattern for login page
// Creates a morphing halftone-style dot grid with gentle wave animation
import { useRef, useEffect } from "react";

export default function DotGrid({ className, style }) {
  const canvasRef = useRef(null);
  const animRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    let w, h, cols, rows;
    const spacing = 18;
    let t = 0;

    function resize() {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      w = rect.width;
      h = rect.height;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      cols = Math.ceil(w / spacing) + 2;
      rows = Math.ceil(h / spacing) + 2;
    }

    function draw() {
      t += 0.004;
      ctx.clearRect(0, 0, w, h);

      const cx = w * 0.45;
      const cy = h * 0.42;
      const maxDist = Math.sqrt(cx * cx + cy * cy);

      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          const x = col * spacing;
          const y = row * spacing;

          // Distance from center for radial effect
          const dx = x - cx;
          const dy = y - cy;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const normDist = dist / maxDist;

          // Multiple wave layers for organic look
          const wave1 = Math.sin(dist * 0.012 - t * 3) * 0.5 + 0.5;
          const wave2 = Math.sin(x * 0.008 + t * 2) * Math.cos(y * 0.006 - t * 1.5) * 0.5 + 0.5;
          const wave3 = Math.sin((x + y) * 0.005 + t * 2.5) * 0.3 + 0.7;

          // Combine waves — larger dots near center, smaller at edges
          const centerFalloff = 1 - normDist * 0.6;
          const size = Math.max(0.3, (wave1 * 0.5 + wave2 * 0.3 + wave3 * 0.2) * centerFalloff * 4.5);

          // Opacity: brighter near center
          const alpha = Math.max(0.04, centerFalloff * (wave1 * 0.4 + 0.3));

          if (size > 0.2 && alpha > 0.03) {
            ctx.beginPath();
            ctx.arc(x, y, size, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(255,255,255,${alpha.toFixed(3)})`;
            ctx.fill();
          }
        }
      }

      // Accent glow ring
      const glowRadius = 120 + Math.sin(t * 1.5) * 30;
      const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, glowRadius);
      glow.addColorStop(0, "rgba(59,130,246,0.06)");
      glow.addColorStop(0.5, "rgba(59,130,246,0.02)");
      glow.addColorStop(1, "transparent");
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, w, h);

      animRef.current = requestAnimationFrame(draw);
    }

    resize();
    draw();
    window.addEventListener("resize", resize);

    return () => {
      window.removeEventListener("resize", resize);
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{ display: "block", width: "100%", height: "100%", ...style }}
    />
  );
}
