"use client";

import { useState } from "react";
import { useCreate, useDelete, useList, useUpdate } from "@refinedev/core";
import {
  Alert,
  App,
  Button,
  Card,
  Flex,
  Form,
  Input,
  InputNumber,
  Modal,
  Select,
  Space,
  Switch,
  Table,
  Tag,
  Typography,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { BrainCircuit, PlugZap, Plus, Pencil, RefreshCw, Trash2, X } from "lucide-react";
import { requestAdminEnvelope } from "@/lib/admin/http";

const PRESETS: Record<
  string,
  {
    label: string;
    provider_type: string;
    base_url: string;
    model: string;
    supports_json_mode: boolean;
    models: string[];
  }
> = {
  openai: {
    label: "OpenAI (ChatGPT)",
    provider_type: "openai_compatible",
    base_url: "https://api.openai.com/v1",
    model: "gpt-4o-mini",
    supports_json_mode: true,
    models: ["gpt-4o-mini", "gpt-4o", "gpt-4.1-mini", "o3-mini"],
  },
  anthropic: {
    label: "Anthropic (Claude)",
    provider_type: "anthropic",
    base_url: "https://api.anthropic.com",
    model: "claude-sonnet-4-20250514",
    supports_json_mode: false,
    models: ["claude-sonnet-4-20250514", "claude-opus-4-20250514", "claude-haiku-4-20250514"],
  },
  gemini: {
    label: "Google Gemini",
    provider_type: "openai_compatible",
    base_url: "https://generativelanguage.googleapis.com/v1beta/openai/",
    model: "gemini-flash-latest",
    supports_json_mode: true,
    models: ["gemini-flash-latest"],
  },
  grok: {
    label: "xAI Grok",
    provider_type: "openai_compatible",
    base_url: "https://api.x.ai/v1",
    model: "grok-4-fast-mini",
    supports_json_mode: true,
    models: ["grok-4-fast-mini"],
  },
  custom: {
    label: "Custom (OpenAI-compatible)",
    provider_type: "openai_compatible",
    base_url: "",
    model: "",
    supports_json_mode: true,
    models: [],
  },
};

type AiProviderRecord = {
  id: string;
  key: string;
  label: string;
  provider_type: string;
  base_url: string;
  model: string;
  available_models: string[];
  masked_key: string;
  enabled: boolean;
  priority: number;
  timeout_seconds: number;
  max_tokens: number;
  temperature: number | null;
  supports_json_mode: boolean;
  rpm_limit: number | null;
  is_default: boolean;
};

type FormValues = {
  key: string;
  label: string;
  provider_type: string;
  base_url: string;
  model: string;
  api_key: string;
  enabled: boolean;
  priority: number;
  timeout_seconds: number;
  max_tokens: number;
  temperature: number | null;
  supports_json_mode: boolean;
  rpm_limit: number | null;
  is_default: boolean;
  available_models: string[];
};

const emptyForm: FormValues = {
  key: "custom",
  label: "",
  provider_type: "openai_compatible",
  base_url: "",
  model: "",
  api_key: "",
  enabled: true,
  priority: 100,
  timeout_seconds: 60,
  max_tokens: 4096,
  temperature: null,
  supports_json_mode: true,
  rpm_limit: null,
  is_default: false,
  available_models: [],
};

export function AdminAiProvidersPage() {
  const { message } = App.useApp();
  const [form] = Form.useForm<FormValues>();
  const [editing, setEditing] = useState<AiProviderRecord | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState<Record<string, boolean>>({});
  const [testResults, setTestResults] = useState<Record<string, { ok: boolean; text: string }>>({});
  const [modelsRecord, setModelsRecord] = useState<AiProviderRecord | null>(null);
  const [modelsOpen, setModelsOpen] = useState(false);
  const [newModelName, setNewModelName] = useState("");
  const [modelsSyncing, setModelsSyncing] = useState(false);
  const [availableModels, setAvailableModels] = useState<string[]>([]);

  const { query: listQuery, result: listResult } = useList<AiProviderRecord>({
    resource: "ai/providers",
    sorters: [{ field: "priority", order: "asc" }],
    pagination: { pageSize: 100 },
  });
  const isLoading = listQuery.isLoading;
  const refetch = listQuery.refetch;
  const { mutateAsync: createProvider } = useCreate();
  const { mutateAsync: updateProvider } = useUpdate();
  const { mutateAsync: deleteProvider } = useDelete();

  const providers = listResult.data ?? [];

  const openCreate = () => {
    setEditing(null);
    form.setFieldsValue({ ...emptyForm, key: "openai" });
    applyPreset("openai");
    setModalOpen(true);
  };

  const openEdit = (record: AiProviderRecord) => {
    setEditing(record);
    form.setFieldsValue({
      key: record.key,
      label: record.label,
      provider_type: record.provider_type,
      base_url: record.base_url,
      model: record.model,
      api_key: "",
      enabled: record.enabled,
      priority: record.priority,
      timeout_seconds: record.timeout_seconds,
      max_tokens: record.max_tokens,
      temperature: record.temperature,
      supports_json_mode: record.supports_json_mode,
      rpm_limit: record.rpm_limit,
      is_default: record.is_default,
      available_models: record.available_models ?? [],
    });
    setModalOpen(true);
  };

  const applyPreset = (key: string) => {
    const preset = PRESETS[key];
    if (!preset) return;
    form.setFieldsValue({
      label: preset.label,
      provider_type: preset.provider_type,
      base_url: preset.base_url,
      model: preset.model,
      supports_json_mode: preset.supports_json_mode,
      available_models: preset.models,
    });
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);
      const payload = {
        ...values,
        api_key: values.api_key || undefined,
        temperature: values.temperature ?? null,
        rpm_limit: values.rpm_limit ?? null,
      };
      if (editing) {
        await updateProvider({
          resource: "ai/providers",
          id: editing.id,
          values: payload,
        });
        message.success(`${editing.label} updated.`);
      } else {
        await createProvider({
          resource: "ai/providers",
          values: payload,
        });
        message.success("AI provider created.");
      }
      setModalOpen(false);
      await refetch();
    } catch {
      // validation or request errors are surfaced by antd/message
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (record: AiProviderRecord) => {
    Modal.confirm({
      title: `Delete ${record.label}?`,
      content: "Its API key (if any) will be permanently removed. Autofill will fall back to other providers.",
      okText: "Delete",
      okButtonProps: { danger: true },
      onOk: async () => {
        await deleteProvider({ resource: "ai/providers", id: record.id });
        message.success(`${record.label} deleted.`);
        await refetch();
      },
    });
  };

  const handleTest = async (record: AiProviderRecord) => {
    setTesting((prev) => ({ ...prev, [record.id]: true }));
    try {
      const response = await requestAdminEnvelope<{ latency_ms?: number; model?: string }>(
        `admin/ai/providers/${record.id}/test/`,
        { method: "POST", body: {} },
      );
      const latency = response.data?.latency_ms;
      setTestResults((prev) => ({
        ...prev,
        [record.id]: {
          ok: response.success,
          text: response.success
            ? `Connected (${latency}ms)`
            : response.message || "Connection failed.",
        },
      }));
      if (response.success) {
        message.success(`Connected (${latency}ms)`);
      } else {
        message.error(response.message || "Connection failed.");
      }
    } catch (error) {
      const text = error instanceof Error ? error.message : "Connection failed.";
      setTestResults((prev) => ({ ...prev, [record.id]: { ok: false, text } }));
      message.error(text);
    } finally {
      setTesting((prev) => ({ ...prev, [record.id]: false }));
    }
  };

  const toggleEnabled = async (record: AiProviderRecord, enabled: boolean) => {
    await updateProvider({
      resource: "ai/providers",
      id: record.id,
      values: { enabled },
    });
    await refetch();
  };

  const openManageModels = (record: AiProviderRecord) => {
    setModelsRecord(record);
    setAvailableModels(record.available_models ?? []);
    setNewModelName("");
    setModelsOpen(true);
  };

  const refreshModelsRecord = async () => {
    refetch();
  };

  const handleAddModel = async () => {
    const name = newModelName.trim();
    if (!modelsRecord || !name) return;
    const updated = await requestAdminEnvelope<{ available_models: string[] }>(
      `admin/ai/providers/${modelsRecord.id}/models/`,
      { method: "POST", body: { name } },
    );
    if (updated.success) {
      setAvailableModels(updated.data?.available_models ?? []);
      setNewModelName("");
      message.success(`Added "${name}".`);
      await refreshModelsRecord();
    } else {
      message.error(updated.message || "Failed to add model.");
    }
  };

  const handleRemoveModel = async (name: string) => {
    if (!modelsRecord) return;
    const updated = await requestAdminEnvelope<{ available_models: string[] }>(
      `admin/ai/providers/${modelsRecord.id}/models/?name=${encodeURIComponent(name)}`,
      { method: "DELETE" },
    );
    if (updated.success) {
      setAvailableModels(updated.data?.available_models ?? []);
      message.success(`Removed "${name}".`);
      await refreshModelsRecord();
    } else {
      message.error(updated.message || "Failed to remove model.");
    }
  };

  const handleSyncModels = async () => {
    if (!modelsRecord) return;
    setModelsSyncing(true);
    try {
      const updated = await requestAdminEnvelope<{ available_models: string[] }>(
        `admin/ai/providers/${modelsRecord.id}/models/sync/`,
        { method: "POST", body: {} },
      );
      if (updated.success) {
        setAvailableModels(updated.data?.available_models ?? []);
        message.success(updated.message || "Models synced.");
        await refreshModelsRecord();
      } else {
        message.error(updated.message || "Sync failed.");
      }
    } catch (error) {
      message.error(error instanceof Error ? error.message : "Sync failed.");
    } finally {
      setModelsSyncing(false);
    }
  };

  const handleSetModel = async (record: AiProviderRecord, model: string) => {
    await updateProvider({
      resource: "ai/providers",
      id: record.id,
      values: { model },
    });
    message.success(`Active model set to "${model}".`);
    await refetch();
  };

  const setDefault = async (record: AiProviderRecord) => {
    await updateProvider({
      resource: "ai/providers",
      id: record.id,
      values: { is_default: true },
    });
    message.success(`${record.label} is now the default AI provider.`);
    await refetch();
  };

  const columns: ColumnsType<AiProviderRecord> = [
    {
      title: "Provider",
      key: "provider",
      render: (_, record) => (
        <Flex vertical gap={2}>
          <Space size={6}>
            <Typography.Text strong>{record.label}</Typography.Text>
            {record.is_default && <Tag color="gold">Default</Tag>}
          </Space>
          <Typography.Text type="secondary" style={{ fontSize: 11, fontFamily: "monospace" }}>
            {record.key} · priority {record.priority}
          </Typography.Text>
        </Flex>
      ),
    },
    {
      title: "Type",
      dataIndex: "provider_type",
      width: 180,
      render: (value: string) => (
        <Tag>{value === "anthropic" ? "Anthropic API" : "OpenAI-compatible"}</Tag>
      ),
    },
    {
      title: "Model",
      dataIndex: "model",
      width: 240,
      render: (value: string, record) => (
        <Flex vertical gap={2}>
          <Select
            size="small"
            variant="borderless"
            value={value}
            style={{ width: "100%", maxWidth: 220 }}
            options={(record.available_models?.length
              ? record.available_models
              : [value]
            ).map((m) => ({ value: m, label: m }))}
            onChange={(model) => handleSetModel(record, model)}
          />
          <Typography.Text type="secondary" style={{ fontSize: 11 }}>
            {record.available_models?.length
              ? `${record.available_models.length} model${record.available_models.length === 1 ? "" : "s"} in registry`
              : "No registry"}
          </Typography.Text>
        </Flex>
      ),
    },
    {
      title: "API Key",
      key: "key",
      width: 130,
      render: (_, record) =>
        record.masked_key ? (
          <Typography.Text type="secondary" style={{ fontSize: 12, fontFamily: "monospace" }}>
            {record.masked_key}
          </Typography.Text>
        ) : (
          <Tag color="warning" icon={<X size={10} />}>
            No key set
          </Tag>
        ),
    },
    {
      title: "Enabled",
      dataIndex: "enabled",
      width: 90,
      render: (value: boolean, record) => (
        <Switch size="small" checked={value} onChange={(checked) => toggleEnabled(record, checked)} />
      ),
    },
    {
      title: "Connection",
      key: "test",
      width: 210,
      render: (_, record) => (
        <Flex vertical gap={4}>
          <Button
            size="small"
            icon={<PlugZap size={12} />}
            loading={testing[record.id]}
            disabled={!record.masked_key}
            onClick={() => handleTest(record)}
          >
            Test
          </Button>
          {testResults[record.id] && (
            <Typography.Text
              type={testResults[record.id].ok ? "success" : "danger"}
              style={{ fontSize: 11 }}
            >
              {testResults[record.id].text}
            </Typography.Text>
          )}
        </Flex>
      ),
    },
    {
      title: "",
      key: "actions",
      width: 220,
      render: (_, record) => (
        <Space size={4}>
          {!record.is_default && record.masked_key && (
            <Button size="small" type="text" onClick={() => setDefault(record)}>
              Make default
            </Button>
          )}
          <Button size="small" type="text" icon={<RefreshCw size={13} />} onClick={() => openManageModels(record)}>
            Models
          </Button>
          <Button size="small" type="text" icon={<Pencil size={13} />} onClick={() => openEdit(record)} />
          <Button size="small" type="text" danger icon={<Trash2 size={13} />} onClick={() => handleDelete(record)} />
        </Space>
      ),
    },
  ];

  return (
    <Flex vertical gap={16}>
      <Flex justify="space-between" align="center" wrap="wrap" gap={12}>
        <Flex align="center" gap={10}>
          <BrainCircuit size={22} />
          <Typography.Title level={4} style={{ margin: 0 }}>
            AI Providers
          </Typography.Title>
        </Flex>
        <Button type="primary" icon={<Plus size={14} />} onClick={openCreate}>
          Add provider
        </Button>
      </Flex>

      <Alert
        type="info"
        showIcon
        message="How autofill uses providers"
        description={
          <div>
            Enabled providers form a <b>fallback chain</b> — the one with the lowest priority value runs first, and
            autofill automatically retries the next provider on rate limits, timeouts, or outages. API keys are stored
            encrypted and are never shown again after saving. Use <b>Test</b> to verify a connection before enabling it.
          </div>
        }
      />

      <Card className="admin-soft-panel" variant="borderless">
        <Table
          rowKey="id"
          columns={columns}
          dataSource={providers}
          loading={isLoading}
          pagination={false}
          scroll={{ x: 980 }}
        />
      </Card>

      <Modal
        open={modalOpen}
        title={editing ? `Edit ${editing.label}` : "Add AI provider"}
        width={640}
        onCancel={() => setModalOpen(false)}
        onOk={handleSubmit}
        okText={saving ? "Saving..." : "Save"}
        okButtonProps={{ loading: saving }}
        destroyOnClose
      >
        <Form form={form} layout="vertical" initialValues={emptyForm} style={{ marginTop: 8 }}>
          <Form.Item name="available_models" hidden>
            <Input type="hidden" />
          </Form.Item>
          <Form.Item name="key" label="Provider key" rules={[{ required: true, message: "Choose a provider" }]}>
            <Select
              disabled={Boolean(editing)}
              onChange={applyPreset}
              options={Object.entries(PRESETS).map(([value, preset]) => ({ value, label: preset.label }))}
            />
          </Form.Item>
          <Form.Item name="label" label="Display label" rules={[{ required: true, message: "Label is required" }]}>
            <Input placeholder="e.g. OpenAI (ChatGPT)" />
          </Form.Item>
          <Flex gap={12}>
            <Form.Item name="provider_type" label="API format" style={{ flex: 1 }} rules={[{ required: true }]}>
              <Select
                options={[
                  { value: "openai_compatible", label: "OpenAI-compatible (/chat/completions)" },
                  { value: "anthropic", label: "Anthropic Messages API" },
                ]}
              />
            </Form.Item>
            <Form.Item
              name="supports_json_mode"
              label="JSON mode"
              valuePropName="checked"
              tooltip="Provider honors response_format=json_object (OpenAI, Gemini, Grok). Disable for Anthropic."
            >
              <Switch />
            </Form.Item>
          </Flex>
          <Form.Item name="base_url" label="Base URL" rules={[{ required: true, message: "Base URL is required" }]}>
            <Input placeholder="https://api.openai.com/v1" />
          </Form.Item>
          <Form.Item name="model" label="Model" rules={[{ required: true, message: "Model is required" }]}>
            <Input placeholder="gpt-4o-mini" />
          </Form.Item>
          <Form.Item
            name="api_key"
            label={editing ? "API key (leave blank to keep existing)" : "API key"}
            extra={editing ? "The existing key is stored encrypted and will not be shown." : "Stored encrypted (Fernet)."}
          >
            <Input.Password
              placeholder={editing ? "•••••••••••• (unchanged)" : "sk-..."}
              autoComplete="new-password"
            />
          </Form.Item>
          <Flex gap={12} wrap>
            <Form.Item name="priority" label="Priority (fallback order)" style={{ width: 200 }}>
              <InputNumber min={0} style={{ width: "100%" }} />
            </Form.Item>
            <Form.Item name="timeout_seconds" label="Timeout (s)" style={{ width: 150 }}>
              <InputNumber min={5} max={600} style={{ width: "100%" }} />
            </Form.Item>
            <Form.Item name="max_tokens" label="Max tokens" style={{ width: 150 }}>
              <InputNumber min={64} max={128000} style={{ width: "100%" }} />
            </Form.Item>
          </Flex>
          <Flex gap={12} wrap>
            <Form.Item name="temperature" label="Temperature (optional)" style={{ width: 200 }}>
              <InputNumber min={0} max={1} step={0.1} style={{ width: "100%" }} />
            </Form.Item>
            <Form.Item name="rpm_limit" label="Requests/min cap (optional)" style={{ width: 200 }}>
              <InputNumber min={1} style={{ width: "100%" }} />
            </Form.Item>
            <Form.Item name="enabled" label="Enabled" valuePropName="checked" style={{ marginBottom: 8 }}>
              <Switch />
            </Form.Item>
          </Flex>
          {!editing && (
            <Form.Item name="is_default" label="Set as default provider" valuePropName="checked" style={{ marginBottom: 8 }}>
              <Switch />
            </Form.Item>
          )}
        </Form>
      </Modal>

      <Modal
        open={modelsOpen}
        title={`Manage models — ${modelsRecord?.label ?? ""}`}
        width={560}
        onCancel={() => setModelsOpen(false)}
        footer={null}
        destroyOnClose
      >
        <Flex vertical gap={16}>
          <Alert
            type="info"
            showIcon
            message={`Active model: ${modelsRecord?.model ?? ""}`}
            description="The registry below populates the Model dropdown. Add or remove model names freely; they are suggestions and do not need to be fetched from the provider first."
          />
          <Flex gap={8}>
            <Input
              placeholder="Model name, e.g. gpt-4o-mini"
              value={newModelName}
              onChange={(e) => setNewModelName(e.target.value)}
              onPressEnter={handleAddModel}
              disabled={!modelsRecord?.masked_key}
            />
            <Button type="primary" icon={<Plus size={14} />} onClick={handleAddModel} disabled={!newModelName.trim() || !modelsRecord?.masked_key}>
              Add
            </Button>
          </Flex>
          <Flex vertical gap={8}>
            {availableModels.map((name) => (
              <Flex key={name} justify="space-between" align="center" gap={8}>
                <Typography.Text style={{ fontFamily: "monospace", fontSize: 12 }}>{name}</Typography.Text>
                <Space>
                  <Button
                    size="small"
                    type="primary"
                    disabled={name === modelsRecord?.model}
                    onClick={() => handleSetModel(modelsRecord!, name)}
                  >
                    Use
                  </Button>
                  <Button size="small" type="text" danger icon={<Trash2 size={12} />} onClick={() => handleRemoveModel(name)} />
                </Space>
              </Flex>
            ))}
            {availableModels.length === 0 && (
              <Typography.Text type="secondary">No models in the registry yet.</Typography.Text>
            )}
          </Flex>
          <Flex gap={8}>
            <Button
              icon={<RefreshCw size={14} />}
              loading={modelsSyncing}
              disabled={!modelsRecord?.masked_key}
              onClick={handleSyncModels}
            >
              Sync from provider
            </Button>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              Fetch the provider&apos;s live model list and merge it into the registry.
            </Typography.Text>
          </Flex>
        </Flex>
      </Modal>
    </Flex>
  );
}
