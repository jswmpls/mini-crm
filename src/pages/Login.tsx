import { type FormEvent, useState } from "react";
import { supabase } from "../supabase";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) setErr("Неверный email или пароль");
    setBusy(false);
  }

  return (
    <form className="card login" onSubmit={submit}>
      <h2>Вход</h2>
      <input
        type="email"
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
      />
      <input
        type="password"
        placeholder="Пароль"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
      />
      {err && <p className="err">{err}</p>}
      <button disabled={busy}>Войти</button>
    </form>
  );
}
