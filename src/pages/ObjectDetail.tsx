import { type FormEvent, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { supabase } from "../supabase";
import { useMe } from "../auth";
import { Badge, who } from "../lib";
import type { Profile, SiteObject, Status } from "../types";

interface TaskRow {
  id: string;
  title: string;
  status: Status;
  assignee: { full_name: string | null; email: string } | null;
}

export default function ObjectDetail() {
  const { id } = useParams();
  const me = useMe();
  const nav = useNavigate();
  const [obj, setObj] = useState<SiteObject | null>(null);
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [execs, setExecs] = useState<Profile[]>([]);
  const [edit, setEdit] = useState({ name: "", address: "" });
  const [form, setForm] = useState({
    title: "",
    description: "",
    assignee_id: "",
  });
  const [err, setErr] = useState("");
  const isManager = me.role === "manager";

  const load = async () => {
    const o = await supabase
      .from("construction_objects")
      .select("*")
      .eq("id", id!)
      .single();
    if (o.error) return setErr(o.error.message);
    setObj(o.data);
    setEdit({ name: o.data.name, address: o.data.address });
    const t = await supabase
      .from("tasks")
      .select(
        "id,title,status,assignee:profiles!tasks_assignee_id_fkey(full_name,email)",
      )
      .eq("object_id", id!)
      .order("created_at", { ascending: false });
    setTasks((t.data as unknown as TaskRow[]) ?? []);
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

  async function saveObject(e: FormEvent) {
    e.preventDefault();
    const { error } = await supabase
      .from("construction_objects")
      .update(edit)
      .eq("id", id!);
    setErr(error?.message ?? "");
    load();
  }

  async function removeObject() {
    if (!confirm("Удалить объект вместе со всеми его задачами?")) return;
    const { error } = await supabase
      .from("construction_objects")
      .delete()
      .eq("id", id!);
    if (error) setErr(error.message);
    else nav("/objects");
  }

  async function addTask(e: FormEvent) {
    e.preventDefault();
    const { error } = await supabase
      .from("tasks")
      .insert({ ...form, object_id: id });
    if (error) return setErr(error.message);
    setForm({ title: "", description: "", assignee_id: "" });
    setErr("");
    load();
  }

  if (!obj) return <p>{err || "Загрузка…"}</p>;

  return (
    <>
      <p>
        <Link to="/objects">← Объекты</Link>
      </p>
      <h1>{obj.name}</h1>
      <p className="muted">{obj.address}</p>
      {err && <p className="err">{err}</p>}

      <h2>Задачи</h2>
      {tasks.length === 0 && <p className="muted">Задач нет</p>}
      {tasks.map((t) => (
        <Link key={t.id} to={`/tasks/${t.id}`} className="card row">
          <b>{t.title}</b>
          <span className="muted">{who(t.assignee)}</span>
          <Badge s={t.status} />
        </Link>
      ))}

      {isManager && (
        <>
          <form className="card" onSubmit={addTask}>
            <h3>Новая задача</h3>
            <input
              placeholder="Название"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              required
            />
            <textarea
              placeholder="Описание"
              value={form.description}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
            />
            <select
              value={form.assignee_id}
              onChange={(e) =>
                setForm({ ...form, assignee_id: e.target.value })
              }
              required
            >
              <option value="">Исполнитель…</option>
              {execs.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.full_name || x.email}
                </option>
              ))}
            </select>
            <button>Создать задачу</button>
          </form>

          <form className="card" onSubmit={saveObject}>
            <h3>Редактировать объект</h3>
            <input
              value={edit.name}
              onChange={(e) => setEdit({ ...edit, name: e.target.value })}
              required
            />
            <input
              value={edit.address}
              onChange={(e) => setEdit({ ...edit, address: e.target.value })}
              required
            />
            <div className="row">
              <button>Сохранить</button>
              <button type="button" className="danger" onClick={removeObject}>
                Удалить объект
              </button>
            </div>
          </form>
        </>
      )}
    </>
  );
}
