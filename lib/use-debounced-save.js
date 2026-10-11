"use client";
import { useCallback, useEffect, useRef, useState } from "react";

// Capture each save's destination when scheduling; navigation must never redirect a pending write.
export function useDebouncedSave(delay = 1000) {
  const timer = useRef(null);
  const pending = useRef(null);
  const last = useRef(null);
  const queue = useRef(Promise.resolve());
  const mounted = useRef(true);
  const [message, setMessage] = useState("");
  const flush = useCallback(() => {
    clearTimeout(timer.current);
    const action = pending.current;
    pending.current = null;
    if (!action) return;
    last.current = action;
    // Serialize writes so a slow earlier request cannot overwrite a newer drawing.
    queue.current = queue.current.then(action).then(() => {
      if (mounted.current) setMessage("");
    }).catch((error) => {
      console.error("Unable to save the board.", error);
      if (mounted.current) setMessage("Your board could not be saved. Keep this page open and retry.");
    });
  }, []);
  const schedule = useCallback((action) => {
    pending.current = action;
    clearTimeout(timer.current);
    timer.current = setTimeout(flush, delay);
  }, [delay, flush]);
  const retry = useCallback(() => { pending.current ||= last.current; flush(); }, [flush]);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      // Flush on in-app navigation/unmount; abrupt browser shutdown is not guaranteed.
      flush();
    };
  }, [flush]);
  return { schedule, flush, retry, message };
}
