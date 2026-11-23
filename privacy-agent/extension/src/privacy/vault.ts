import type { PIIType } from "../shared/schema";

export interface VaultEntry {
  token: string;
  type: PIIType;
  value: string | null;
  resolvable: boolean;
  fieldLabel?: string;
}

const NON_VAULTED: ReadonlySet<PIIType> = new Set(["PASSWORD", "OTP", "CARD", "BANK", "GOVT_ID"]);

/**
 * The vault lives only in the content script for the lifetime of the document.
 * Values never cross into the backend payload or extension logs.
 */
export class PlaceholderVault {
  private byToken = new Map<string, VaultEntry>();
  private byValue = new Map<string, string>();
  private counters = new Map<PIIType, number>();

  add(type: PIIType, value: string, fieldLabel?: string): string {
    const trimmed = value.trim();
    if (!trimmed) return `[${type}_0]`;
    const key = `${type}:${trimmed}`;
    const existing = this.byValue.get(key);
    if (existing) return existing;

    const next = (this.counters.get(type) ?? 0) + 1;
    this.counters.set(type, next);
    const token = `[${type}_${next}]`;
    const resolvable = !NON_VAULTED.has(type);
    this.byToken.set(token, {
      token,
      type,
      value: resolvable ? trimmed : null,
      resolvable,
      fieldLabel,
    });
    if (resolvable) this.byValue.set(key, token);
    return token;
  }

  get(token: string): VaultEntry | undefined {
    return this.byToken.get(token);
  }

  get size(): number {
    return this.byToken.size;
  }

  clear(): void {
    this.byToken.clear();
    this.byValue.clear();
    this.counters.clear();
  }
}
