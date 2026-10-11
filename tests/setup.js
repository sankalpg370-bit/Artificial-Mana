import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { state } from "./fake-backend.js";

afterEach(() => {
  if (typeof window !== "undefined") localStorage.clear();
  state.current = null;
});
