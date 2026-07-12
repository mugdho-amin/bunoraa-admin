"use client";

import { useMemo, useState } from "react";
import {
  Alert,
  Button,
  Card,
  Divider,
  Flex,
  Form,
  Input,
  Select,
  Space,
  Tag,
  Typography,
} from "antd";
import {
  KeyRound, LayoutDashboard, ShieldCheck, Sparkles, Eye, EyeOff,
  Mail, Lock, Github, ChromeIcon as Google, ArrowRight,
} from "lucide-react";
import { loginWithPassword, verifyMfaCode } from "@/lib/admin/auth-provider";
import { getPendingMfaChallenge } from "@/lib/admin/auth-storage";
import { useAdminBootstrap } from "@/lib/admin/bootstrap-context";
import { AdminApiError } from "@/lib/admin/http";

type LoginFields = { email: string; password: string };
type MfaFields = { method: string; code: string };

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
  const [showPassword, setShowPassword] = useState(false);
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
        {/* ── Left: Brand / Info Panel ── */}
        <div className="admin-glass-card admin-shell-gradient" style={{ padding: "clamp(20px, 4vw, 40px)", display: "flex", flexDirection: "column" }}>
          <Flex align="center" gap={8} style={{ marginBottom: 8 }}>
            <Tag bordered={false} color="cyan" style={{ paddingInline: 12, borderRadius: 999 }}>
              Bunoraa Admin v2
            </Tag>
            <Tag bordered={false} color="blue" style={{ paddingInline: 8, borderRadius: 999, fontSize: 10 }}>
              Enterprise
            </Tag>
          </Flex>
          <Typography.Title level={1} className="admin-display" style={{ marginTop: 12, marginBottom: 12, fontSize: "clamp(24px, 3vw, 36px)" }}>
            Premium operations, <br />without replacing your <br />trusted v1.
          </Typography.Title>
          <Typography.Paragraph style={{ fontSize: 15, color: "rgba(15, 23, 42, 0.8)", maxWidth: 600, lineHeight: 1.7 }}>
            This workspace runs in parallel with Django admin, reuses your existing staff APIs, and is designed
            for a gradual, low-risk rollout with zero disruption.
          </Typography.Paragraph>

          <div style={{ flex: 1 }} />

          <Space direction="vertical" size={14} style={{ width: "100%" }}>
            {featureCards.map((item) => (
              <div key={item.title} className="admin-soft-panel" style={{ padding: "16px 20px" }}>
                <Flex align="flex-start" gap={14}>
                  <Flex
                    align="center"
                    justify="center"
                    style={{
                      width: 40, height: 40, borderRadius: 12, flexShrink: 0,
                      background: "linear-gradient(135deg, rgba(15, 118, 110, 0.18), rgba(29, 78, 216, 0.18))",
                    }}
                  >
                    {item.icon}
                  </Flex>
                  <div>
                    <Typography.Title level={5} style={{ marginTop: 0, marginBottom: 4, fontSize: 14 }}>
                      {item.title}
                    </Typography.Title>
                    <Typography.Text type="secondary" style={{ fontSize: 13 }}>{item.description}</Typography.Text>
                  </div>
                </Flex>
              </div>
            ))}
          </Space>
        </div>

        {/* ── Right: Login Form ── */}
        <Card className="admin-glass-card" style={{ borderRadius: 28, border: "1px solid var(--admin-border)" }}>
          <Flex vertical gap={20}>
            <div style={{ textAlign: "center" }}>
              <Tag bordered={false} color="cyan" style={{ borderRadius: 999, paddingInline: 16, marginBottom: 12 }}>
                {showMfa ? "Verify Identity" : "Welcome Back"}
              </Tag>
              <Typography.Title level={3} className="admin-display" style={{ marginBottom: 4, fontSize: 22 }}>
                {showMfa ? "Two-Factor Authentication" : "Sign in to Admin v2"}
              </Typography.Title>
              <Typography.Text type="secondary" style={{ fontSize: 13 }}>
                {showMfa
                  ? `Complete the MFA step for ${pendingChallenge?.email ?? "your account"}.`
                  : "Use your staff credentials to continue."}
              </Typography.Text>
            </div>

            {error ? <Alert type="error" message={error} showIcon style={{ borderRadius: 12 }} /> : null}

            {!showMfa ? (
              <>
                {/* Social Login */}
                <Flex vertical gap={8}>
                  <Button size="large" block icon={<Google size={16} />} style={{ borderRadius: 12, height: 48 }}>
                    Continue with Google
                  </Button>
                  <Button size="large" block icon={<Github size={16} />} style={{ borderRadius: 12, height: 48 }}>
                    Continue with GitHub
                  </Button>
                </Flex>

                <Divider plain style={{ fontSize: 11, color: "var(--admin-muted)", margin: "8px 0" }}>
                  or sign in with email
                </Divider>

                <Form<LoginFields> form={loginForm} layout="vertical" onFinish={handleLogin}>
                  <Form.Item label="Email" name="email" rules={[{ required: true, type: "email" }]}>
                    <Input
                      size="large"
                      autoComplete="email"
                      placeholder="admin@bunoraa.com"
                      prefix={<Mail size={16} style={{ color: "var(--admin-muted)" }} />}
                      style={{ borderRadius: 12, height: 48 }}
                    />
                  </Form.Item>
                  <Form.Item label="Password" name="password" rules={[{ required: true }]}>
                    <Input
                      size="large"
                      type={showPassword ? "text" : "password"}
                      autoComplete="current-password"
                      placeholder="Enter your password"
                      prefix={<Lock size={16} style={{ color: "var(--admin-muted)" }} />}
                      suffix={
                        <Button
                          type="text"
                          size="small"
                          onClick={() => setShowPassword(!showPassword)}
                          style={{ border: "none", background: "none", padding: 0, height: "auto" }}
                        >
                          {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                        </Button>
                      }
                      style={{ borderRadius: 12, height: 48 }}
                    />
                  </Form.Item>
                  <Button
                    type="primary"
                    htmlType="submit"
                    size="large"
                    block
                    loading={loading}
                    style={{ borderRadius: 12, height: 48 }}
                  >
                    <Flex align="center" gap={6} justify="center">
                      Sign In <ArrowRight size={16} />
                    </Flex>
                  </Button>
                </Form>
              </>
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
                    style={{ borderRadius: 12, height: 48 }}
                    options={(pendingChallenge?.methods ?? [defaultMethod]).map((method) => ({
                      value: method,
                      label: methodLabel[method] ?? method,
                    }))}
                  />
                </Form.Item>
                <Form.Item label="Verification Code" name="code" rules={[{ required: true }]}>
                  <Input
                    size="large"
                    autoComplete="one-time-code"
                    placeholder="123456 or backup code"
                    prefix={<KeyRound size={16} style={{ color: "var(--admin-muted)" }} />}
                    style={{ borderRadius: 12, height: 48 }}
                  />
                </Form.Item>
                <Space direction="vertical" style={{ width: "100%" }}>
                  <Button type="primary" htmlType="submit" size="large" block loading={loading} style={{ borderRadius: 12, height: 48 }}>
                    Verify and continue
                  </Button>
                  <Button
                    block
                    size="large"
                    style={{ borderRadius: 12, height: 48 }}
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

            <Typography.Text type="secondary" style={{ fontSize: 11, textAlign: "center", display: "block" }}>
              Secured with JWT authentication &bull; MFA supported
            </Typography.Text>
          </Flex>
        </Card>
      </div>
    </div>
  );
}
