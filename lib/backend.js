"use client";
import { createClient } from "@supabase/supabase-js";
import { backendMode, hostedConfig } from "./backend-config";

const listeners = new Set();
let refreshSession;
let currentUser;
let authEpoch = 0;
const fileUrl = (bucket, path) => `/api/files/${encodeURIComponent(bucket)}/${path.split("/").map(encodeURIComponent).join("/")}`;
async function request(url, options = {}) {
  try {
    const response = await fetch(url, { ...options, credentials: "same-origin", signal: AbortSignal.timeout(20000) });
    const result = await response.json();
    if (!response.ok && !result.error) return { data: null, error: { message: "The server could not complete this request." } };
    return result;
  } catch { return { data: null, error: { message: "Could not reach the server. Check your connection and retry." } }; }
}
function post(url, body) {
  return request(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
}
function announce(result, event) {
  if (result.error) return;
  authEpoch++;
  currentUser = result.data?.session?.user || null;
  for (const callback of listeners) callback(event, currentUser ? { user: currentUser } : null);
}
function from(table) {
  const query = { table, op: "select", columns: "*", filters: [], single: false };
  let pending;
  const builder = {
    select(columns = "*") { query.columns = columns; return builder; },
    eq(field, value) { query.filters.push([field, value]); return builder; },
    order(field, options = {}) { query.order = { field, ascending: options.ascending ?? true }; return builder; },
    range(start, end) { query.range = [start, end]; return builder; },
    single() { query.single = true; return builder; },
    maybeSingle() { query.single = true; return builder; },
    insert(payload) { query.op = "insert"; query.payload = payload; return builder; },
    upsert(payload) { query.op = "upsert"; query.payload = payload; return builder; },
    update(payload) { query.op = "update"; query.payload = payload; return builder; },
    delete() { query.op = "delete"; return builder; },
    then(resolve, reject) { pending ||= post("/api/data", query); return pending.then(resolve, reject); },
  };
  return builder;
}
const client = {
  from,
  auth: {
    async getSession() { return request("/api/account"); },
    onAuthStateChange(callback) {
      listeners.add(callback);
      if (listeners.size === 1) {
        // Re-check cookie sessions after focus and periodically, including logout in another tab.
        const refresh = async () => {
          const epoch = authEpoch;
          const result = await client.auth.getSession();
          if (epoch !== authEpoch) return;
          const next = result.data?.session?.user || null;
          if (!result.error && next?.id !== currentUser?.id) announce(result, next ? "SIGNED_IN" : "SIGNED_OUT");
        };
        const interval = window.setInterval(refresh, 30000);
        window.addEventListener("focus", refresh);
        refreshSession = () => { clearInterval(interval); window.removeEventListener("focus", refresh); };
      }
      return { data: { subscription: { unsubscribe() { listeners.delete(callback); if (!listeners.size) refreshSession?.(); } } } };
    },
    async signUp(values) { const result = await post("/api/account", { action: "signup", ...values }); announce(result, "SIGNED_IN"); return result; },
    async signInWithPassword(values) { const result = await post("/api/account", { action: "login", ...values }); announce(result, "SIGNED_IN"); return result; },
    async signOut() { const result = await post("/api/account", { action: "logout" }); announce(result, "SIGNED_OUT"); return result; },
  },
  storage: {
    from(bucket) {
      return {
        upload(path, file, options = {}) { return request(fileUrl(bucket, path), { method: "POST", headers: { "Content-Type": options.contentType || file.type }, body: file }); },
        getPublicUrl(path) { return { data: { publicUrl: fileUrl(bucket, path) } }; },
        // Access is checked on each download; URLs do not carry credentials or expire.
        async createSignedUrl(path) { return { data: { signedUrl: fileUrl(bucket, path) }, error: null }; },
        async remove(paths) {
          const results = await Promise.all(paths.map((path) => request(fileUrl(bucket, path), { method: "DELETE" })));
          return results.find((result) => result.error) || { data: null, error: null };
        },
      };
    },
  },
  channel() {
    let callback, config, timer, previous;
    let stopped = false;
    const channel = {
      on(_event, options, handler) { config = options; callback = handler; return channel; },
      subscribe() {
        const poll = async () => {
          if (stopped || document.hidden) return;
          const query = from(config.table);
          const [field, value] = (config.filter || "").split("=eq.");
          if (field && value) query.eq(field, value);
          const result = await query;
          if (stopped || result.error) return;
          const signature = JSON.stringify(result.data);
          if (signature !== previous) for (const row of result.data || []) callback({ new: row, eventType: "UPDATE" });
          previous = signature;
        };
        const tick = async () => { await poll(); if (!stopped) timer = setTimeout(tick, 1500); };
        tick();
        return channel;
      },
      stop() { stopped = true; clearTimeout(timer); },
    };
    return channel;
  },
  removeChannel(channel) { channel.stop(); },
};
// Explicitly disable accounts only for the browser-only demo/smoke-test mode.
function configuredBackend() {
  if (process.env.NEXT_PUBLIC_LOCAL_ONLY === "1") return null;
  if (backendMode() === "supabase") {
    const { url, key } = hostedConfig();
    return createClient(url, key);
  }
  return client;
}
export const backend = configuredBackend();
