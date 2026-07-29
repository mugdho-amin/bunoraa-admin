"use client";

import { requestAdminEnvelope } from "@/lib/admin/http";

export type VideoUploadResult = {
  url: string;
  key: string;
};

export async function uploadVideo(file: File): Promise<VideoUploadResult> {
  const formData = new FormData();
  formData.append("file", file);

  const res = await requestAdminEnvelope<{ url: string; key: string }>("admin/upload-video/", {
    method: "POST",
    body: formData,
  });

  if (res.success && res.data?.url) {
    return { url: res.data.url, key: res.data.key };
  }

  throw new Error(res.message || "Upload failed");
}
