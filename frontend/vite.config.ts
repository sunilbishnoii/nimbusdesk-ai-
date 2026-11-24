import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/enquiry": "http://127.0.0.1:8000",
      "/health": "http://127.0.0.1:8000",
      "/leads": "http://127.0.0.1:8000",
      "/analytics": "http://127.0.0.1:8000",
      "/demo": "http://127.0.0.1:8000",
    },
  },
});
