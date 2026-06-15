import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from "react";
import { client } from "@/lib/neonClient";

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
const auth = client.auth as any;

function normalizeSession(raw: unknown): AuthSession | null {
  if (!raw || typeof raw !== "object") return null;

  const response = raw as Record<string, any>;
  const value = response.data ?? response;
  if (!value || typeof value !== "object") return null;

  const data = value.data ?? value;
  if (!data || typeof data !== "object") return null;

  const user = data.user ?? data.session?.user;
  if (!user) return null;

  const session = data.session ?? data;
  return {
    user: user as AuthUser,
    token: session.token ?? data.token,
    expiresAt: session.expiresAt ?? data.expiresAt,
    ...data,
  };
}

function getAuthError(raw: unknown): Error | null {
  if (!raw || typeof raw !== "object") return null;
  const error = (raw as Record<string, any>).error;
  if (!error) return null;
  return new Error(error.message ?? String(error));
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [session, setSession] = useState<AuthSession | null>(null);
  const [loading, setLoading] = useState(true);

  const applySession = useCallback((raw: unknown) => {
    const nextSession = normalizeSession(raw);
    setSession(nextSession);
    setUser(nextSession?.user ?? null);
  }, []);

  const refreshSession = useCallback(async () => {
    const result = await auth.getSession();
    const error = getAuthError(result);
    if (error) throw error;
    applySession(result);
  }, [applySession]);

  useEffect(() => {
    let mounted = true;
    let unsubscribe: (() => void) | undefined;

    if (auth.useSession?.subscribe) {
      unsubscribe = auth.useSession.subscribe((value: unknown) => {
        if (!mounted) return;
        applySession(value);
        setLoading(false);
      });
    }

    refreshSession()
      .catch((error) => {
        console.error("[AuthContext] getSession error:", error);
        if (mounted) {
          setSession(null);
          setUser(null);
        }
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
      unsubscribe?.();
    };
  }, [applySession, refreshSession]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      try {
        const result = await auth.signIn.email({ email, password });
        const error = getAuthError(result);
        if (error) return { error };
        applySession(result);
        await refreshSession();
        return { error: null };
      } catch (e: any) {
        return { error: new Error(e?.message ?? "Erreur de connexion") };
      }
    },
    [applySession, refreshSession]
  );

  const signOut = useCallback(async () => {
    try {
      await auth.signOut();
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
