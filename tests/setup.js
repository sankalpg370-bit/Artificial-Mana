import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { state } from "./fake-supabase.js";

afterEach(() => {
  localStorage.clear();
  state.current = null;
});
