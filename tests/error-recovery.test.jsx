import { expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ErrorBoundaryHandler } from "next/dist/client/components/error-boundary";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import ErrorPage from "../app/error";

it("recovers by refreshing failed content through the Next.js error boundary", async () => {
  const logged = vi.spyOn(console, "error").mockImplementation(() => {});
  let unavailable = true;
  const refresh = vi.fn(() => { unavailable = false; });
  function Content() {
    if (unavailable) throw new Error("Temporary server failure");
    return <p>Recovered course</p>;
  }
  try {
    render(<AppRouterContext.Provider value={{ refresh }}>
      <ErrorBoundaryHandler pathname="/course/intro-to-ai" errorComponent={ErrorPage}>
        <Content />
      </ErrorBoundaryHandler>
    </AppRouterContext.Provider>);
    expect(screen.getByRole("alert")).toHaveTextContent("Something went wrong");
    await userEvent.setup().click(screen.getByRole("button", { name: "Try again" }));
    expect(refresh).toHaveBeenCalledOnce();
    expect(screen.getByText("Recovered course")).toBeInTheDocument();
  } finally { logged.mockRestore(); }
});
