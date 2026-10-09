"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { Role } from "@creditsea/shared";
export const API =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api/v1";
export type User = { id: string; fullName: string; email: string; role: Role };
type Context = {
  user: User | null;
  loading: boolean;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
};
const Auth = createContext<Context>({
  user: null,
  loading: true,
  refresh: async () => {},
  logout: async () => {},
});
export async function request<T = unknown>(
  route: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(API + route, {
    credentials: "include",
    ...options,
    headers: {
      ...(options.body instanceof FormData
        ? {}
        : { "Content-Type": "application/json" }),
      ...options.headers,
    },
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    if (
      response.status === 401 &&
      route !== "/auth/login" &&
      typeof window !== "undefined"
    )
      window.dispatchEvent(new Event("creditsea:session-expired"));
    throw new Error(
      body?.error?.message || `Request failed (${response.status})`,
    );
  }
  return body.data as T;
}
export async function fetchDocument(route: string): Promise<Blob> {
  const response = await fetch(API + route, { credentials: "include" });
  if (response.status === 401)
    window.dispatchEvent(new Event("creditsea:session-expired"));
  if (!response.ok) throw new Error("Document could not be opened.");
  return response.blob();
}
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const refresh = useCallback(async () => {
    try {
      setUser(await request<User>("/auth/me"));
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void refresh();
    const expire = () => setUser(null);
    const recheckOnReturn = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    window.addEventListener("creditsea:session-expired", expire);
    document.addEventListener("visibilitychange", recheckOnReturn);
    return () => {
      window.removeEventListener("creditsea:session-expired", expire);
      document.removeEventListener("visibilitychange", recheckOnReturn);
    };
  }, [refresh]);
  const logout = async () => {
    await request("/auth/logout", { method: "POST" });
    setUser(null);
    window.location.href = "/login";
  };
  return (
    <Auth.Provider value={{ user, loading, refresh, logout }}>
      {children}
    </Auth.Provider>
  );
}
export const useAuth = () => useContext(Auth);
export function Protected({
  roles,
  children,
}: {
  roles: Role[];
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();
  if (loading) return <div className="p-10">Checking session…</div>;
  if (!user)
    return (
      <div className="p-10">
        Please <a href="/login">sign in</a>.
      </div>
    );
  if (!roles.includes(user.role))
    return (
      <div className="p-10">
        <h1 className="text-2xl font-bold">Access denied</h1>
        <p>Your role cannot view this page.</p>
        <a href={user.role === "BORROWER" ? "/loans" : "/dashboard"}>
          Go to your portal
        </a>
      </div>
    );
  return <>{children}</>;
}
export const landing = (role: Role) =>
  role === "BORROWER"
    ? "/loans"
    : role === "ADMIN"
      ? "/dashboard"
      : `/dashboard/${role.toLowerCase()}`;
