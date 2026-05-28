import { describe, it, expect } from "vitest";

import {
  emailSchema,
  walletAddressSchema,
  memberSchema,
  ipv4Schema,
  sshPublicKeySchema,
  projectSchema,
  validateApiKey,
  fieldErrors,
} from "../src/validators";
import { formatAddress, formatRelativeShort } from "../src/format";

describe("validators", () => {
  it("emailSchema accepts well-formed emails and rejects garbage", () => {
    expect(emailSchema.safeParse("a@b.co").success).toBe(true);
    expect(emailSchema.safeParse(" alice@perkos.xyz ").success).toBe(true);
    expect(emailSchema.safeParse("not-an-email").success).toBe(false);
  });

  it("walletAddressSchema requires 0x + 40 hex", () => {
    expect(
      walletAddressSchema.safeParse(
        "0xAbCdef0123456789abCDEF0123456789aBcDef01"
      ).success
    ).toBe(true);
    expect(walletAddressSchema.safeParse("0x1234").success).toBe(false);
    expect(walletAddressSchema.safeParse("not-hex").success).toBe(false);
  });

  it("memberSchema accepts email or wallet but rejects empty", () => {
    expect(memberSchema.safeParse("a@b.co").success).toBe(true);
    expect(
      memberSchema.safeParse(
        "0xAbCdef0123456789abCDEF0123456789aBcDef01"
      ).success
    ).toBe(true);
    expect(memberSchema.safeParse("nope").success).toBe(false);
    expect(memberSchema.safeParse("").success).toBe(false);
  });

  it("ipv4Schema flags malformed addresses", () => {
    expect(ipv4Schema.safeParse("203.0.113.10").success).toBe(true);
    expect(ipv4Schema.safeParse("999.0.0.1").success).toBe(false);
  });

  it("sshPublicKeySchema accepts ed25519 and rsa keys", () => {
    const k =
      "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIPexamplekeydatahere alice@host";
    expect(sshPublicKeySchema.safeParse(k).success).toBe(true);
    expect(sshPublicKeySchema.safeParse("ssh-bogus AAAA").success).toBe(false);
  });

  it("fieldErrors returns a flat map of field → message", () => {
    const errs = fieldErrors(projectSchema, { name: "x", goal: "short" });
    expect(errs).not.toBeNull();
    expect(Object.keys(errs!).sort()).toEqual(["goal", "name"]);
    const ok = fieldErrors(projectSchema, {
      name: "PerkOS",
      goal: "Ship the platform-level API.",
    });
    expect(ok).toBeNull();
  });

  it("validateApiKey returns prefix hint for the right provider", () => {
    expect(validateApiKey("openai", "")).toMatch(/Paste/);
    expect(validateApiKey("openai", "sk-abcdefghij1234567890")).toBeNull();
    expect(validateApiKey("openai", "wrong-prefix-1234567890ab")).toMatch(
      /sk-/
    );
    expect(
      validateApiKey("anthropic", "sk-ant-abcdefghij1234567890")
    ).toBeNull();
    expect(validateApiKey("unknown", "any-key-shape")).toBeNull();
  });
});

describe("format", () => {
  it("formatAddress shortens long addresses and passes through short ones", () => {
    expect(formatAddress(undefined)).toBe("");
    expect(formatAddress("0x12345")).toBe("0x12345");
    expect(
      formatAddress("0xAbCdef0123456789abCDEF0123456789aBcDef01")
    ).toBe("0xA…ef01");
  });

  it("formatRelativeShort buckets sub-week dates", () => {
    const now = new Date("2026-05-28T12:00:00Z");
    expect(formatRelativeShort(undefined, now)).toBe("");
    expect(
      formatRelativeShort(new Date(now.getTime() - 10_000), now)
    ).toBe("now");
    expect(
      formatRelativeShort(new Date(now.getTime() - 60 * 1000 * 5), now)
    ).toBe("5m");
    expect(
      formatRelativeShort(new Date(now.getTime() - 60 * 60 * 1000 * 3), now)
    ).toBe("3h");
    expect(
      formatRelativeShort(
        new Date(now.getTime() - 60 * 60 * 1000 * 24 * 2),
        now
      )
    ).toBe("2d");
    // > 7 days → falls back to a localised "Mon DD" date
    const old = formatRelativeShort(
      new Date(now.getTime() - 60 * 60 * 1000 * 24 * 30),
      now
    );
    expect(old).toMatch(/[A-Za-z]+\s+\d+/);
  });
});
