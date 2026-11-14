export type AppliedCoupon = {
  code: string;
  description: string;
  kind: "percent" | "flat" | "shipping";
  value: number;
  minSubtotal: number;
};

export const COUPON_STORAGE = "cartnest:coupon";

export function readStoredCoupon(): AppliedCoupon | null {
  try {
    const raw = window.sessionStorage.getItem(COUPON_STORAGE);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AppliedCoupon;
    if (!parsed?.code || !parsed.kind) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function storeCoupon(coupon: AppliedCoupon | null) {
  try {
    if (!coupon) window.sessionStorage.removeItem(COUPON_STORAGE);
    else window.sessionStorage.setItem(COUPON_STORAGE, JSON.stringify(coupon));
  } catch {
    /* session storage is optional */
  }
}

export function couponDiscount(coupon: AppliedCoupon | null, subtotal: number) {
  if (!coupon || subtotal < coupon.minSubtotal) return 0;
  if (coupon.kind === "percent") return Math.min(Math.round((subtotal * coupon.value) / 100), 750);
  if (coupon.kind === "flat") return Math.min(coupon.value, subtotal);
  return 0;
}

export function totalsFor(
  subtotal: number,
  deliveryMethod: "standard" | "express",
  coupon: AppliedCoupon | null,
) {
  const discount = couponDiscount(coupon, subtotal);
  const base =
    deliveryMethod === "express" ? 149 : subtotal >= 999 ? 0 : subtotal > 0 ? 49 : 0;
  const freeShipping = coupon?.kind === "shipping";
  const deliveryFee = freeShipping ? 0 : base;
  return {
    subtotal,
    discount,
    deliveryFee,
    total: Math.max(0, subtotal - discount + deliveryFee),
  };
}
