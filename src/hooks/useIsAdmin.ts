import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Renvoie true si l'utilisateur courant a profiles.is_admin = true.
 * Renvoie false par défaut (sécurité : on suppose non-admin tant que non vérifié).
 */
export function useIsAdmin() {
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      if (!user?.id) {
        setIsAdmin(false);
        setLoading(false);
        return;
      }
      const { data, error } = await supabase
        .from("profiles")
        .select("is_admin")
        .eq("id", user.id)
        .limit(1);
      if (cancelled) return;
      if (error) {
        console.warn("[useIsAdmin]", error.message);
        setIsAdmin(false);
      } else {
        const row = (data as any[])?.[0];
        setIsAdmin(Boolean(row?.is_admin));
      }
      setLoading(false);
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  return { isAdmin, loading };
}
