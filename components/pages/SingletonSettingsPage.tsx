"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Alert, App, Card, Skeleton, Typography } from "antd";
import { fetchOptionsForSingleton } from "@/lib/admin/bootstrap";
import { requestAdminData } from "@/lib/admin/http";
import { pickWritableAction } from "@/lib/admin/write-schema";
import { SchemaForm } from "@/components/forms/SchemaForm";
import { AdminPageHeader } from "@/components/shared/AdminPageHeader";

export type SingletonSettingsPageProps = {
  title: string;
  path: string;
  description?: string;
};

export function SingletonSettingsPage({
  title,
  path,
  description,
}: SingletonSettingsPageProps) {
  const { message } = App.useApp();
  const [submitting, setSubmitting] = useState(false);

  const dataQuery = useQuery({
    queryKey: ["singleton", path],
    queryFn: () => requestAdminData<Record<string, unknown>>(`/admin/${path}/`),
  });

  const optionsQuery = useQuery({
    queryKey: ["singleton-options", path],
    queryFn: () => fetchOptionsForSingleton(path),
  });
  const writeAction = pickWritableAction(optionsQuery.data, ["PATCH", "PUT"], path);

  return (
    <div className="admin-page-stack">
      <AdminPageHeader title={title} eyebrow="Store configuration" description={description} />
      <Card className="admin-soft-panel" bordered={false}>
      {dataQuery.isError ? (
        <Alert type="error" showIcon message="Failed to load settings data." />
      ) : optionsQuery.isError ? (
        <Alert type="error" showIcon message="Failed to load settings schema from API." />
      ) : dataQuery.isLoading || optionsQuery.isLoading ? (
        <Skeleton active paragraph={{ rows: 8 }} />
      ) : (
        <SchemaForm
          fields={writeAction?.fields ?? {}}
          schemaSource={`/admin/${path}/`}
          initialValues={dataQuery.data}
          loading={submitting}
          submitText="Save settings"
          onSubmit={async (values) => {
            setSubmitting(true);
            try {
              await requestAdminData(`/admin/${path}/`, {
                method: writeAction?.method ?? "PATCH",
                body: values,
              });
              message.success("Settings updated successfully.");
              await dataQuery.refetch();
            } finally {
              setSubmitting(false);
            }
          }}
        />
      )}
      </Card>
    </div>
  );
}
