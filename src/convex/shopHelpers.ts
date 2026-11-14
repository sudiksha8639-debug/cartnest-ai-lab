import { getAuthUserId } from "@convex-dev/auth/server";
import type { QueryCtx, MutationCtx } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";

/**
 * Carts, wishlists and demo orders are owned either by a signed-in user or by
 * an anonymous browser session. The frontend only ever sends its guest key;
 * the backend decides which identity to trust so a guest key can never read a
 * signed-in customer's data.
 */
export async function resolveOwnerKey(
  ctx: QueryCtx | MutationCtx,
  guestKey?: string,
): Promise<string> {
  const userId = await getAuthUserId(ctx);
  if (userId) return `user:${userId}`;

  const key = (guestKey ?? "").trim();
  if (!/^guest_[a-zA-Z0-9_-]{8,64}$/.test(key)) {
    throw new Error("Shopping session could not be identified. Reload the page.");
  }
  return `guest:${key}`;
}

export type CouponLike = Pick<
  Doc<"coupons">,
  "code" | "kind" | "value" | "minSubtotal"
>;

export const DELIVERY_FEES = { standard: 49, express: 149 } as const;
export const FREE_STANDARD_DELIVERY_ABOVE = 999;

export function computeTotals(
  items: { price: number; quantity: number }[],
  deliveryMethod: "standard" | "express",
  coupon?: CouponLike | null,
) {
  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

  let discount = 0;
  let freeShipping = false;
  if (coupon && subtotal >= coupon.minSubtotal) {
    if (coupon.kind === "percent") {
      discount = Math.min(Math.round((subtotal * coupon.value) / 100), 750);
    } else if (coupon.kind === "flat") {
      discount = Math.min(coupon.value, subtotal);
    } else {
      freeShipping = true;
    }
  }

  const baseFee =
    deliveryMethod === "express"
      ? DELIVERY_FEES.express
      : subtotal >= FREE_STANDARD_DELIVERY_ABOVE
        ? 0
        : DELIVERY_FEES.standard;

  const deliveryFee = freeShipping ? 0 : baseFee;
  const total = Math.max(0, subtotal - discount + deliveryFee);

  return { subtotal, discount, deliveryFee, total };
}

export function makeOrderNumber(seed = Date.now()) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let value = seed % 1_000_000_007;
  let suffix = "";
  for (let i = 0; i < 6; i++) {
    value = (value * 31 + 17 + i * 13) % 1_000_000_007;
    suffix += alphabet[value % alphabet.length];
  }
  return `CN-${new Date(seed).getFullYear()}-${suffix}`;
}

export function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());
}

export function isValidIndianPhone(phone: string) {
  return /^(\+91[\s-]?)?[6-9]\d{9}$/.test(phone.replace(/[\s-]/g, ""));
}

export function isValidPostalCode(code: string) {
  return /^\d{6}$/.test(code.trim());
}
