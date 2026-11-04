import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../supabase";
import { useMe } from "../auth";
import { Badge } from "../lib";
import type { Status } from "../types";

interface Row {
  id: string;
  title: string;
  status: Status;
  object: { name: string } | null;
}

export default function MyTasks() {
  const me = useMe();
  const [rows, setRows] = useState<Row[]>([]);
  const [err, setErr] = useState("");

  useEffect(() => {
    supabase
      .from("tasks")
      .select("id,title,status,object:construction_objects(name)")
      .eq("assignee_id", me.id)
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (error) setErr(error.message);
        else setRows((data as unknown as Row[]) ?? []);
      });
  }, [me.id]);

  return (
    <>
      <h1>Мои задачи</h1>
      {err && <p className="err">{err}</p>}
      {rows.length === 0 && <p className="muted">Задач нет</p>}
      {rows.map((t) => (
        <Link key={t.id} to={`/tasks/${t.id}`} className="card row">
          <b>{t.title}</b>
          <span className="muted">{t.object?.name}</span>
          <Badge s={t.status} />
        </Link>
      ))}
    </>
  );
}
