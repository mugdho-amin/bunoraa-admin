"use client";

import type { LiveProvider } from "@refinedev/core";
import { getAccessToken } from "@/lib/admin/auth-storage";
import { logger } from "@/lib/admin/logger";

type Subscription = {
  id: number;
  channel: string;
  callback: (event: {
    channel: string;
    type: string;
    payload: Record<string, unknown>;
    date: Date;
  }) => void;
};

let sequence = 0;
let socket: WebSocket | null = null;
const subscriptions = new Map<number, Subscription>();
let lastUrl: string | null = null;

function normalizeWsUrl(url: string) {
  if (url.startsWith("ws://") || url.startsWith("wss://")) {
    return url;
  }
  if (url.startsWith("http://")) {
    return `ws://${url.slice("http://".length)}`;
  }
  if (url.startsWith("https://")) {
    return `wss://${url.slice("https://".length)}`;
  }
  return url;
}

function mapEventToResources(event: Record<string, unknown>) {
  const moduleName = String(event.module || "");
  const entityType = String(event.entity_type || "");

  const candidates = new Set<string>();

  if (moduleName === "orders" || entityType === "order") {
    candidates.add("orders");
  }

  if (moduleName === "payments" || entityType === "payment") {
    candidates.add("payments/payments");
  }
  if (entityType === "refund") {
    candidates.add("payments/refunds");
  }

  if (moduleName === "support" || entityType === "conversation") {
    candidates.add("support/conversations");
  }
  if (entityType === "message") {
    candidates.add("support/messages");
  }

  if (moduleName === "notifications" || entityType === "notification") {
    candidates.add("notifications");
  }

  return [...candidates];
}

function getEventType(raw: Record<string, unknown>): string {
  const t = String(raw.type || raw.event_type || "updated");
  if (t === "notification_message" || t === "notification") return "notification";
  if (t === "notification_updated") return "notification_updated";
  if (t === "notification_deleted") return "notification_deleted";
  if (t === "notification_read") return "notification_read";
  if (t === "unread_count" || t === "unread_count_update") return "unread_count";
  if (t === "preferences_updated") return "preferences_updated";
  return t;
}

function dispatchEvent(event: Record<string, unknown>) {
  const eventType = getEventType(event);
  const candidates = mapEventToResources(event);

  subscriptions.forEach((subscription) => {
    if (
      subscription.channel === "admin/global" ||
      candidates.some((candidate) => subscription.channel === `resources/${candidate}`)
    ) {
      subscription.callback({
        channel: subscription.channel,
        type: eventType,
        payload: event,
        date: new Date(),
      });
    }
  });
}

function ensureSocket(urlFactory: () => string | null) {
  const nextUrl = urlFactory();
  if (!nextUrl) {
    return null;
  }
  const normalized = normalizeWsUrl(nextUrl);
  const token = getAccessToken();
  const connectUrl = token ? `${normalized}${normalized.includes("?") ? "&" : "?"}token=${encodeURIComponent(token)}` : normalized;

  if (socket && lastUrl === connectUrl && socket.readyState <= WebSocket.OPEN) {
    return socket;
  }

  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.close();
  }

  socket = new WebSocket(connectUrl);
  lastUrl = connectUrl;
  socket.onmessage = (message) => {
    try {
      const payload = JSON.parse(message.data) as Record<string, unknown>;
      dispatchEvent(payload);
    } catch (err) {
      logger.warn("WebSocket: malformed payload", err);
    }
  };
  socket.onclose = () => {
    socket = null;
  };
  return socket;
}

export function createAdminLiveProvider(urlFactory: () => string | null): LiveProvider {
  return {
    subscribe: ({ channel, callback }) => {
      ensureSocket(urlFactory);
      const id = ++sequence;
      subscriptions.set(id, {
        id,
        channel,
        callback,
      });
      return id;
    },
    unsubscribe: (subscriptionId: number) => {
      subscriptions.delete(subscriptionId);
      if (subscriptions.size === 0 && socket) {
        socket.close();
        socket = null;
        lastUrl = null;
      }
    },
    publish: () => undefined,
  };
}
