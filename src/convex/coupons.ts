import { v } from "convex/values";
import { query } from "./_generated/server";
import { computeTotals } from "./shopHelpers";

export const validate = query({
  args: {
    code: v.string(),
    subtotal: v.number(),
    deliveryMethod: v.union(v.literal("standard"), v.literal("express")),
  },
  handler: async (ctx, { code, subtotal, deliveryMethod }) => {
    const normalized = code.trim().toUpperCase();
    if (!normalized) {
      return { ok: false as const, message: "Enter a coupon code to continue." };
    }
    const coupon = await ctx.db
      .query("coupons")
      .withIndex("by_code", (q) => q.eq("code", normalized))
      .unique();

    if (!coupon || !coupon.active) {
      return { ok: false as const, message: "That coupon code is not valid." };
    }
    if (subtotal < coupon.minSubtotal) {
      return {
        ok: false as const,
        message: `Add ₹${(coupon.minSubtotal - subtotal).toLocaleString("en-IN")} more to use ${coupon.code}.`,
      };
    }

    const totals = computeTotals([{ price: subtotal, quantity: 1 }], deliveryMethod, coupon);
    return {
      ok: true as const,
      code: coupon.code,
      description: coupon.description,
      kind: coupon.kind,
      value: coupon.value,
      minSubtotal: coupon.minSubtotal,
      discountPreview:
        coupon.kind === "percent"
          ? Math.min(Math.round((subtotal * coupon.value) / 100), 750)
          : coupon.kind === "flat"
            ? Math.min(coupon.value, subtotal)
            : 0,
      deliveryFee: totals.deliveryFee,
      message: `${coupon.code} applied — ${coupon.description}.`,
    };
  },
});
