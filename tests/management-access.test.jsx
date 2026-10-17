import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

const { replace } = vi.hoisted(() => ({ replace: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
}));
import ManagementAccessPage from "../app/management/page";

describe("management access", () => {
  it("opens the admin dashboard after the temporary key is accepted", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true }),
    });
    render(<ManagementAccessPage />);

    fireEvent.change(screen.getByLabelText("Temporary access key"), {
      target: { value: "temporary-key" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));

    expect(await screen.findByRole("heading", { name: "Staff course management" })).toBeInTheDocument();
    await vi.waitFor(() => expect(replace).toHaveBeenCalledWith("/admin"));
    expect(fetchMock).toHaveBeenCalledWith("/api/admin-access", expect.objectContaining({
      method: "POST",
      body: JSON.stringify({ key: "temporary-key" }),
    }));
    fetchMock.mockRestore();
  });
});
