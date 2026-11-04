import { type FormEvent, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../supabase";
import { useMe } from "../auth";
import type { SiteObject } from "../types";

export default function Objects() {
  const me = useMe();
  const [items, setItems] = useState<SiteObject[]>([]);
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [err, setErr] = useState("");

  const load = async () => {
    const { data, error } = await supabase
      .from("construction_objects")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) setErr(error.message);
    else setItems(data ?? []);
  };
  useEffect(() => {
    load();
  }, []);

  async function add(e: FormEvent) {
    e.preventDefault();
    const { error } = await supabase
      .from("construction_objects")
      .insert({ name, address });
    if (error) return setErr(error.message);
    setName("");
    setAddress("");
    setErr("");
    load();
  }

  return (
    <>
      <h1>Объекты</h1>
      {err && <p className="err">{err}</p>}
      {items.length === 0 && <p className="muted">Нет доступных объектов</p>}
      {items.map((o) => (
        <Link key={o.id} to={`/objects/${o.id}`} className="card row">
          <b>{o.name}</b>
          <span className="muted">{o.address}</span>
        </Link>
      ))}
      {me.role === "manager" && (
        <form className="card" onSubmit={add}>
          <h3>Новый объект</h3>
          <input
            placeholder="Название"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          <input
            placeholder="Адрес"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            required
          />
          <button>Создать</button>
        </form>
      )}
    </>
  );
}
