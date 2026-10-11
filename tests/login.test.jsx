import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const authState = { current: null };
vi.mock("../lib/supabase", () => ({
  get supabase() {
    return authState.current;
  },
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

import Login from "../app/login/page";

afterEach(() => {
  authState.current = null;
});

describe("Login", () => {
  it("does not send an empty sign-up to Supabase as an anonymous sign-in", async () => {
    const user = userEvent.setup();
    const signUp = vi.fn();
    authState.current = { auth: { signUp, signInWithPassword: vi.fn() } };

    render(<Login />);
    await user.click(screen.getByRole("button", { name: "Sign up" }));

    expect(screen.getByText("Enter your email and password to continue.")).toBeInTheDocument();
    expect(signUp).not.toHaveBeenCalled();
  });

  it("requires a six-character password before sign-up", async () => {
    const user = userEvent.setup();
    const signUp = vi.fn();
    authState.current = { auth: { signUp, signInWithPassword: vi.fn() } };

    render(<Login />);
    await user.type(screen.getByLabelText("Email"), "learner@example.com");
    await user.type(screen.getByLabelText("Password"), "12345");
    await user.click(screen.getByRole("button", { name: "Sign up" }));

    expect(screen.getByText("Your password must be at least 6 characters long.")).toBeInTheDocument();
    expect(signUp).not.toHaveBeenCalled();
  });
});
