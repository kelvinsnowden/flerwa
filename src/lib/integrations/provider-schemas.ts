/**
 * The configuration schema every provider's admin "Configure" form is
 * rendered from — this is the single place a new field, or a whole new
 * provider, gets added. The admin UI (src/app/admin/integrations) never
 * hardcodes a provider-specific form; it walks `configurationSchema` and
 * renders whatever fields are declared here. No secret values live in
 * this file — it's schema only, safe to import from a client component.
 *
 * `key` on each field is intentionally the exact legacy env var name
 * (e.g. "INTASEND_SECRET_KEY") — src/lib/integrations/resolve-credential.ts
 * uses that same key to fall back to `process.env[key]` when nothing is
 * saved in the database yet, so migrating a live deployment from env vars
 * to admin-managed credentials never requires renaming anything.
 *
 * A field that must stay a Vercel environment variable (typically a
 * webhook-signing secret, checked synchronously on the hot path of
 * verifying an inbound webhook, where adding an async database read would
 * be both a latency and correctness risk) is listed under
 * `deploymentManagedFields` instead of `configurationSchema` — the admin
 * UI shows these as read-only "Deployment-managed" rows, never a form
 * field, and never pretends this page controls them.
 */

export type CredentialFieldType = "text" | "password" | "url" | "select";

export interface CredentialFieldOption {
  label: string;
  value: string;
}

export interface CredentialField {
  key: string;
  label: string;
  type: CredentialFieldType;
  /** Never redisplay the real value after save — show a masked preview instead. */
  secret: boolean;
  required: boolean;
  placeholder?: string;
  helpText?: string;
  options?: CredentialFieldOption[];
  defaultValue?: string;
}

export interface DeploymentManagedField {
  key: string;
  label: string;
  helpText: string;
}

export type IntegrationCapability = "payment" | "verification" | "email" | "sms";

export interface ProviderDefinition {
  /** Matches payment_providers.key / verification_providers.key / notification_channels.key. */
  id: string;
  name: string;
  capability: IntegrationCapability;
  description: string;
  /** No credential form, no adapter, no test connection — an admin-driven manual workflow. */
  isManual: boolean;
  configurationSchema: CredentialField[];
  deploymentManagedFields?: DeploymentManagedField[];
  hasTestConnection: boolean;
  /** Shown behind "Advanced" / "View details", not on the primary card. */
  sourcePath?: string;
}

