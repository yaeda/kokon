import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  base: "/kokon/",
  plugins: [react(), tailwindcss()],
  test: {
    environment: "jsdom",
    globals: true
  }
});
