import { useEffect, useState } from "react";
import { Link, Navigate, Route, Routes } from "react-router-dom";
import { supabase } from "./supabase";
import { AuthCtx } from "./auth";
import type { Profile } from "./types";
import Login from "./pages/Login";
import Objects from "./pages/Objects";
import ObjectDetail from "./pages/ObjectDetail";
import TaskDetail from "./pages/TaskDetail";
import MyTasks from "./pages/MyTasks";

export default function App() {
  const [state, setState] = useState<{ loading: boolean; me: Profile | null }>({
    loading: true,
    me: null,
  });

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setTimeout(async () => {
        if (!session) {
          setState({ loading: false, me: null });
          return;
        }
        const { data: p, error } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", session.user.id)
          .single();

        if (error) {
          console.error("Не удалось загрузить профиль:", error);
          await supabase.auth.signOut();
          setState({ loading: false, me: null });
          return;
        }
        setState({ loading: false, me: p });
      }, 0);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  if (state.loading) return <p className="center">Загрузка…</p>;
  const me = state.me;
  if (!me) return <Login />;

  return (
    <AuthCtx.Provider value={me}>
      <header>
        <div className="row" style={{ gap: 16 }}>
          <span className="brand">Мини-CRM</span>
          <nav>
            <Link to="/objects">Объекты</Link>
            {me.role === "executor" && <Link to="/my">Мои задачи</Link>}
          </nav>
        </div>
        <span className="muted">
          {me.full_name || me.email} ·{" "}
          {me.role === "manager" ? "постановщик" : "исполнитель"}{" "}
          <button className="link" onClick={() => supabase.auth.signOut()}>
            Выйти
          </button>
        </span>
      </header>
      <main>
        <Routes>
          <Route path="/objects" element={<Objects />} />
          <Route path="/objects/:id" element={<ObjectDetail />} />
          <Route path="/tasks/:id" element={<TaskDetail />} />
          <Route
            path="/my"
            element={
              me.role === "executor" ? (
                <MyTasks />
              ) : (
                <Navigate to="/objects" replace />
              )
            }
          />
          <Route
            path="*"
            element={
              <Navigate
                to={me.role === "executor" ? "/my" : "/objects"}
                replace
              />
            }
          />
        </Routes>
      </main>
    </AuthCtx.Provider>
  );
}
