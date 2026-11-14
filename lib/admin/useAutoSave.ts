"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { requestAdminData } from "@/lib/admin/http";

export type AutoSaveStatus = "idle" | "saving" | "saved" | "error";
export type AutoSaveFlushResult<T> = {
  data: Record<string, unknown>;
  submittedData: T;
};

type UseAutoSaveOptions<T> = {
  resource: string;
  formData: T;
  id?: string | number | null;
  enabled?: boolean;
  debounceMs?: number;
  intervalMs?: number;
  getPayload?: (data: T) => Record<string, unknown>;
  onCreated?: (newId: string | number, data?: Record<string, unknown>, submittedData?: T) => void;
  onSaved?: (data: Record<string, unknown>, submittedData?: T) => void;
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
  const [, setSnapshotRevision] = useState(0);
  const lastSnapshot = useRef<string>(JSON.stringify(formData));
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saving = useRef(false);
  const flushing = useRef(false);
  const saveAgain = useRef(false);
  const mounted = useRef(true);
  const paused = useRef(false);
  const flushResolve = useRef<((result?: AutoSaveFlushResult<T>) => void) | null>(null);
  const draftIdRef = useRef<string | number | null>(id ?? null);
  const latestFormData = useRef(formData);
  const saveDraftRef = useRef<() => void>(() => undefined);
  draftIdRef.current = draftId;
  latestFormData.current = formData;

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const resetSnapshot = useCallback(() => {
    lastSnapshot.current = JSON.stringify(formData);
    setSnapshotRevision((revision) => revision + 1);
  }, [formData]);

  const saveDraft = useCallback(async () => {
    if (saving.current) {
      saveAgain.current = true;
      return;
    }
    if (!mounted.current || paused.current) return;
    saving.current = true;
    setStatus("saving");

    const payload = getPayload ? getPayload(formData) : (formData as unknown as Record<string, unknown>);

    let responseData: Record<string, unknown> | undefined;
    let succeeded = false;
    try {
      const activeDraftId = draftIdRef.current;
      if (activeDraftId) {
        responseData = await requestAdminData<Record<string, unknown>>(
          `/admin/${resource}/${activeDraftId}`,
          { method: "PATCH", body: payload },
        );
      } else {
        responseData = await requestAdminData<Record<string, unknown>>(
          `/admin/${resource}`,
          { method: "POST", body: { ...payload, is_active: false } },
        );
        const newId = responseData?.id as string | number | undefined;
        if (newId && mounted.current) {
          draftIdRef.current = newId;
          setDraftId(newId);
        }
      }

      if (mounted.current) {
        lastSnapshot.current = JSON.stringify(formData);
        succeeded = true;
        setStatus("saved");
        setLastSaved(Date.now());
        setTimeout(() => {
          if (mounted.current) setStatus("idle");
        }, 3000);

        if (activeDraftId) {
          onSaved?.(responseData ?? {}, formData);
        } else {
          const newId = responseData?.id as string | number | undefined;
          if (newId) onCreated?.(newId, responseData, formData);
        }
      }
      flushResolve.current?.(responseData ? { data: responseData, submittedData: formData } : undefined);
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
      const shouldSaveAgain = saveAgain.current
        || JSON.stringify(latestFormData.current) !== lastSnapshot.current;
      saveAgain.current = false;
      if (succeeded && shouldSaveAgain && !flushing.current && mounted.current && !paused.current) {
        queueMicrotask(() => saveDraftRef.current());
      }
    }
  }, [draftId, resource, formData, getPayload, onCreated, onSaved]);

  saveDraftRef.current = () => { void saveDraft(); };

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

  const flush = useCallback(async (): Promise<AutoSaveFlushResult<T> | undefined> => {
    if (paused.current) return undefined;
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }

    flushing.current = true;
    let latestResult: AutoSaveFlushResult<T> | undefined;
    try {
      while (mounted.current && !paused.current) {
        if (saving.current) {
          latestResult = await new Promise<AutoSaveFlushResult<T> | undefined>((resolve) => {
            flushResolve.current = resolve;
          });
          if (!latestResult) return undefined;
          continue;
        }

        const needsCreate = !draftIdRef.current;
        const needsSave = JSON.stringify(formData) !== lastSnapshot.current;
        if (!needsCreate && !needsSave) return latestResult;

        latestResult = await new Promise<AutoSaveFlushResult<T> | undefined>((resolve) => {
          flushResolve.current = resolve;
          saveDraftRef.current();
          if (!saving.current) {
            flushResolve.current = null;
            resolve(undefined);
          }
        });
        if (!latestResult) return undefined;
      }
      return latestResult;
    } finally {
      flushing.current = false;
    }
  }, [formData]);

  const cancel = useCallback(() => {
    paused.current = true;
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  const resume = useCallback(() => {
    paused.current = false;
  }, []);

  const isDirty = JSON.stringify(formData) !== lastSnapshot.current;

  return { draftId, status, lastSaved, flush, resetSnapshot, cancel, resume, isDirty };
}
