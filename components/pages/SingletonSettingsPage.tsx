"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { App, Card, Skeleton, Typography } from "antd";
import { fetchOptionsForSingleton } from "@/lib/admin/bootstrap";
import { requestAdminData } from "@/lib/admin/http";
import type { AdminOptionsResponse } from "@/lib/admin/types";
import { SchemaForm } from "@/components/forms/SchemaForm";

export type SingletonSettingsPageProps = {
  title: string;
  path: string;
  description?: string;
};

function pickActionFields(options?: AdminOptionsResponse) {
  return options?.actions?.PATCH || options?.actions?.PUT || options?.actions?.POST || {};
}

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

  return (
    <Card className="admin-soft-panel" bordered={false}>
      <Typography.Title level={3} className="admin-display">
        {title}
      </Typography.Title>
      {description ? <Typography.Paragraph type="secondary">{description}</Typography.Paragraph> : null}
      {dataQuery.isLoading || optionsQuery.isLoading ? (
        <Skeleton active paragraph={{ rows: 8 }} />
      ) : (
        <SchemaForm
          fields={pickActionFields(optionsQuery.data)}
          initialValues={dataQuery.data}
          loading={submitting}
          submitText="Save settings"
          onSubmit={async (values) => {
            setSubmitting(true);
            try {
              await requestAdminData(`/admin/${path}/`, {
                method: "PATCH",
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
  );
}
