"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { requestAdminData } from "@/lib/admin/http";

export type AutoSaveStatus = "idle" | "saving" | "saved" | "error";

type UseAutoSaveOptions<T> = {
  resource: string;
  formData: T;
  id?: string | number | null;
  enabled?: boolean;
  debounceMs?: number;
  getPayload?: (data: T) => Record<string, unknown>;
  onCreated?: (newId: string | number, data?: Record<string, unknown>) => void;
};

export function useAutoSave<T>({
  resource,
  formData,
  id,
  enabled = true,
  debounceMs = 3000,
  getPayload,
  onCreated,
}: UseAutoSaveOptions<T>) {
  const [draftId, setDraftId] = useState<string | number | null>(id ?? null);
  const [status, setStatus] = useState<AutoSaveStatus>("idle");
  const [lastSaved, setLastSaved] = useState<number | null>(null);
  const lastSnapshot = useRef<string>(JSON.stringify(formData));
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saving = useRef(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const resetSnapshot = useCallback(() => {
    lastSnapshot.current = JSON.stringify(formData);
  }, [formData]);

  const saveDraft = useCallback(async () => {
    if (saving.current || !mounted.current) return;
    saving.current = true;
    setStatus("saving");

    const payload = getPayload ? getPayload(formData) : (formData as unknown as Record<string, unknown>);

    try {
      if (draftId) {
        await requestAdminData(`/admin/${resource}/${draftId}`, {
          method: "PATCH",
          body: payload,
        });
      } else {
        const data = await requestAdminData<Record<string, unknown>>(
          `/admin/${resource}`,
          { method: "POST", body: { ...payload, is_active: false } },
        );
        const newId = data?.id as string | number | undefined;
        if (newId && mounted.current) {
          setDraftId(newId);
          onCreated?.(newId, data);
        }
      }

      if (mounted.current) {
        lastSnapshot.current = JSON.stringify(formData);
        setStatus("saved");
        setLastSaved(Date.now());
        setTimeout(() => {
          if (mounted.current) setStatus("idle");
        }, 3000);
      }
    } catch (err) {
      if (mounted.current) {
        setStatus("error");
        console.warn("[useAutoSave] failed to save draft:", err);
        setTimeout(() => {
          if (mounted.current) setStatus("idle");
        }, 4000);
      }
    } finally {
      if (mounted.current) saving.current = false;
    }
  }, [draftId, resource, formData, getPayload, onCreated]);

  useEffect(() => {
    if (!enabled) return;

    const snapshot = JSON.stringify(formData);
    if (snapshot === lastSnapshot.current) return;

    if (timer.current) clearTimeout(timer.current);

    timer.current = setTimeout(() => {
      saveDraft();
    }, debounceMs);

    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [enabled, formData, debounceMs, saveDraft]);

  const flush = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    saveDraft();
  }, [saveDraft]);

  return { draftId, status, lastSaved, flush, resetSnapshot };
}
