import type { ReactNode } from "react";
import { Typography } from "antd";

type AdminPageHeaderProps = {
  title: string;
  description?: ReactNode;
  eyebrow?: string;
  actions?: ReactNode;
  meta?: ReactNode;
};

/** A single, responsive heading pattern shared across admin page types. */
export function AdminPageHeader({ title, description, eyebrow, actions, meta }: AdminPageHeaderProps) {
  return (
    <header className="admin-page-heading">
      <div className="admin-page-heading-copy">
        {eyebrow && <div className="admin-page-eyebrow">{eyebrow}</div>}
        <Typography.Title level={1} className="admin-display admin-page-title">
          {title}
        </Typography.Title>
        {description && <div className="admin-page-description">{description}</div>}
        {meta && <div className="admin-page-meta">{meta}</div>}
      </div>
      {actions && <div className="admin-page-actions">{actions}</div>}
    </header>
  );
}
