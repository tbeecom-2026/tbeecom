import { useEffect, useRef } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Suivi de présence réel.
 * À la connexion, crée une ligne dans `presence_sessions`, puis met à jour
 * `last_seen` tant que l'onglet est ouvert et visible (battement ~2 min).
 * La durée réelle = last_seen - started_at.
 */
const HEARTBEAT_MS = 120_000; // 2 minutes

export function usePresence() {
  const { user } = useAuth();
  const idRef = useRef<string | null>(null);

  useEffect(() => {
    const uid = user?.id;
    if (!uid) return;

    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | null = null;
    const sid =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

    async function touch() {
      if (!idRef.current) return;
      try {
        await supabase
          .from("presence_sessions")
          .update({ last_seen: new Date().toISOString() })
          .eq("id", idRef.current);
      } catch (e) {
        /* silencieux : un battement raté n'est pas grave */
      }
    }

    async function start() {
      let ip: string | null = null;
      try {
        const r = await fetch("https://api.ipify.org?format=json");
        if (r.ok) ip = (await r.json())?.ip ?? null;
      } catch {
        /* IP optionnelle */
      }
      if (cancelled) return;
      const { error } = await supabase.from("presence_sessions").insert({
        id: sid,
        user_id: uid,
        email: user?.email ?? null,
        user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
        ip,
      });
      if (error) {
        console.warn("[presence]", error.message);
        return;
      }
      if (cancelled) return;
      idRef.current = sid;
      timer = setInterval(() => {
        if (document.visibilityState === "visible") touch();
      }, HEARTBEAT_MS);
    }

    const onVisible = () => {
      if (document.visibilityState === "visible") touch();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("beforeunload", touch);

    start();

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("beforeunload", touch);
      touch();
    };
  }, [user?.id, user?.email]);
}
