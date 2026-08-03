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
  intervalMs?: number;
  getPayload?: (data: T) => Record<string, unknown>;
  onCreated?: (newId: string | number, data?: Record<string, unknown>) => void;
  onSaved?: (data: Record<string, unknown>) => void;
};

export function useAutoSave<T>({
  resource,
  formData,
  id,
  enabled = true,
  debounceMs = 3000,
  intervalMs = 0,
  getPayload,
  onCreated,
  onSaved,
}: UseAutoSaveOptions<T>) {
  const [draftId, setDraftId] = useState<string | number | null>(id ?? null);
  const [status, setStatus] = useState<AutoSaveStatus>("idle");
  const [lastSaved, setLastSaved] = useState<number | null>(null);
  const lastSnapshot = useRef<string>(JSON.stringify(formData));
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saving = useRef(false);
  const mounted = useRef(true);
  const flushResolve = useRef<((data?: Record<string, unknown>) => void) | null>(null);

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

    let responseData: Record<string, unknown> | undefined;
    try {
      if (draftId) {
        responseData = await requestAdminData<Record<string, unknown>>(
          `/admin/${resource}/${draftId}`,
          { method: "PATCH", body: payload },
        );
      } else {
        responseData = await requestAdminData<Record<string, unknown>>(
          `/admin/${resource}`,
          { method: "POST", body: { ...payload, is_active: false } },
        );
        const newId = responseData?.id as string | number | undefined;
        if (newId && mounted.current) {
          setDraftId(newId);
        }
      }

      if (mounted.current) {
        lastSnapshot.current = JSON.stringify(formData);
        setStatus("saved");
        setLastSaved(Date.now());
        setTimeout(() => {
          if (mounted.current) setStatus("idle");
        }, 3000);

        if (draftId) {
          onSaved?.(responseData ?? {});
        } else {
          const newId = responseData?.id as string | number | undefined;
          if (newId) onCreated?.(newId, responseData);
        }
      }
      flushResolve.current?.(responseData);
      flushResolve.current = null;
    } catch (err) {
      if (mounted.current) {
        setStatus("error");
        console.warn("[useAutoSave] failed to save draft:", err);
        setTimeout(() => {
          if (mounted.current) setStatus("idle");
        }, 4000);
      }
      flushResolve.current?.(undefined);
      flushResolve.current = null;
    } finally {
      if (mounted.current) saving.current = false;
    }
  }, [draftId, resource, formData, getPayload, onCreated, onSaved]);

  useEffect(() => {
    if (!enabled) return;

    const snapshot = JSON.stringify(formData);
    if (snapshot === lastSnapshot.current) return;

    if (timer.current) clearTimeout(timer.current);

    timer.current = setTimeout(() => {
      if (JSON.stringify(formData) !== lastSnapshot.current) {
        saveDraft();
      }
    }, debounceMs);

    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [enabled, formData, debounceMs, saveDraft]);

  useEffect(() => {
    if (!enabled || !intervalMs || intervalMs <= 0) return;

    const interval = setInterval(() => {
      if (JSON.stringify(formData) !== lastSnapshot.current && !saving.current) {
        saveDraft();
      }
    }, intervalMs);

    return () => clearInterval(interval);
  }, [enabled, intervalMs, formData, saveDraft]);

  const flush = useCallback((): Promise<Record<string, unknown> | undefined> => {
    if (timer.current) clearTimeout(timer.current);
    return new Promise<Record<string, unknown> | undefined>((resolve) => {
      if (!saving.current) {
        saveDraft();
      }
      if (!saving.current) {
        resolve(undefined);
      } else {
        flushResolve.current = resolve;
      }
    });
  }, [saveDraft]);

  return { draftId, status, lastSaved, flush, resetSnapshot };
}
