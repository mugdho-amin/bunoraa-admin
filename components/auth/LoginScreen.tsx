"use client";

import { useMemo, useState } from "react";
import {
  Alert,
  Button,
  Card,
  Flex,
  Form,
  Input,
  Select,
  Space,
  Tag,
  Typography,
} from "antd";
import { KeyRound, LayoutDashboard, ShieldCheck, Sparkles } from "lucide-react";
import { loginWithPassword, verifyMfaCode } from "@/lib/admin/auth-provider";
import { getPendingMfaChallenge } from "@/lib/admin/auth-storage";
import { useAdminBootstrap } from "@/lib/admin/bootstrap-context";
import { AdminApiError } from "@/lib/admin/http";

type LoginFields = {
  email: string;
  password: string;
};

type MfaFields = {
  method: string;
  code: string;
};

const methodLabel: Record<string, string> = {
  totp: "Authenticator App",
  backup_code: "Backup Code",
  passkey: "Passkey",
};

const featureCards = [
  {
    icon: <LayoutDashboard size={18} />,
    title: "Operational Control",
    description: "Orders, catalog, payments, shipping, support, and analytics from one cockpit.",
  },
  {
    icon: <ShieldCheck size={18} />,
    title: "Security First",
    description: "JWT auth, MFA-aware flows, audit logging, and environment health visibility by default.",
  },
  {
    icon: <Sparkles size={18} />,
    title: "Refine + Dynamic Metadata",
    description: "A schema-driven workspace that stays aligned with your Django admin API as it grows.",
  },
];

export function LoginScreen() {
  const { refreshBootstrap } = useAdminBootstrap();
  const [loginForm] = Form.useForm<LoginFields>();
  const [mfaForm] = Form.useForm<MfaFields>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pendingChallenge = getPendingMfaChallenge();

  const defaultMethod = useMemo(() => pendingChallenge?.methods?.[0] ?? "totp", [pendingChallenge?.methods]);

  const handleLogin = async (values: LoginFields) => {
    setLoading(true);
    setError(null);
    try {
      const result = await loginWithPassword(values.email, values.password);
      if (result.requiresMfa) {
        mfaForm.setFieldsValue({ method: result.methods[0] ?? "totp" });
        return;
      }
      if (!await refreshBootstrap()) return;
      window.location.href = "/dashboard";
    } catch (error) {
      setError(error instanceof AdminApiError ? error.message : "Unable to sign in.");
    } finally {
      setLoading(false);
    }
  };

  const handleMfa = async (values: MfaFields) => {
    setLoading(true);
    setError(null);
    try {
      await verifyMfaCode(values.method, values.code);
      if (!await refreshBootstrap()) return;
      window.location.href = "/dashboard";
    } catch (error) {
      setError(error instanceof AdminApiError ? error.message : "MFA verification failed.");
    } finally {
      setLoading(false);
    }
  };

  const showMfa = Boolean(pendingChallenge);

  return (
    <div className="admin-login-page">
      <div className="admin-login-grid">
        <div className="admin-glass-card admin-shell-gradient" style={{ padding: "clamp(16px, 4vw, 32px)" }}>
          <Tag bordered={false} color="cyan" style={{ paddingInline: 12, borderRadius: 999 }}>
            Bunoraa Admin v2
          </Tag>
          <Typography.Title level={1} className="admin-display" style={{ marginTop: 18, marginBottom: 12 }}>
            Premium operations, without replacing your trusted v1.
          </Typography.Title>
          <Typography.Paragraph style={{ fontSize: 16, color: "rgba(15, 23, 42, 0.8)", maxWidth: 680 }}>
            This workspace runs in parallel with Django admin, reuses your existing staff APIs, and is designed
            for a gradual, low-risk rollout.
          </Typography.Paragraph>

          <Space direction="vertical" size={18} style={{ width: "100%", marginTop: 28 }}>
            {featureCards.map((item) => (
              <div key={item.title} className="admin-soft-panel" style={{ padding: 20 }}>
                <Flex align="flex-start" gap={14}>
                  <Flex
                    align="center"
                    justify="center"
                    style={{
                      width: 42,
                      height: 42,
                      borderRadius: 14,
                      background: "linear-gradient(135deg, rgba(15, 118, 110, 0.18), rgba(29, 78, 216, 0.18))",
                    }}
                  >
                    {item.icon}
                  </Flex>
                  <div>
                    <Typography.Title level={4} style={{ marginTop: 0, marginBottom: 6 }}>
                      {item.title}
                    </Typography.Title>
                    <Typography.Text type="secondary">{item.description}</Typography.Text>
                  </div>
                </Flex>
              </div>
            ))}
          </Space>
        </div>

        <Card className="admin-glass-card" style={{ borderRadius: 28 }}>
          <Flex vertical gap={20}>
            <div>
              <Typography.Title level={2} className="admin-display" style={{ marginBottom: 8 }}>
                {showMfa ? "Verify your identity" : "Sign in to Admin v2"}
              </Typography.Title>
              <Typography.Text type="secondary">
                {showMfa
                  ? `Complete the MFA step for ${pendingChallenge?.email ?? "your account"}.`
                  : "Use your staff credentials. MFA is supported automatically."}
              </Typography.Text>
            </div>

            {error ? <Alert type="error" message={error} showIcon /> : null}

            {!showMfa ? (
              <Form<LoginFields> form={loginForm} layout="vertical" onFinish={handleLogin}>
                <Form.Item label="Email" name="email" rules={[{ required: true, type: "email" }]}>
                  <Input size="large" autoComplete="email" placeholder="admin@bunoraa.com" />
                </Form.Item>
                <Form.Item label="Password" name="password" rules={[{ required: true }]}>
                  <Input.Password
                    size="large"
                    autoComplete="current-password"
                    placeholder="Enter your password"
                    prefix={<KeyRound size={16} />}
                  />
                </Form.Item>
                <Button type="primary" htmlType="submit" size="large" block loading={loading}>
                  Continue
                </Button>
              </Form>
            ) : (
              <Form<MfaFields>
                form={mfaForm}
                layout="vertical"
                onFinish={handleMfa}
                initialValues={{ method: defaultMethod }}
              >
                <Form.Item label="Verification Method" name="method" rules={[{ required: true }]}>
                  <Select
                    size="large"
                    options={(pendingChallenge?.methods ?? [defaultMethod]).map((method) => ({
                      value: method,
                      label: methodLabel[method] ?? method,
                    }))}
                  />
                </Form.Item>
                <Form.Item label="Verification Code" name="code" rules={[{ required: true }]}>
                  <Input size="large" autoComplete="one-time-code" placeholder="123456 or backup code" />
                </Form.Item>
                <Space direction="vertical" style={{ width: "100%" }}>
                  <Button type="primary" htmlType="submit" size="large" block loading={loading}>
                    Verify and continue
                  </Button>
                  <Button
                    block
                    size="large"
                    onClick={() => {
                      window.localStorage.removeItem("bunoraa-admin-v2:mfa-challenge");
                      window.location.reload();
                    }}
                  >
                    Start over
                  </Button>
                </Space>
              </Form>
            )}
          </Flex>
        </Card>
      </div>
    </div>
  );
}
