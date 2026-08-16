"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Alert,
  App,
  Button,
  Card,
  Col,
  Divider,
  Form,
  Image,
  Input,
  InputNumber,
  Row,
  Select,
  Skeleton,
  Space,
  Switch,
  Typography,
  Upload,
} from "antd";
import type { UploadFile } from "antd/es/upload/interface";
import { Save, UploadCloud } from "lucide-react";
import { requestAdminData } from "@/lib/admin/http";

type SiteSettings = Record<string, unknown>;
type SettingsFormValues = Record<string, unknown> & {
  logo_file?: UploadFile[];
  logo_dark_file?: UploadFile[];
  favicon_file?: UploadFile[];
  cover_video_mp4_file?: UploadFile[];
  cover_video_webm_file?: UploadFile[];
  cover_video_poster_file?: UploadFile[];
};

const assetFields = [
  "logo",
  "logo_dark",
  "favicon",
  "cover_video_mp4",
  "cover_video_webm",
  "cover_video_poster",
] as const;
const assetUploadFields = assetFields.map((field) => `${field}_file`);

function firstFile(files?: UploadFile[]) {
  const file = files?.[0]?.originFileObj;
  return file instanceof File ? file : undefined;
}

function AssetUpload({ name, accept, currentUrl }: { name: keyof SettingsFormValues; accept: string; currentUrl?: string }) {
  return (
    <Space direction="vertical" size="small" style={{ width: "100%" }}>
      <Form.Item name={name} valuePropName="fileList" getValueFromEvent={(event) => event?.fileList?.slice(-1)} noStyle>
        <Upload accept={accept} maxCount={1} beforeUpload={() => false}>
          <Button icon={<UploadCloud size={16} />}>Choose file</Button>
        </Upload>
      </Form.Item>
      {currentUrl ? (
        accept.startsWith("image/") ? <Image src={currentUrl} alt="Current asset" width={100} /> : <Typography.Text type="secondary">Current file: <a href={currentUrl} target="_blank" rel="noreferrer">view</a></Typography.Text>
      ) : null}
    </Space>
  );
}

