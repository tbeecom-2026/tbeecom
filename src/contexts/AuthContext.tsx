import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import { client } from "@/lib/neonClient";

// Types souples : Better Auth expose une session/user dont le shape exact
// dépend de la config serveur. On reste permissif côté front.
export interface AuthUser {
  id: string;
  email?: string;
  name?: string;
  [key: string]: unknown;
}

export interface AuthSession {
  user: AuthUser;
  token?: string;
  expiresAt?: string | number | Date;
  [key: string]: unknown;
}

interface AuthContextType {
  user: AuthUser | null;
  session: AuthSession | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

function extractSession(raw: unknown): AuthSession | null {
  if (!raw || typeof raw !== "object") return null;
  // Better Auth renvoie typiquement { data: { session, user } } ou { session, user }
  const r = raw as Record<string, any>;
  const inner = r.data ?? r;
  if (!inner) return null;
  const user = inner.user ?? inner.session?.user;
  if (!user) return null;
  return {
    user: user as AuthUser,
    token: inner.session?.token ?? inner.token,
    expiresAt: inner.session?.expiresAt ?? inner.expiresAt,
    ...inner,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [session, setSession] = useState<AuthSession | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshSession = useCallback(async () => {
    try {
      const raw = await (client.auth as any).getSession();
      const s = extractSession(raw);
      setSession(s);
      setUser(s?.user ?? null);
    } catch (e) {
      console.error("[AuthContext] getSession error:", e);
      setSession(null);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshSession();
  }, [refreshSession]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      try {
        const res: any = await (client.auth as any).signIn.email({ email, password });
        if (res?.error) {
          return { error: new Error(res.error.message ?? String(res.error)) };
        }
        await refreshSession();
        return { error: null };
      } catch (e: any) {
        return { error: new Error(e?.message ?? "Erreur de connexion") };
      }
    },
    [refreshSession]
  );

  const signOut = useCallback(async () => {
    try {
      await (client.auth as any).signOut();
    } catch (e) {
      console.error("[AuthContext] signOut error:", e);
    }
    setSession(null);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, session, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
