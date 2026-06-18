import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/contexts/AuthContext";
import { useIsAdmin } from "@/hooks/useIsAdmin";

/**
 * Contrôle d'accès au CRM.
 * Autorisé si admin OU si email présent dans `acces_autorises`.
 * false par défaut tant que la vérification n'est pas terminée.
 */
export function useAcces() {
  const { user } = useAuth();
  const { isAdmin, loading: adminLoading } = useIsAdmin();
  const [inWhitelist, setInWhitelist] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      if (!user?.email) {
        setInWhitelist(false);
        setChecking(false);
        return;
      }
      const email = user.email.toLowerCase();
      const { data, error } = await supabase
        .from("acces_autorises")
        .select("email")
        .ilike("email", email)
        .limit(1);
      if (cancelled) return;
      if (error) {
        console.warn("[useAcces]", error.message);
        setInWhitelist(false);
      } else {
        setInWhitelist(((data as any[]) ?? []).length > 0);
      }
      setChecking(false);
    }
    setChecking(true);
    run();
    return () => { cancelled = true; };
  }, [user?.email]);

  const loading = adminLoading || checking;
  const authorized = !loading && (isAdmin || inWhitelist);
  return { authorized, loading };
}
