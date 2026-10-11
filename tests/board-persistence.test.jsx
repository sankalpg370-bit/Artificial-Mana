import { afterEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useDebouncedSave } from "../lib/use-debounced-save";

afterEach(() => vi.useRealTimers());

describe("board autosave", () => {
  it("saves the latest drawing once after the debounce and flushes on navigation", async () => {
    vi.useFakeTimers();
    const first = vi.fn();
    const latest = vi.fn();
    const leaving = vi.fn();
    const { result, unmount } = renderHook(() => useDebouncedSave());
    act(() => { result.current.schedule(first); result.current.schedule(latest); });
    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
    expect(first).not.toHaveBeenCalled();
    expect(latest).toHaveBeenCalledOnce();
    act(() => result.current.schedule(leaving));
    unmount();
    await act(async () => {});
    expect(leaving).toHaveBeenCalledOnce();
  });
  it("reports rejected writes and retries the same snapshot", async () => {
    vi.useFakeTimers();
    const save = vi.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce(undefined);
    const { result } = renderHook(() => useDebouncedSave());
    act(() => result.current.schedule(save));
    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
    expect(result.current.message).toContain("could not be saved");
    await act(async () => result.current.retry());
    expect(save).toHaveBeenCalledTimes(2);
    expect(result.current.message).toBe("");
  });
  it("serializes slow writes to preserve drawing order", async () => {
    let finish;
    const slow = vi.fn(() => new Promise((resolve) => { finish = resolve; }));
    const next = vi.fn();
    const { result } = renderHook(() => useDebouncedSave());
    await act(async () => { result.current.schedule(slow); result.current.flush(); });
    await act(async () => { result.current.schedule(next); result.current.flush(); });
    expect(next).not.toHaveBeenCalled();
    await act(async () => finish());
    expect(next).toHaveBeenCalledOnce();
  });
});
