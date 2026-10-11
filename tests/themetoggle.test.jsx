import { beforeEach, expect, it } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import ThemeToggle from "../app/ThemeToggle";

beforeEach(() => {
  delete document.documentElement.dataset.theme;
});

it("switches and saves the selected theme", () => {
  render(<ThemeToggle />);

  fireEvent.click(screen.getByRole("button", { name: "Switch to light mode" }));

  expect(document.documentElement).toHaveAttribute("data-theme", "light");
  expect(localStorage.getItem("artificial-mana-theme")).toBe("light");
  expect(screen.getByRole("button", { name: "Switch to dark mode" })).toBeInTheDocument();
});

it("restores the saved theme", async () => {
  localStorage.setItem("artificial-mana-theme", "light");

  render(<ThemeToggle />);

  await waitFor(() => {
    expect(document.documentElement).toHaveAttribute("data-theme", "light");
  });
  expect(screen.getByRole("button", { name: "Switch to dark mode" })).toBeInTheDocument();
});

it("synchronizes changes from another browser tab", () => {
  render(<ThemeToggle />);
  fireEvent(window, new StorageEvent("storage", { key: "artificial-mana-theme", newValue: "light" }));
  expect(document.documentElement).toHaveAttribute("data-theme", "light");
  expect(screen.getByRole("button", { name: "Switch to dark mode" })).toBeInTheDocument();
});
