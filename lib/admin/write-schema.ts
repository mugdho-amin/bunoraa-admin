import type { AdminFieldSchema, AdminOptionsResponse } from "@/lib/admin/types";

export type AdminWriteMethod = "POST" | "PUT" | "PATCH";

const CHOICE = (value: string, display_name: string) => ({ value, display_name });

/**
 * Small, explicit safety net for resources whose gateway OPTIONS metadata is
 * incomplete. Keep these contracts aligned with the corresponding backend
 * write serializers; never infer writable fields from detail/list responses.
 */
const SAFE_WRITE_SCHEMA_FALLBACKS: Record<string, Record<string, AdminFieldSchema>> = {
  "pricing/currencies": {
    code: { type: "string", required: true, label: "ISO currency code", max_length: 3 },
    name: { type: "string", required: true, label: "Currency name", max_length: 100 },
    symbol: { type: "string", required: true, label: "Currency symbol", max_length: 10 },
    native_symbol: { type: "string", label: "Native symbol", max_length: 10 },
    decimal_places: { type: "integer", label: "Decimal places" },
    symbol_position: {
      type: "choice",
      label: "Symbol position",
      choices: [
        CHOICE("before", "Before amount"),
        CHOICE("before_space", "Before amount with space"),
        CHOICE("after", "After amount"),
        CHOICE("after_space", "After amount with space"),
      ],
    },
    thousands_separator: { type: "string", label: "Thousands separator", max_length: 5 },
    decimal_separator: { type: "string", label: "Decimal separator", max_length: 5 },
    number_system: {
      type: "choice",
      label: "Number system",
      choices: [
        CHOICE("western", "Western (1,234.56)"),
        CHOICE("indian", "Indian (1,23,456.78)"),
        CHOICE("bengali", "Bengali numerals"),
      ],
    },
    is_active: { type: "boolean", label: "Active" },
    is_default: { type: "boolean", label: "Default currency" },
    sort_order: { type: "integer", label: "Sort order" },
  },
  "pricing/exchange-rates": {
    from_currency: { type: "currency_reference", required: true, label: "From currency" },
    to_currency: { type: "currency_reference", required: true, label: "To currency" },
    rate: { type: "decimal", required: true, label: "Exchange rate", help_text: "1 unit of the source currency equals this amount in the target currency." },
    bid_rate: { type: "decimal", label: "Bid rate" },
    ask_rate: { type: "decimal", label: "Ask rate" },
    source: {
      type: "choice",
      label: "Rate source",
      choices: [
        CHOICE("manual", "Manual"),
        CHOICE("openexchange", "Open Exchange Rates"),
        CHOICE("fixer", "Fixer.io"),
        CHOICE("ecb", "European Central Bank"),
        CHOICE("xe", "XE.com"),
        CHOICE("currencylayer", "CurrencyLayer"),
        CHOICE("exchangerate_api", "ExchangeRate-API"),
      ],
    },
    valid_from: { type: "datetime", label: "Valid from" },
    valid_until: { type: "datetime", label: "Valid until" },
    is_active: { type: "boolean", label: "Active" },
  },
  "cms/pages": {
    title: { type: "string", required: true, label: "Title", max_length: 200 },
    slug: { type: "string", required: true, label: "Slug", max_length: 220 },
    content: { type: "textarea", label: "Page content" },
    excerpt: { type: "textarea", label: "Excerpt", max_length: 500 },
    template: {
      type: "choice",
      label: "Template",
      choices: [
        CHOICE("default", "Default"),
        CHOICE("landing", "Landing page"),
        CHOICE("contact", "Contact page"),
        CHOICE("about", "About page"),
        CHOICE("faq", "FAQ page"),
      ],
    },
    featured_image: { type: "image", label: "Featured image" },
    meta_title: { type: "string", label: "Meta title", max_length: 200 },
    meta_description: { type: "textarea", label: "Meta description", max_length: 300 },
    show_in_menu: { type: "boolean", label: "Show in header menu" },
    show_in_footer: { type: "boolean", label: "Show in footer" },
    menu_order: { type: "integer", label: "Menu order" },
    is_published: { type: "boolean", label: "Published" },
    published_at: { type: "datetime", label: "Publish date" },
  },
  "notifications/templates": {
    name: { type: "string", required: true, label: "Template name", max_length: 100 },
    notification_type: {
      type: "choice",
      required: true,
      label: "Notification type",
      choices: [
        CHOICE("order_placed", "Order placed"),
        CHOICE("order_confirmed", "Order confirmed"),
        CHOICE("order_shipped", "Order shipped"),
        CHOICE("order_delivered", "Order delivered"),
        CHOICE("order_cancelled", "Order cancelled"),
        CHOICE("order_refunded", "Order refunded"),
        CHOICE("payment_received", "Payment received"),
        CHOICE("payment_failed", "Payment failed"),
        CHOICE("review_approved", "Review approved"),
        CHOICE("review_rejected", "Review rejected"),
        CHOICE("price_drop", "Price drop"),
        CHOICE("back_in_stock", "Back in stock"),
        CHOICE("wishlist_sale", "Wishlist sale"),
        CHOICE("account_created", "Account created"),
        CHOICE("password_reset", "Password reset"),
        CHOICE("promo_code", "Promo code"),
        CHOICE("general", "General"),
      ],
    },
    channel: {
      type: "choice",
      required: true,
      label: "Channel",
      choices: [CHOICE("email", "Email"), CHOICE("sms", "SMS"), CHOICE("push", "Push"), CHOICE("in_app", "In-app")],
    },
    language: { type: "string", label: "Language", max_length: 10 },
    subject: { type: "string", label: "Subject", max_length: 200 },
    body: { type: "textarea", label: "Message body" },
    html_template: { type: "textarea", label: "HTML template" },
    text_template: { type: "textarea", label: "Plain text template" },
    is_active: { type: "boolean", label: "Active" },
  },
  "shipping/settings": {
    origin_city: { type: "string", required: true, label: "Origin city", max_length: 100 },
    origin_state: { type: "string", required: true, label: "Origin state or region", max_length: 100 },
    origin_country: { type: "string", required: true, label: "Origin country code", max_length: 2 },
    default_weight_unit: {
      type: "choice",
      label: "Default weight unit",
      choices: [CHOICE("kg", "Kilograms"), CHOICE("lb", "Pounds")],
    },
    default_dimension_unit: {
      type: "choice",
      label: "Default dimension unit",
      choices: [CHOICE("cm", "Centimeters"), CHOICE("in", "Inches")],
    },
    show_delivery_estimates: { type: "boolean", label: "Show delivery estimates" },
    show_carrier_logos: { type: "boolean", label: "Show carrier logos" },
    enable_free_shipping: { type: "boolean", label: "Enable free shipping" },
    free_shipping_threshold: { type: "decimal", label: "Free shipping threshold" },
    handling_days: { type: "integer", label: "Handling days" },
  },
};

export function pickWritableAction(
  options: AdminOptionsResponse | undefined,
  preferredMethods: readonly AdminWriteMethod[],
  resourceName?: string,
) {
  for (const method of preferredMethods) {
    const fields = options?.actions?.[method];
    if (fields && Object.values(fields).some((field: AdminFieldSchema) => !field.read_only)) {
      return { method, fields };
    }
  }

  const fallbackFields = resourceName ? SAFE_WRITE_SCHEMA_FALLBACKS[resourceName] : undefined;
  if (fallbackFields && preferredMethods.length) {
    return { method: preferredMethods[0], fields: fallbackFields };
  }

  return null;
}
