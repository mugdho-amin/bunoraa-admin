"use client";

import { useEffect, useMemo } from "react";
import {
  Alert,
  Button,
  Flex,
  Form,
  Input,
  InputNumber,
  Select,
  Switch,
  Upload,
} from "antd";
import type { UploadFile } from "antd/es/upload/interface";
import type { AdminFieldSchema } from "@/lib/admin/types";
import { schemaFieldLabel } from "@/lib/admin/utils";

type SchemaFormProps = {
  fields: Record<string, AdminFieldSchema>;
  initialValues?: Record<string, unknown> | null;
  loading?: boolean;
  submitText?: string;
  onSubmit: (values: Record<string, unknown>) => Promise<void>;
};

const JSON_FIELD_NAMES = ["metadata", "payload", "config", "settings", "attributes"];

function isJsonField(name: string, field: AdminFieldSchema) {
  const type = (field.type || "").toLowerCase();
  if (type.includes("object") || type.includes("nested") || type.includes("json")) {
    return true;
  }
  if (type.includes("list") && !field.choices?.length) {
    return true;
  }
  return JSON_FIELD_NAMES.some((candidate) => name.includes(candidate));
}

function normalizeInitialValue(name: string, value: unknown, field: AdminFieldSchema) {
  if (value === null || value === undefined) {
    return undefined;
  }
  if (typeof value === "boolean") {
    return value;
  }
  if (isJsonField(name, field)) {
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return String(value);
    }
  }
  if (Array.isArray(value) && field.choices?.length) {
    return value;
  }
  return value;
}

function normalizeSubmitValue(name: string, value: unknown, field: AdminFieldSchema) {
  if (Array.isArray(value) && value.every((item) => typeof item === "object" && item && "originFileObj" in item)) {
    const files = value as UploadFile[];
    if (files.length === 0) {
      return undefined;
    }
    if (files.length === 1) {
      return files[0].originFileObj;
    }
    return files
      .map((file) => file.originFileObj)
      .filter(Boolean);
  }

  if (typeof value === "string" && isJsonField(name, field)) {
    if (!value.trim()) {
      return undefined;
    }
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }

  return value;
}

function renderInput(name: string, field: AdminFieldSchema) {
  const type = (field.type || "string").toLowerCase();
  const placeholder = field.placeholder || `Enter ${schemaFieldLabel(name, field).toLowerCase()}`;

  if (field.choices?.length) {
    return (
      <Select
        mode={type.includes("multiple") ? "multiple" : undefined}
        placeholder={placeholder}
        options={field.choices.map((choice) => ({
          value: choice.value,
          label: choice.display_name,
        }))}
      />
    );
  }

  if (type.includes("boolean")) {
    return <Switch />;
  }

  if (type.includes("integer") || type.includes("number") || type.includes("float") || type.includes("decimal")) {
    return <InputNumber style={{ width: "100%" }} placeholder={placeholder} />;
  }

  if (type.includes("file") || type.includes("image")) {
    return (
      <Upload beforeUpload={() => false} maxCount={type.includes("list") ? 10 : 1} listType="text">
        <Button>Choose file</Button>
      </Upload>
    );
  }

  if (type.includes("date") || type.includes("time")) {
    return <Input placeholder="Use an ISO value like 2026-05-13 or 2026-05-13T15:30:00Z" />;
  }

  if (isJsonField(name, field)) {
    return <Input.TextArea autoSize={{ minRows: 5, maxRows: 14 }} placeholder="{ }" />;
  }

  if (name.includes("description") || name.includes("content") || name.includes("message") || name.includes("notes")) {
    return <Input.TextArea autoSize={{ minRows: 4, maxRows: 12 }} placeholder={placeholder} />;
  }

  return <Input placeholder={placeholder} />;
}

export function SchemaForm({
  fields,
  initialValues,
  loading = false,
  submitText = "Save changes",
  onSubmit,
}: SchemaFormProps) {
  const [form] = Form.useForm<Record<string, unknown>>();

  const visibleFields = useMemo(
    () =>
      Object.entries(fields).filter(([, field]) => !field.read_only).map(([name, field]) => ({
        name,
        field,
      })),
    [fields],
  );

  useEffect(() => {
    if (!initialValues) {
      form.resetFields();
      return;
    }

    const nextValues = Object.fromEntries(
      visibleFields.map(({ name, field }) => [name, normalizeInitialValue(name, initialValues[name], field)]),
    );
    form.setFieldsValue(nextValues);
  }, [form, initialValues, visibleFields]);

  if (visibleFields.length === 0) {
    return (
      <Alert
        type="warning"
        showIcon
        message="This endpoint did not expose editable serializer fields through OPTIONS metadata."
        description="You can still use the detail and list views, but this screen needs a custom implementation for safe editing."
      />
    );
  }

  return (
    <Form
      form={form}
      layout="vertical"
      onFinish={async (values) => {
        const payload = Object.fromEntries(
          visibleFields.map(({ name, field }) => [name, normalizeSubmitValue(name, values[name], field)]),
        );
        await onSubmit(payload);
      }}
    >
      {visibleFields.map(({ name, field }) => {
        const isBoolean = (field.type || "").toLowerCase().includes("boolean");
        const isUpload = ["file", "image"].some((candidate) => (field.type || "").toLowerCase().includes(candidate));
        return (
          <Form.Item
            key={name}
            label={schemaFieldLabel(name, field)}
            name={name}
            valuePropName={isBoolean ? "checked" : "value"}
            getValueFromEvent={
              isUpload
                ? (event: { fileList?: UploadFile[] }) => event?.fileList ?? []
                : undefined
            }
            rules={[{ required: Boolean(field.required), message: `${schemaFieldLabel(name, field)} is required.` }]}
            extra={field.help_text || undefined}
          >
            {renderInput(name, field)}
          </Form.Item>
        );
      })}
      <Flex justify="flex-end">
        <Button type="primary" htmlType="submit" loading={loading}>
          {submitText}
        </Button>
      </Flex>
    </Form>
  );
}
