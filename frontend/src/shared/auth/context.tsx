import { authClient } from "./client";

import { createStore } from "solid-js/store";
import type { ParentComponent } from "solid-js";
import { createContext, onMount, useContext } from "solid-js";

import type { UserRole } from "~/shared/api/types";

type User = (typeof authClient.$Infer.Session)["user"];

type AuthState = { user: User | null; loading: boolean };

type AuthApi = {
  state: AuthState;
  /** The signed-in user's role, or `undefined` if signed out. Server-enforced elsewhere — this is only for UI capability-hiding. */
  role: () => UserRole | undefined;
  /** `GET /me` includes `firstName`/`lastName` (Better Auth's `getSession` carries registered
   * `additionalFields` automatically) but the client's generated session type doesn't know about
   * them, hence the cast — same pattern as `role` above. */
  firstName: () => string | null | undefined;
  lastName: () => string | null | undefined;
  signIn: (username: string, password: string) => Promise<void>;
  signUp: (username: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthApi>();

// Session lives in a Solid store (not better-auth's nanostore) so the rest of
// the app reads it like any other reactive state: `auth.state.user`.
export const AuthProvider: ParentComponent = (props) => {
  const [state, setState] = createStore<AuthState>({ user: null, loading: true });

  const refresh = async () => {
    const { data } = await authClient.getSession();
    setState({ user: data?.user ?? null, loading: false });
  };

  onMount(refresh);

  const api: AuthApi = {
    state,
    role: () => (state.user as (User & { role?: UserRole }) | null)?.role,
    firstName: () => (state.user as (User & { firstName?: string | null }) | null)?.firstName,
    lastName: () => (state.user as (User & { lastName?: string | null }) | null)?.lastName,
    signIn: async (username, password) => {
      const { error } = await authClient.signIn.username({ username, password });
      if (error) throw new Error(error.message ?? "Sign in failed");
      await refresh();
    },
    signUp: async (username, password) => {
      const email = `${username}@noemail.local`;
      const { error } = await authClient.signUp.email({ username, email, password, name: username });
      if (error) throw new Error(error.message ?? "Sign up failed");
      await refresh();
    },
    signOut: async () => {
      await authClient.signOut();
      setState("user", null);
    },
  };

  return <AuthContext.Provider value={api}>{props.children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
};
