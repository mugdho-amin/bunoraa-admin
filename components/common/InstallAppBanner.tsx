"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { Alert, Button, Modal, Space, Typography } from "antd";
import { Download, Share, X } from "lucide-react";
import { hasDeferredInstallPrompt, promptToInstallAdminApp, subscribeToInstallPrompt } from "@/lib/admin/pwa";

const DISMISSED_KEY = "bunoraa-admin-install-dismissed-until";

function isIOSDevice() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent)
    || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

function isStandalone() {
  return window.matchMedia("(display-mode: standalone)").matches
    || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

function subscribeViewport(callback: () => void) {
  const media = window.matchMedia("(max-width: 767px), (pointer: coarse)");
  media.addEventListener("change", callback);
  return () => media.removeEventListener("change", callback);
}

function subscribeDismissal(callback: () => void) {
  window.addEventListener("bunoraa-admin-install-dismissed", callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener("bunoraa-admin-install-dismissed", callback);
    window.removeEventListener("storage", callback);
  };
}

function wasDismissed() {
  try {
    return Number(localStorage.getItem(DISMISSED_KEY) || 0) > Date.now();
  } catch {
    return false;
  }
}

function subscribeInstalled(callback: () => void) {
  const media = window.matchMedia("(display-mode: standalone)");
  media.addEventListener("change", callback);
  window.addEventListener("appinstalled", callback);
  return () => {
    media.removeEventListener("change", callback);
    window.removeEventListener("appinstalled", callback);
  };
}

function subscribeNever() { return () => {}; }
function getMobileSnapshot() { return window.matchMedia("(max-width: 767px), (pointer: coarse)").matches; }
function getIosSnapshot() { return isIOSDevice(); }
function getStandaloneSnapshot() { return isStandalone(); }

export function InstallAppBanner() {
  const mobileDevice = useSyncExternalStore(subscribeViewport, getMobileSnapshot, () => false);
  const ios = useSyncExternalStore(subscribeNever, getIosSnapshot, () => false);
  const standalone = useSyncExternalStore(subscribeInstalled, getStandaloneSnapshot, () => true);
  const installAvailable = useSyncExternalStore(subscribeToInstallPrompt, hasDeferredInstallPrompt, () => false);
  const dismissed = useSyncExternalStore(subscribeDismissal, wasDismissed, () => true);
  const [sessionDismissed, setSessionDismissed] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  useEffect(() => {
    const onInstalled = () => {
      setSessionDismissed(true);
      try {
        localStorage.setItem(DISMISSED_KEY, String(Date.now() + 365 * 24 * 60 * 60 * 1000));
      } catch {
        // Standalone mode is checked independently on the next launch.
      }
      window.dispatchEvent(new Event("bunoraa-admin-install-dismissed"));
    };
    window.addEventListener("appinstalled", onInstalled);
    return () => window.removeEventListener("appinstalled", onInstalled);
  }, []);

  if (!mobileDevice || standalone || dismissed || sessionDismissed) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISSED_KEY, String(Date.now() + 14 * 24 * 60 * 60 * 1000));
    } catch {
      // Dismiss for this page session even when persistent storage is blocked.
    }
    setSessionDismissed(true);
    window.dispatchEvent(new Event("bunoraa-admin-install-dismissed"));
  };

  const install = async () => {
    if (ios || !installAvailable) {
      setHelpOpen(true);
      return;
    }
    const choice = await promptToInstallAdminApp();
    if (choice?.outcome === "accepted") dismiss();
  };

  return (
    <>
      <Alert
        className="admin-install-banner"
        type="info"
        showIcon
        icon={<Download size={18} />}
        message={<span className="admin-install-title">Take Bunoraa Admin with you</span>}
        description="Install the app for a full-screen workspace and quick access from your home screen."
        action={
          <Space size={6}>
            <Button type="primary" size="small" onClick={() => void install()}>
              {installAvailable ? "Install app" : "How to install"}
            </Button>
            <Button type="text" size="small" aria-label="Dismiss install suggestion" icon={<X size={16} />} onClick={dismiss} />
          </Space>
        }
      />
      <Modal
        title="Add Bunoraa Admin to your Home Screen"
        open={helpOpen}
        onCancel={() => setHelpOpen(false)}
        footer={<Button type="primary" onClick={() => setHelpOpen(false)}>Got it</Button>}
        centered
      >
        {ios ? (
          <Space direction="vertical" size={14}>
            <Typography.Paragraph>In Safari, tap the Share button, then choose <strong>Add to Home Screen</strong>.</Typography.Paragraph>
            <Typography.Text type="secondary"><Share size={14} style={{ verticalAlign: "-2px", marginRight: 6 }} />The Share button is in Safari&apos;s toolbar.</Typography.Text>
          </Space>
        ) : (
          <Typography.Paragraph>Open your browser menu and choose <strong>Install app</strong> or <strong>Add to Home screen</strong>. The exact wording depends on your browser.</Typography.Paragraph>
        )}
      </Modal>
    </>
  );
}
