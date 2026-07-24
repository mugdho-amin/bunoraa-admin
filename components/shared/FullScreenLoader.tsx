"use client";

import { Flex, Typography } from "antd";

export function FullScreenLoader({
  message = "Preparing the admin workspace...",
}: {
  message?: string;
}) {
  return (
    <div className="admin-loader-root">
      <div className="admin-loader-card">
        <div className="admin-loader-ring">
          <svg viewBox="0 0 100 100" className="admin-loader-svg">
            <defs>
              <linearGradient id="loaderGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#0f766e" />
                <stop offset="50%" stopColor="#1d4ed8" />
                <stop offset="100%" stopColor="#0f766e" />
              </linearGradient>
            </defs>
            <circle cx="50" cy="50" r="40" fill="none" stroke="var(--admin-border)" strokeWidth="5" />
            <circle cx="50" cy="50" r="40" fill="none" stroke="url(#loaderGrad)" strokeWidth="5"
              strokeLinecap="round" strokeDasharray="251.2" strokeDashoffset="180"
              className="admin-loader-arc" />
          </svg>
          <div className="admin-loader-logo">B</div>
        </div>
        <Typography.Title level={3} className="admin-display admin-loader-title">
          Bunoraa
        </Typography.Title>
        <div className="admin-loader-message">
          <div className="admin-loader-dot" />
          <Typography.Text type="secondary">{message}</Typography.Text>
          <div className="admin-loader-dot" style={{ animationDelay: "0.3s" }} />
          <div className="admin-loader-dot" style={{ animationDelay: "0.6s" }} />
        </div>
      </div>
    </div>
  );
}
