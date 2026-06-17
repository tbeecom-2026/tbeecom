import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Renvoie true si l'utilisateur courant a profiles.is_admin = true.
 * On matche en priorité par EMAIL (c'est ainsi que l'admin est désigné en base),
 * avec repli sur l'id. false par défaut tant que non vérifié (sécurité).
 */
export function useIsAdmin() {
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      if (!user?.id && !user?.email) {
        setIsAdmin(false);
        setLoading(false);
        return;
      }
      // Match par email si dispo (fiable), sinon par id.
      let query = supabase.from("profiles").select("is_admin, email, id");
      if (user?.email) query = query.eq("email", user.email);
      else query = query.eq("id", user.id);

      const { data, error } = await query.limit(1);
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
    return () => { cancelled = true; };
  }, [user?.id, user?.email]);

  return { isAdmin, loading };
}
