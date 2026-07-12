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
  KeyRound, Eye, EyeOff,
  Mail, Lock, ArrowRight,
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
        {/* ── Left: Brand Panel ── */}
        <div className="admin-glass-card admin-shell-gradient" style={{ padding: "clamp(20px, 4vw, 40px)", display: "flex", flexDirection: "column", justifyContent: "center" }}>
          <Flex align="center" gap={8} style={{ marginBottom: 24 }}>
            <Tag bordered={false} color="cyan" style={{ paddingInline: 12, borderRadius: 999 }}>
              Bunoraa Admin v2
            </Tag>
          </Flex>
          <Typography.Title level={1} className="admin-display" style={{ marginTop: 0, marginBottom: 16, fontSize: "clamp(28px, 3.5vw, 42px)", lineHeight: 1.15 }}>
            Enterprise operations <br />dashboard
          </Typography.Title>
          <Typography.Text style={{ fontSize: 15, color: "rgba(15, 23, 42, 0.7)", lineHeight: 1.6 }}>
            Sign in to manage orders, products, payments, and analytics from a single workspace.
          </Typography.Text>
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