export function AdminSiteSettingsPage() {
  const { message } = App.useApp();
  const [form] = Form.useForm<SettingsFormValues>();
  const [saving, setSaving] = useState(false);
  const [current, setCurrent] = useState<SiteSettings>({});

  const settingsQuery = useQuery({
    queryKey: ["site-settings"],
    queryFn: () => requestAdminData<SiteSettings>("/admin/cms/site-settings/"),
  });

  useEffect(() => {
    if (!settingsQuery.data) return;
    setCurrent(settingsQuery.data);
    const initialValues = { ...settingsQuery.data } as SettingsFormValues;
    assetFields.forEach((field) => delete initialValues[field]);
    // The API record is intentionally open-ended; fields rendered below are
    // the supported editable subset of that response.
    form.setFieldsValue(initialValues as never);
  }, [form, settingsQuery.data]);

  const save = async (values: SettingsFormValues) => {
    setSaving(true);
    try {
      const payload: Record<string, unknown> = { ...values };
      ["id", "updated_at", "guest_checkout_enabled", ...assetFields, ...assetUploadFields].forEach((field) => delete payload[field]);

      const uploadedAssets: Record<string, File | undefined> = {
        logo: firstFile(values.logo_file),
        logo_dark: firstFile(values.logo_dark_file),
        favicon: firstFile(values.favicon_file),
        cover_video_mp4: firstFile(values.cover_video_mp4_file),
        cover_video_webm: firstFile(values.cover_video_webm_file),
        cover_video_poster: firstFile(values.cover_video_poster_file),
      };
      Object.entries(uploadedAssets).forEach(([field, file]) => {
        if (file) payload[field] = file;
      });

      const updated = await requestAdminData<SiteSettings>("/admin/cms/site-settings/", {
        method: "PATCH",
        body: payload,
      });
      setCurrent(updated);
      form.setFieldsValue({ logo_file: [], logo_dark_file: [], favicon_file: [], cover_video_mp4_file: [], cover_video_webm_file: [], cover_video_poster_file: [] });
      message.success("Site settings updated successfully.");
    } finally {
      setSaving(false);
    }
  };

  if (settingsQuery.isError) {
    return <Alert type="error" showIcon message="Failed to load site settings." description="Refresh the page and try again." />;
  }
  if (settingsQuery.isLoading) {
    return <Card className="admin-soft-panel" bordered={false}><Skeleton active paragraph={{ rows: 14 }} /></Card>;
  }

  return (
    <Form form={form} layout="vertical" onFinish={save}>
      <Card className="admin-soft-panel" bordered={false}>
        <Space direction="vertical" size={2} style={{ marginBottom: 20 }}>
          <Typography.Title level={3} className="admin-display">Site Settings</Typography.Title>
          <Typography.Paragraph type="secondary">Global branding, messaging, and site-wide experience controls.</Typography.Paragraph>
        </Space>

        <Typography.Title level={4}>Brand identity</Typography.Title>
        <Row gutter={16}>
          <Col xs={24} md={12}><Form.Item name="site_name" label="Site name" rules={[{ required: true }]}><Input /></Form.Item></Col>
          <Col xs={24} md={12}><Form.Item name="company_name" label="Legal company name"><Input /></Form.Item></Col>
          <Col span={24}><Form.Item name="site_tagline" label="Tagline"><Input /></Form.Item></Col>
          <Col span={24}><Form.Item name="site_description" label="Site description"><Input.TextArea rows={3} /></Form.Item></Col>
          <Col xs={24} md={8}><Form.Item label="Logo"><AssetUpload name="logo_file" accept="image/*" currentUrl={current.logo as string | undefined} /></Form.Item></Col>
          <Col xs={24} md={8}><Form.Item label="Dark logo"><AssetUpload name="logo_dark_file" accept="image/*" currentUrl={current.logo_dark as string | undefined} /></Form.Item></Col>
          <Col xs={24} md={8}><Form.Item label="Favicon"><AssetUpload name="favicon_file" accept="image/*" currentUrl={current.favicon as string | undefined} /></Form.Item></Col>
        </Row>

        <Divider /><Typography.Title level={4}>Contact and location</Typography.Title>
        <Row gutter={16}>
          <Col xs={24} md={12}><Form.Item name="contact_email" label="Contact email" rules={[{ type: "email" }]}><Input /></Form.Item></Col>
          <Col xs={24} md={12}><Form.Item name="contact_phone" label="Contact phone"><Input /></Form.Item></Col>
          <Col span={24}><Form.Item name="contact_address" label="Address"><Input.TextArea rows={2} /></Form.Item></Col>
          <Col xs={24} md={12}><Form.Item name="address_locality" label="City / locality"><Input /></Form.Item></Col>
          <Col xs={24} md={12}><Form.Item name="address_region" label="Region"><Input /></Form.Item></Col>
          <Col span={24}><Form.Item name="support_reply_time_note" label="Support reply-time note"><Input /></Form.Item></Col>
        </Row>

        <Divider /><Typography.Title level={4}>Social links</Typography.Title>
        <Row gutter={16}>{["facebook_url", "instagram_url", "twitter_url", "linkedin_url", "youtube_url", "tiktok_url"].map((field) => <Col xs={24} md={12} key={field}><Form.Item name={field} label={field.replace("_url", "").replace(/^./, (value) => value.toUpperCase())}><Input type="url" placeholder="https://" /></Form.Item></Col>)}</Row>

        <Divider /><Typography.Title level={4}>Storefront and commerce</Typography.Title>
        <Row gutter={16}>
          <Col xs={24} md={8}><Form.Item name="currency" label="Currency code" rules={[{ required: true }]}><Input placeholder="BDT" /></Form.Item></Col>
          <Col xs={24} md={8}><Form.Item name="tax_rate" label="Tax rate (%)"><InputNumber min={0} max={100} style={{ width: "100%" }} /></Form.Item></Col>
          <Col xs={24} md={8}><Form.Item name="free_shipping_threshold" label="Free shipping threshold"><InputNumber min={0} style={{ width: "100%" }} /></Form.Item></Col>
          <Col xs={24} md={8}><Form.Item name="maintenance_mode" label="Maintenance mode" valuePropName="checked"><Switch /></Form.Item></Col>
          <Col xs={24} md={16}><Form.Item name="guest_checkout_enabled_override" label="Guest checkout"><Select options={[{ value: null, label: "Use core setting" }, { value: true, label: "Enabled" }, { value: false, label: "Disabled" }]} /></Form.Item></Col>
        </Row>

        <Divider /><Typography.Title level={4}>SEO, footer and tracking</Typography.Title>
        <Row gutter={16}>
          <Col xs={24} md={12}><Form.Item name="default_meta_title" label="Default meta title"><Input /></Form.Item></Col>
          <Col xs={24} md={12}><Form.Item name="google_analytics_id" label="Google Analytics ID"><Input /></Form.Item></Col>
          <Col span={24}><Form.Item name="default_meta_description" label="Default meta description"><Input.TextArea rows={2} maxLength={300} showCount /></Form.Item></Col>
          <Col xs={24} md={12}><Form.Item name="footer_text" label="Footer text"><Input.TextArea rows={2} /></Form.Item></Col>
          <Col xs={24} md={12}><Form.Item name="copyright_text" label="Copyright text"><Input.TextArea rows={2} /></Form.Item></Col>
          <Col xs={24} md={12}><Form.Item name="facebook_pixel_id" label="Facebook Pixel ID"><Input /></Form.Item></Col>
          <Col span={24}><Form.Item name="custom_head_scripts" label="Custom head scripts"><Input.TextArea rows={4} /></Form.Item></Col>
          <Col span={24}><Form.Item name="custom_body_scripts" label="Custom body scripts"><Input.TextArea rows={4} /></Form.Item></Col>
        </Row>

        <Divider /><Typography.Title level={4}>Homepage cover video</Typography.Title>
        <Row gutter={16}>
          <Col span={24}><Form.Item name="cover_video_url" label="External video URL"><Input type="url" placeholder="https://" /></Form.Item></Col>
          <Col xs={24} md={8}><Form.Item label="MP4 video"><AssetUpload name="cover_video_mp4_file" accept="video/mp4" currentUrl={current.cover_video_mp4 as string | undefined} /></Form.Item></Col>
          <Col xs={24} md={8}><Form.Item label="WebM video"><AssetUpload name="cover_video_webm_file" accept="video/webm" currentUrl={current.cover_video_webm as string | undefined} /></Form.Item></Col>
          <Col xs={24} md={8}><Form.Item label="Video poster"><AssetUpload name="cover_video_poster_file" accept="image/*" currentUrl={current.cover_video_poster as string | undefined} /></Form.Item></Col>
        </Row>

        <Divider />
        <Button type="primary" htmlType="submit" loading={saving} icon={<Save size={16} />}>Save site settings</Button>
      </Card>
    </Form>
  );
}
