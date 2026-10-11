"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { backend } from "../../lib/backend";

const TABLES = [
  { name: "profiles", label: "Users & roles", key: ["user_id"], order: "user_id", privateData: false },
  { name: "progress", label: "Lesson progress", key: ["user_id", "course_slug", "lesson_id"], order: "completed_at", privateData: true },
  { name: "notes", label: "Private notes", key: ["id"], order: "created_at", privateData: true },
  { name: "course_state", label: "Bookmarks & state", key: ["user_id", "course_slug"], order: "updated_at", privateData: true },
  { name: "quiz_results", label: "Quiz scores", key: ["user_id", "course_slug", "lesson_id"], order: "updated_at", privateData: true },
  { name: "boards", label: "Private learner boards", key: ["user_id", "course_slug", "lesson_id"], order: "updated_at", privateData: true },
  { name: "lesson_boards", label: "Public lesson boards", key: ["course_slug", "lesson_id"], order: "updated_at", privateData: false },
  { name: "comments", label: "Public comments", key: ["id"], order: "created_at", privateData: false },
  { name: "creator_materials", label: "Creator materials & drafts", key: ["id"], order: "created_at", privateData: false },
];

const PAGE_SIZE = 100;

function rowKey(record, fields) {
  return fields.map((field) => `${field}: ${record[field] ?? "?"}`).join(", ");
}

export default function AdminControlCenter() {
  const request = useRef(0);
  const [table, setTable] = useState(TABLES[0]);
  const [rows, setRows] = useState([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const reload = useCallback(async () => {
    const id = ++request.current;
    if (!backend) {
      setRows([]);
      setMessage("the account service is not configured.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setMessage("");
    try {
      const start = page * PAGE_SIZE;
      const { data, error } = await backend.from(table.name).select("*")
        .order(table.order, { ascending: false })
        .range(start, start + PAGE_SIZE - 1);
      if (error) throw error;
      if (id !== request.current) return;
      setRows(data || []);
      setHasMore((data || []).length === PAGE_SIZE);
    } catch (error) {
      if (id !== request.current) return;
      console.error(`Unable to load ${table.label.toLowerCase()}.`, error);
      setRows([]);
      setHasMore(false);
      setMessage(`Could not load ${table.label.toLowerCase()}. Check your connection and try again.`);
    } finally {
      if (id === request.current) setLoading(false);
    }
  }, [page, table]);

  useEffect(() => {
    const counter = request;
    reload();
    return () => { counter.current++; };
  }, [reload]);

  function selectTable(nextTable) {
    setTable(nextTable);
    setPage(0);
  }

  async function saveRecord(record, serialized) {
    try {
      let edited;
      try {
        edited = JSON.parse(serialized);
      } catch {
        setMessage("The record must be valid JSON before it can be saved.");
        return;
      }
      if (!edited || Array.isArray(edited) || typeof edited !== "object") {
        setMessage("A record must be a JSON object.");
        return;
      }
      const payload = { ...edited };
      const query = backend.from(table.name).update(payload);
      for (const key of table.key) query.eq(key, record[key]);
      const { error } = await query;
      if (error) {
        setMessage(`Could not save record: ${error.message}`);
        return;
      }
      setMessage("Record saved.");
      await reload();
    } catch (error) {
      console.error("Admin record action failed.", error);
      setMessage("Could not complete this action. Check your connection and retry.");
    }
  }

  async function saveRole(record, role) {
    try {
      const { error } = await backend.from("profiles").update({ role }).eq("user_id", record.user_id);
      if (error) {
        setMessage(`Could not update user role: ${error.message}`);
        return;
      }
      setMessage("User role updated.");
      await reload();
    } catch (error) {
      console.error("Admin record action failed.", error);
      setMessage("Could not complete this action. Check your connection and retry.");
    }
  }

  async function deleteRecord(record) {
    try {
      if (!window.confirm(`Permanently delete this ${table.label.toLowerCase()} record (${rowKey(record, table.key)})?`)) return;
      const query = backend.from(table.name).delete();
      for (const key of table.key) query.eq(key, record[key]);
      const { error } = await query;
      if (error) {
        setMessage(`Could not delete record: ${error.message}`);
        return;
      }
      setMessage("Record deleted.");
      await reload();
    } catch (error) {
      console.error("Admin record action failed.", error);
      setMessage("Could not complete this action. Check your connection and retry.");
    }
  }

  return (
    <section className="panel admin-control-center">
      <h2>Full site control</h2>
      <p className="muted">
        Admin access includes drafts, published content, and account-owned learning records.
        Private records are visible here to authorized admins. Changes affect the live database.
      </p>
      <div className="row" role="tablist" aria-label="Admin data categories">
        {TABLES.map((item) => (
          <button
            key={item.name}
            type="button"
            className={item.name === table.name ? "tb on" : "tb"}
            role="tab"
            aria-selected={item.name === table.name}
            onClick={() => selectTable(item)}
          >
            {item.label}
          </button>
        ))}
      </div>
      <h3>{table.label}{table.privateData ? " · Private account data" : " · Public or creator data"}</h3>
      <p className="muted">Showing up to {PAGE_SIZE} records per page. Record edits and deletions are permanent.</p>
      {message && <p className="notice" role="status">{message}</p>}
      {loading && <p className="muted">Loading records...</p>}
      {!loading && !rows.length && !message && <p className="muted">No records found.</p>}
      {!loading && rows.map((record) => {
        const identity = rowKey(record, table.key);
        return (
          <details className="note admin-record" key={`${table.name}:${identity}`}>
            <summary>{identity}</summary>
            {table.name === "profiles" && (
              <label>
                Account role
                <select
                  aria-label={`Role for ${record.user_id}`}
                  value={record.role}
                  onChange={(event) => saveRole(record, event.target.value)}
                >
                  <option value="student">Student</option>
                  <option value="teacher">Teacher</option>
                  <option value="admin">Admin</option>
                </select>
              </label>
            )}
            {table.name !== "profiles" && <RecordEditor record={record} onSave={saveRecord} />}
            {table.name !== "profiles" && <button className="del" type="button" onClick={() => deleteRecord(record)}>Delete record</button>}
          </details>
        );
      })}
      <div className="row">
        <button className="alt" type="button" disabled={page === 0 || loading} onClick={() => setPage(page - 1)}>Previous</button>
        <span className="muted">Page {page + 1}</span>
        <button className="alt" type="button" disabled={!hasMore || loading} onClick={() => setPage(page + 1)}>Next</button>
      </div>
    </section>
  );
}

function RecordEditor({ record, onSave }) {
  const [serialized, setSerialized] = useState(JSON.stringify(record, null, 2));

  useEffect(() => {
    setSerialized(JSON.stringify(record, null, 2));
  }, [record]);

  return (
    <>
      <label>
        Record data (JSON)
        <textarea
          aria-label="Record data (JSON)"
          rows={8}
          value={serialized}
          onChange={(event) => setSerialized(event.target.value)}
        />
      </label>
      <button className="tb" type="button" onClick={() => onSave(record, serialized)}>Save record</button>
    </>
  );
}
