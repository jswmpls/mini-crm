export type Role = "manager" | "executor";
export type Status =
  | "new"
  | "in_progress"
  | "in_review"
  | "accepted"
  | "rework";

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  role: Role;
}
export interface SiteObject {
  id: string;
  name: string;
  address: string;
}
