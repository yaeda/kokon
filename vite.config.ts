import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { qrcode } from "vite-plugin-qrcode";

export default defineConfig({
  base: "/kokon/",
  plugins: [react(), qrcode(), tailwindcss()],
  test: {
    environment: "jsdom",
    globals: true
  }
});
