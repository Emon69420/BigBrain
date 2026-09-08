import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: { port: 3000, proxy: { "/api": "https://7db2-2401-9640-1802-d8dc-2-2-2-1.ngrok-free.app" } },
});
