/**
 * Zod schemas + field-error helpers used across PerkOS surfaces.
 * Ported from `PerkOS/app/lib/validators.ts` without changes.
 */

import { z } from "zod";

export const emailSchema = z
  .string()
  .trim()
  .min(3, "Enter your email.")
  .email("That doesn't look like a valid email.");

export const walletAddressSchema = z
  .string()
  .trim()
  .regex(/^0x[a-fA-F0-9]{40}$/, "Enter a valid 0x… wallet address.");

export const memberSchema = z
  .string()
  .trim()
  .min(1, "Enter an email or wallet address.")
  .refine(
    (v) =>
      emailSchema.safeParse(v).success ||
      walletAddressSchema.safeParse(v).success,
    "Must be a valid email or 0x… wallet address."
  );

export const ipv4Schema = z
  .string()
  .trim()
  .regex(
    /^(25[0-5]|2[0-4]\d|[01]?\d\d?)(\.(25[0-5]|2[0-4]\d|[01]?\d\d?)){3}$/,
    "Enter a valid IPv4 address (e.g. 203.0.113.10)."
  );

export const sshPublicKeySchema = z
  .string()
  .trim()
  .regex(
    /^(ssh-(rsa|ed25519|dss)|ecdsa-sha2-nistp(256|384|521))\s+[A-Za-z0-9+/=]+(\s+\S+)?$/,
    "Paste a valid SSH public key (starts with ssh-rsa, ssh-ed25519, etc.)."
  );

export const projectSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters."),
  goal: z
    .string()
    .trim()
    .min(10, "Describe the goal in at least 10 characters."),
});

export const taskSchema = z.object({
  projectId: z.string().min(1, "Pick a project."),
  name: z.string().trim().min(2, "Task name must be at least 2 characters."),
  description: z
    .string()
    .trim()
    .min(5, "Add a short description so the agent has context."),
  priority: z.enum(["High", "Medium", "Low"]),
  agent: z.string().trim().min(1, "Assign an agent."),
});

export const organizationSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters."),
  description: z.string().trim().optional(),
  members: z.array(memberSchema).optional(),
});

export const accessRequestSchema = z.object({
  email: emailSchema,
  name: z.string().trim().optional(),
  useCase: z.string().trim().optional(),
});

// API-key shape per provider — only catches obvious typos (wrong prefix).
const apiKeyPatterns: Record<string, RegExp> = {
  openai: /^sk-[A-Za-z0-9_-]{20,}$/,
  anthropic: /^sk-ant-[A-Za-z0-9_-]{20,}$/,
  openrouter: /^sk-or-[A-Za-z0-9_-]{20,}$/,
};

export function validateApiKey(
  provider: string,
  key: string
): string | null {
  const trimmed = key.trim();
  if (trimmed.length === 0) return "Paste your API key.";
  const pattern = apiKeyPatterns[provider];
  if (pattern && !pattern.test(trimmed)) {
    const prefix =
      provider === "openai"
        ? "sk-"
        : provider === "anthropic"
        ? "sk-ant-"
        : provider === "openrouter"
        ? "sk-or-"
        : "";
    return `Key looks wrong for ${provider}. Expected a key starting with ${prefix}.`;
  }
  return null;
}

/**
 * Run a zod schema and return a flat `{ field: message }` map (or null if valid).
 * Designed for inline field errors next to inputs.
 */
export function fieldErrors<T>(
  schema: z.ZodType<T>,
  value: unknown
): Record<string, string> | null {
  const result = schema.safeParse(value);
  if (result.success) return null;
  const out: Record<string, string> = {};
  for (const issue of result.error.issues) {
    const path = issue.path.join(".");
    if (path && !out[path]) out[path] = issue.message;
  }
  return out;
}
