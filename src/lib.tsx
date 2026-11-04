import type { Profile, Status } from "./types";

export const STATUS_LABEL: Record<Status, string> = {
  new: "Новая",
  in_progress: "В работе",
  in_review: "На проверке",
  accepted: "Принята",
  rework: "На доработке",
};

export const Badge = ({ s }: { s: Status }) => (
  <span className={`badge ${s}`}>{STATUS_LABEL[s]}</span>
);

export const fmt = (d: string) => new Date(d).toLocaleString("ru-RU");

export const who = (p?: { full_name: string | null; email: string } | null) =>
  p ? p.full_name || p.email : "—";

export interface Action {
  to: Status;
  label: string;
  needComment: boolean;
}

export function availableActions(
  task: { status: Status; assignee_id: string },
  me: Profile,
): Action[] {
  if (me.role === "manager") {
    return task.status === "in_review"
      ? [
          { to: "accepted", label: "Принять", needComment: false },
          { to: "rework", label: "Вернуть на доработку", needComment: true },
        ]
      : [];
  }
  if (task.assignee_id !== me.id) return [];
  if (task.status === "new" || task.status === "rework")
    return [{ to: "in_progress", label: "Взять в работу", needComment: false }];
  if (task.status === "in_progress")
    return [
      { to: "in_review", label: "Отправить на проверку", needComment: false },
    ];
  return [];
}
