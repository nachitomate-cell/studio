"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { doc, FieldValue, increment, runTransaction } from "firebase/firestore";
import { db } from "@/lib/firebase";

export type SyncStatus = "idle" | "syncing" | "synced" | "error";

const queueKey = (uid: string) => `bac_pending_stamps_${uid}`;
const SYNCED_FLASH_MS = 2500;
const ERROR_FLASH_MS = 3000;

function readQueue(uid: string): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(queueKey(uid));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function writeQueue(uid: string, items: string[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(queueKey(uid), JSON.stringify(items));
  } catch {
    // Quota exceeded / storage disabled — no fallback needed.
  }
}

export function useBacOfflineSync(uid: string | null) {
  const [pending, setPending] = useState<string[]>([]);
  const [isOnline, setIsOnline] = useState(() =>
    typeof navigator === "undefined" ? true : navigator.onLine
  );
  const [status, setStatus] = useState<SyncStatus>("idle");

  const pendingRef = useRef<string[]>([]);
  const syncingRef = useRef(false);
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    pendingRef.current = pending;
  }, [pending]);

  useEffect(() => {
    if (!uid) {
      setPending([]);
      return;
    }
    setPending(readQueue(uid));
  }, [uid]);

  const flashStatus = useCallback((s: SyncStatus, ms: number) => {
    setStatus(s);
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    flashTimerRef.current = setTimeout(() => setStatus("idle"), ms);
  }, []);

  const enqueue = useCallback(
    (localId: string) => {
      if (!uid) return;
      setPending((prev) => {
        const next = [...prev, localId];
        writeQueue(uid, next);
        return next;
      });
    },
    [uid]
  );

  const syncQueue = useCallback(async (): Promise<boolean> => {
    if (!uid) return false;
    if (syncingRef.current) return false;
    if (typeof navigator !== "undefined" && !navigator.onLine) return false;

    const items = pendingRef.current;
    if (items.length === 0) return true;

    syncingRef.current = true;
    setStatus("syncing");

    try {
      const counts: Record<string, number> = {};
      for (const id of items) counts[id] = (counts[id] || 0) + 1;

      const userRef = doc(db, "usuarios", uid);
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(userRef);
        const cur = ((snap.exists() ? snap.data()?.sellosBac : {}) || {}) as Record<string, number>;

        let newDistinctVisits = 0;
        for (const id of Object.keys(counts)) {
          if (!(cur[id] > 0)) newDistinctVisits++;
        }

        const updates: Record<string, FieldValue> = {};
        for (const id of Object.keys(counts)) {
          updates[`sellosBac.${id}`] = increment(counts[id]);
        }
        if (newDistinctVisits > 0) {
          updates.bacStampsCount = increment(newDistinctVisits);
        }

        if (snap.exists()) {
          tx.update(userRef, updates);
        } else {
          tx.set(userRef, updates);
        }
      });

      setPending([]);
      writeQueue(uid, []);
      flashStatus("synced", SYNCED_FLASH_MS);
      return true;
    } catch {
      flashStatus("error", ERROR_FLASH_MS);
      return false;
    } finally {
      syncingRef.current = false;
    }
  }, [uid, flashStatus]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onOnline = () => {
      setIsOnline(true);
      void syncQueue();
    };
    const onOffline = () => setIsOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, [syncQueue]);

  // Mount-time flush when a queue survives a page reload with the network up.
  useEffect(() => {
    if (uid && isOnline && pendingRef.current.length > 0) {
      void syncQueue();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid]);

  useEffect(() => {
    return () => {
      if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    };
  }, []);

  return {
    pending,
    pendingCount: pending.length,
    enqueue,
    syncQueue,
    isOnline,
    status,
  };
}
