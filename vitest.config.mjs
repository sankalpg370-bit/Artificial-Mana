import { defineConfig } from "vitest/config";

export default defineConfig({
  // The project files are .js files that contain JSX. Tell the compiler to read them as JSX.
  oxc: { include: /\.(js|jsx)$/, exclude: /node_modules/, lang: "jsx", jsx: { runtime: "automatic" } },
  test: { environment: "jsdom", globals: true, setupFiles: ["./tests/setup.js"], include: ["tests/**/*.test.{js,jsx}"] },
});