export const PROVIDER_DEFINITIONS: ProviderDefinition[] = [
  // ---- Payments (customer → escrow, checkout collections) ----
  {
    id: "intasend",
    name: "IntaSend",
    capability: "payment",
    description: "M-Pesa STK push collections.",
    isManual: false,
    hasTestConnection: true,
    sourcePath: "src/lib/payments/adapters/intasend.ts",
    configurationSchema: [
      {
        key: "INTASEND_SECRET_KEY",
        label: "Secret key",
        type: "password",
        secret: true,
        required: true,
        placeholder: "ISSecretKey_...",
        helpText: "Authenticates outbound STK push requests and the Test Connection check.",
      },
      {
        key: "INTASEND_PUBLIC_KEY",
        label: "Publishable key",
        type: "text",
        secret: false,
        required: false,
        placeholder: "ISPubKey_...",
        helpText: "Sent with each STK push request. Only required if your IntaSend account enforces it.",
      },
      {
        key: "INTASEND_ENV",
        label: "Environment",
        type: "select",
        secret: false,
        required: true,
        defaultValue: "sandbox",
        options: [
          { label: "Sandbox", value: "sandbox" },
          { label: "Production", value: "production" },
        ],
      },
    ],
    deploymentManagedFields: [
      {
        key: "INTASEND_WEBHOOK_CHALLENGE",
        label: "Webhook challenge",
        helpText:
          "The shared challenge string IntaSend echoes back on every webhook call, set once in IntaSend's dashboard when registering the webhook endpoint. Checked synchronously on every inbound webhook, so it stays a Vercel environment variable rather than a database-backed field.",
      },
    ],
  },
  {
    id: "pesapal",
    name: "Pesapal",
    capability: "payment",
    description: "Hosted checkout — card, M-Pesa, and more via Pesapal's own payment page.",
    isManual: false,
    hasTestConnection: true,
    sourcePath: "src/lib/payments/adapters/pesapal.ts",
    configurationSchema: [
      {
        key: "PESAPAL_CONSUMER_KEY",
        label: "Consumer key",
        type: "password",
        secret: true,
        required: true,
      },
      {
        key: "PESAPAL_CONSUMER_SECRET",
        label: "Consumer secret",
        type: "password",
        secret: true,
        required: true,
      },
      {
        key: "PESAPAL_IPN_ID",
        label: "IPN ID",
        type: "text",
        secret: false,
        required: true,
        helpText: "The ID Pesapal returns from its one-time RegisterIPN call — generate it once in Pesapal's dashboard or API, then paste it here.",
      },
      {
        key: "PESAPAL_CALLBACK_URL",
        label: "Callback URL",
        type: "url",
        secret: false,
        required: true,
        placeholder: "https://yourdomain.com/checkout/return",
        helpText: "Where Pesapal returns the customer's browser after hosted checkout completes.",
      },
      {
        key: "PESAPAL_ENV",
        label: "Environment",
        type: "select",
        secret: false,
        required: true,
        defaultValue: "sandbox",
        options: [
          { label: "Sandbox", value: "sandbox" },
          { label: "Production", value: "production" },
        ],
      },
    ],
  },
  {
    id: "manual",
    name: "Manual (M-Pesa Till/Paybill)",
    capability: "payment",
    description: "Customer pays via Till/Paybill outside the app; an admin confirms the payment by hand at /admin/payments.",
    isManual: true,
    hasTestConnection: false,
    configurationSchema: [],
  },

  // ---- Identity verification ----
  {
    id: "kora",
    name: "Kora Identity",
    capability: "verification",
    description: "Kenya National ID lookup, surfaced to the admin verification queue as a decision aid.",
    isManual: false,
    hasTestConnection: false,
    sourcePath: "src/lib/verification/adapters/kora.ts",
    configurationSchema: [
      {
        key: "KORA_SECRET_KEY",
        label: "Secret key",
        type: "password",
        secret: true,
        required: true,
        helpText:
          "Used for the Kenya National ID lookup call. No Test Connection here by design — the only real check Kora exposes is a billable lookup, and this page will never fire one just to prove connectivity.",
      },
    ],
  },
  {
    id: "manual",
    name: "Manual review",
    capability: "verification",
    description: "An admin reviews uploaded documents by hand at /admin/verifications.",
    isManual: true,
    hasTestConnection: false,
    configurationSchema: [],
  },

  // ---- Email (customer support only — not account/auth email) ----
  {
    id: "resend",
    name: "Resend",
    capability: "email",
    description: "Support acknowledgements and agent replies.",
    isManual: false,
    hasTestConnection: true,
    sourcePath: "src/lib/notifications/adapters/resend-email.ts",
    configurationSchema: [
      {
        key: "RESEND_API_KEY",
        label: "API key",
        type: "password",
        secret: true,
        required: true,
        placeholder: "re_...",
      },
    ],
    deploymentManagedFields: [
      {
        key: "RESEND_WEBHOOK_SECRET",
        label: "Inbound webhook signing secret",
        helpText: "Svix signing secret for verifying inbound support-email webhooks. Checked synchronously, so it stays a Vercel environment variable.",
      },
      {
        key: "SUPPORT_EMAIL_FROM",
        label: "Support from-address",
        helpText: "The From: address used for outbound support replies, shared across whichever email provider is active.",
      },
    ],
  },
  {
    id: "mailgun",
    name: "Mailgun",
    capability: "email",
    description: "Support acknowledgements and agent replies — an alternate vendor to Resend.",
    isManual: false,
    hasTestConnection: true,
    sourcePath: "src/lib/notifications/adapters/mailgun.ts",
    configurationSchema: [
      {
        key: "MAILGUN_API_KEY",
        label: "Private API key",
        type: "password",
        secret: true,
        required: true,
      },
      {
        key: "MAILGUN_DOMAIN",
        label: "Sending domain",
        type: "text",
        secret: false,
        required: true,
        placeholder: "mail.example.com",
      },
      {
        key: "MAILGUN_REGION",
        label: "Region",
        type: "select",
        secret: false,
        required: false,
        defaultValue: "us",
        options: [
          { label: "US", value: "us" },
          { label: "EU", value: "eu" },
        ],
      },
    ],
    deploymentManagedFields: [
      {
        key: "MAILGUN_WEBHOOK_SIGNING_KEY",
        label: "Inbound webhook signing key",
        helpText: "Verifies inbound Route webhooks from Mailgun. Checked synchronously, so it stays a Vercel environment variable.",
      },
    ],
  },

  // SMS: deliberately no entries. No SMS vendor is wired up anywhere in
  // this codebase (src/lib/notifications/registry.ts's smsAdapters ships
  // empty) — the admin UI must show "No SMS provider configured" rather
  // than fabricate one. This is unrelated to phone/OTP login, which
  // already works today via Supabase Auth's own SMS provider — a
  // different system this page doesn't control.
];

export function getProviderDefinitions(capability: IntegrationCapability): ProviderDefinition[] {
  return PROVIDER_DEFINITIONS.filter((p) => p.capability === capability);
}

export function getProviderDefinition(capability: IntegrationCapability, id: string): ProviderDefinition | undefined {
  return PROVIDER_DEFINITIONS.find((p) => p.capability === capability && p.id === id);
}
