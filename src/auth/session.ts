/**
 * Session state: who is signed in, how (server account or offline demo), and their preferences.
 * Persisted to localStorage so a refresh keeps you signed in.
 */
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { apiRequest, ApiError } from "@/lib/api";
import type { RegionId } from "@/data/types";

export type Role = "forecaster" | "disaster_manager" | "researcher" | "other";
export type Theme = "light" | "dark" | "system";
export type Threshold = 64.5 | 115.6 | 204.5;

export interface User {
  id: number;
  name: string;
  email: string;
  role: Role;
  home_region: RegionId;
  lead_day: number;
  alert_threshold: Threshold;
  theme: Theme;
  onboarded: boolean;
  created_at: string;
}

export type Preferences = Partial<Pick<User, "name" | "role" | "home_region" | "lead_day" | "alert_threshold" | "theme" | "onboarded">>;

export const ROLE_LABELS: Record<Role, string> = {
  forecaster: "Duty forecaster",
  disaster_manager: "Disaster manager",
  researcher: "Researcher",
  other: "Other",
};

const DEMO_USER: User = {
  id: 0,
  name: "Demo forecaster",
  email: "demo@atmosfusion.local",
  role: "forecaster",
  home_region: "konkan",
  lead_day: 1,
  alert_threshold: 115.6,
  theme: "light",
  onboarded: true,
  created_at: new Date(0).toISOString(),
};

interface AuthResponse {
  token: string;
  user: User;
}

interface SessionState {
  mode: "account" | "demo" | null;
  token: string | null;
  user: User | null;
  /** True when the account session could not be re-validated because the server is offline. */
  offline: boolean;

  signup: (name: string, email: string, password: string) => Promise<User>;
  login: (email: string, password: string) => Promise<User>;
  startDemo: () => void;
  logout: () => void;
  /** Re-validates a stored account session against the server. */
  refresh: () => Promise<void>;
  updatePreferences: (prefs: Preferences) => Promise<User>;
  changePassword: (current: string, next: string) => Promise<void>;
  deleteAccount: (password: string) => Promise<void>;
}

export const useSession = create<SessionState>()(
  persist(
    (set, get) => ({
      mode: null,
      token: null,
      user: null,
      offline: false,

      signup: async (name, email, password) => {
        const res = await apiRequest<AuthResponse>("POST", "/api/v1/auth/signup", { body: { name, email, password } });
        set({ mode: "account", token: res.token, user: res.user, offline: false });
        return res.user;
      },

      login: async (email, password) => {
        const res = await apiRequest<AuthResponse>("POST", "/api/v1/auth/login", { body: { email, password } });
        set({ mode: "account", token: res.token, user: res.user, offline: false });
        return res.user;
      },

      startDemo: () => set({ mode: "demo", token: null, user: { ...DEMO_USER }, offline: false }),

      logout: () => set({ mode: null, token: null, user: null, offline: false }),

      refresh: async () => {
        const { mode, token } = get();
        if (mode !== "account" || !token) return;
        try {
          const user = await apiRequest<User>("GET", "/api/v1/auth/me", { token });
          set({ user, offline: false });
        } catch (e) {
          if (e instanceof ApiError && e.status === 401) get().logout();
          else if (e instanceof ApiError && e.status === 0) set({ offline: true });
        }
      },

      updatePreferences: async (prefs) => {
        const { mode, token, user } = get();
        if (!user) throw new ApiError(401, "Not signed in");
        if (mode === "demo") {
          const next = { ...user, ...prefs };
          set({ user: next });
          return next;
        }
        const next = await apiRequest<User>("PATCH", "/api/v1/users/me", { token, body: prefs });
        set({ user: next, offline: false });
        return next;
      },

      changePassword: async (current, next) => {
        await apiRequest<void>("POST", "/api/v1/users/me/password", {
          token: get().token,
          body: { current_password: current, new_password: next },
        });
      },

      deleteAccount: async (password) => {
        // The caller navigates to /logout, which clears the session after leaving protected pages
        await apiRequest<void>("POST", "/api/v1/users/me/delete", { token: get().token, body: { password } });
      },
    }),
    {
      name: "atmosfusion.session",
      partialize: (s) => ({ mode: s.mode, token: s.token, user: s.user }),
    }
  )
);

export function firstName(user: User | null): string {
  return user?.name.split(" ")[0] ?? "there";
}
