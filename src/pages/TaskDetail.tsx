import { type FormEvent, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { supabase } from "../supabase";
import { useMe } from "../auth";
import { Badge, STATUS_LABEL, availableActions, fmt, who } from "../lib";
import type { Profile, Status } from "../types";

type P = { full_name: string | null; email: string } | null;
interface Task {
  id: string;
  title: string;
  description: string;
  object_id: string;
  assignee_id: string;
  status: Status;
  created_at: string;
  object: { id: string; name: string } | null;
  assignee: P;
  author: P;
}
interface Hist {
  id: number;
  from_status: Status | null;
  to_status: Status;
  comment: string | null;
  created_at: string;
  user: P;
}

export default function TaskDetail() {
  const { id } = useParams();
  const me = useMe();
  const nav = useNavigate();
  const [task, setTask] = useState<Task | null>(null);
  const [history, setHistory] = useState<Hist[]>([]);
  const [execs, setExecs] = useState<Profile[]>([]);
  const [comment, setComment] = useState("");
  const [edit, setEdit] = useState({
    title: "",
    description: "",
    assignee_id: "",
  });
  const [err, setErr] = useState("");
  const isManager = me.role === "manager";

  const load = async () => {
    const t = await supabase
      .from("tasks")
      .select(
        "*, object:construction_objects(id,name), assignee:profiles!tasks_assignee_id_fkey(full_name,email), author:profiles!tasks_author_id_fkey(full_name,email)",
      )
      .eq("id", id!)
      .single();
    if (t.error) return setErr(t.error.message);
    const data = t.data as unknown as Task;
    setTask(data);
    setEdit({
      title: data.title,
      description: data.description,
      assignee_id: data.assignee_id,
    });
    const h = await supabase
      .from("task_status_history")
      .select(
        "id,from_status,to_status,comment,created_at,user:profiles!task_status_history_changed_by_fkey(full_name,email)",
      )
      .eq("task_id", id!)
      .order("created_at");
    setHistory((h.data as unknown as Hist[]) ?? []);
    if (isManager) {
      const e = await supabase
        .from("profiles")
        .select("*")
        .eq("role", "executor");
      setExecs(e.data ?? []);
    }
  };
  useEffect(() => {
    load();
  }, [id]);

  async function act(to: Status) {
    const { error } = await supabase.rpc("change_task_status", {
      p_task_id: id,
      p_new_status: to,
      p_comment: comment.trim() || null,
    });
    if (error) return setErr(error.message);
    setComment("");
    setErr("");
    load();
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    const { error } = await supabase.from("tasks").update(edit).eq("id", id!);
    setErr(error?.message ?? "");
    load();
  }

  async function remove() {
    if (!confirm("Удалить задачу вместе с историей?")) return;
    const { error } = await supabase.from("tasks").delete().eq("id", id!);
    if (error) setErr(error.message);
    else nav(`/objects/${task!.object_id}`);
  }

  if (!task) return <p>{err || "Загрузка…"}</p>;
  const actions = availableActions(task, me);
  const needsComment = actions.some((a) => a.needComment);

  return (
    <>
      <p>
        <Link to={`/objects/${task.object_id}`}>← {task.object?.name}</Link>
      </p>
      <h1>
        {task.title} <Badge s={task.status} />
      </h1>
      {err && <p className="err">{err}</p>}

      <div className="card">
        <p style={{ whiteSpace: "pre-wrap" }}>
          {task.description || <span className="muted">Без описания</span>}
        </p>
        <p className="muted">
          Исполнитель: {who(task.assignee)} · Автор: {who(task.author)} ·
          Создана: {fmt(task.created_at)}
        </p>
      </div>

      {actions.length > 0 && (
        <div className="card">
          <h3>Действия</h3>
          <textarea
            placeholder={
              needsComment
                ? "Комментарий (обязателен при возврате на доработку)"
                : "Комментарий (необязательно)"
            }
            value={comment}
            onChange={(e) => setComment(e.target.value)}
          />
          <div className="row">
            {actions.map((a) => (
              <button
                key={a.to}
                disabled={a.needComment && !comment.trim()}
                onClick={() => act(a.to)}
              >
                {a.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <h2>История</h2>
      {history.map((h) => (
        <div key={h.id} className="card">
          <b>
            {h.from_status
              ? `${STATUS_LABEL[h.from_status]} → ${STATUS_LABEL[h.to_status]}`
              : `Создана (${STATUS_LABEL[h.to_status]})`}
          </b>
          <div className="muted">
            {who(h.user)} · {fmt(h.created_at)}
          </div>
          {h.comment && <div>«{h.comment}»</div>}
        </div>
      ))}

      {isManager && (
        <form className="card" onSubmit={save}>
          <h3>Редактировать задачу</h3>
          <input
            value={edit.title}
            onChange={(e) => setEdit({ ...edit, title: e.target.value })}
            required
          />
          <textarea
            value={edit.description}
            onChange={(e) => setEdit({ ...edit, description: e.target.value })}
          />
          <select
            value={edit.assignee_id}
            onChange={(e) => setEdit({ ...edit, assignee_id: e.target.value })}
          >
            {execs.map((x) => (
              <option key={x.id} value={x.id}>
                {x.full_name || x.email}
              </option>
            ))}
          </select>
          <div className="row">
            <button>Сохранить</button>
            <button type="button" className="danger" onClick={remove}>
              Удалить задачу
            </button>
          </div>
        </form>
      )}
    </>
  );
}
