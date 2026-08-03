"use client";

import { requestAdminEnvelope } from "@/lib/admin/http";

export type ProductAiSuggestion = {
  field_name: string;
  value: unknown;
  display_value: string;
  confidence: number;
  is_null: boolean;
  low_confidence: boolean;
  rationale: string;
  source_urls: string[];
  metadata: Record<string, unknown>;
};

export type ProductAiJob = {
  job_id: string;
  status: "pending" | "running" | "completed" | "failed" | "cancelled";
  progress: number;
  error_message?: string;
  summary?: Record<string, unknown>;
  suggestions?: ProductAiSuggestion[];
};

export async function startProductAutofill(payload: {
  product_id?: string;
  image_keys: string[];
  currency: string;
  locale?: string;
  allow_external?: boolean;
  context_hints?: Record<string, unknown>;
}) {
  const response = await requestAdminEnvelope<ProductAiJob>("admin/product-autofill/start/", {
    method: "POST",
    body: payload,
  });
  if (!response.success || !response.data?.job_id) {
    throw new Error(response.message || "Unable to start AI product analysis.");
  }
  return response.data;
}

export async function getProductAutofill(jobId: string) {
  const response = await requestAdminEnvelope<ProductAiJob>(`admin/product-autofill/${jobId}/`);
  if (!response.success || !response.data) {
    throw new Error(response.message || "Unable to load AI product analysis.");
  }
  return response.data;
}

export async function waitForProductAutofill(jobId: string, timeoutMs = 180_000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const job = await getProductAutofill(jobId);
    if (["completed", "failed", "cancelled"].includes(job.status)) {
      return job;
    }
    await new Promise((resolve) => window.setTimeout(resolve, 2000));
  }
  throw new Error("AI product analysis is still running. Please try again shortly.");
}
