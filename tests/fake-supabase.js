// A small fake of the Supabase client for tests. It keeps rows in memory.
export const state = { current: null };

export function makeFake({ user = null, rows = {}, failInsert = null } = {}) {
  const db = JSON.parse(JSON.stringify(rows));
  const log = [];
  let n = 1000;
  const table = (t) => (db[t] = db[t] || []);

  function from(t) {
    const q = { op: "select", filters: [], order: null, payload: null, conflict: null, single: false, range: null };
    const run = () => {
      let data = null, error = null;
      const match = (r) => q.filters.every(([k, v]) => r[k] === v);
      if (q.op === "select") {
        data = table(t).filter(match);
        if (q.order) data = [...data].sort((a, b) => {
          const result = a[q.order] > b[q.order] ? 1 : a[q.order] < b[q.order] ? -1 : 0;
          return q.orderAscending ? result : -result;
        });
        if (q.range) data = data.slice(q.range[0], q.range[1] + 1);
        if (q.single) data = data[0] || null;
      } else if (q.op === "insert") {
        if (failInsert) { error = { message: failInsert }; }
        else {
          const row = { id: "id" + n++, created_at: new Date().toISOString(), user_id: user && user.id, ...q.payload };
          table(t).push(row); data = row;
        }
      } else if (q.op === "upsert") {
        const list = Array.isArray(q.payload) ? q.payload : [q.payload];
        const keys = (q.conflict || "").split(",").filter(Boolean);
        list.forEach((p) => {
          const i = table(t).findIndex((r) => keys.length && keys.every((k) => r[k] === p[k]));
          if (i >= 0) table(t)[i] = { ...table(t)[i], ...p }; else table(t).push({ ...p });
        });
      } else if (q.op === "delete") {
        db[t] = table(t).filter((r) => !match(r));
      } else if (q.op === "update") {
        table(t).filter(match).forEach((r) => Object.assign(r, q.payload));
      }
      log.push({ table: t, op: q.op, payload: q.payload, filters: q.filters });
      return { data, error };
    };
    const api = {
      select() { return api; },
      eq(k, v) { q.filters.push([k, v]); return api; },
      order(k, options = {}) { q.order = k; q.orderAscending = options.ascending ?? true; return api; },
      range(start, end) { q.range = [start, end]; return api; },
      maybeSingle() { q.single = true; return api; },
      single() { q.single = true; return api; },
      insert(p) { q.op = "insert"; q.payload = p; return api; },
      upsert(p, o) { q.op = "upsert"; q.payload = p; q.conflict = o && o.onConflict; return api; },
      update(p) { q.op = "update"; q.payload = p; return api; },
      delete() { q.op = "delete"; return api; },
      then(res, rej) { return Promise.resolve(run()).then(res, rej); },
    };
    return api;
  }

  return {
    db, log, from,
    auth: {
      getSession: async () => ({ data: { session: user ? { user } : null } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
      signOut: async () => {},
    },
    channel: () => ({ on() { return this; }, subscribe() { return this; } }),
    removeChannel() {},
  };
}
