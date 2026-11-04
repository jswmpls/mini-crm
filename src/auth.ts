import { createContext, useContext } from "react";
import type { Profile } from "./types";

export const AuthCtx = createContext<Profile | null>(null);
export const useMe = () => useContext(AuthCtx)!;
