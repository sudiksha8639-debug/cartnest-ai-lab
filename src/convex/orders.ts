import { v } from "convex/values";
import type { MutationCtx } from "./_generated/server";
import { mutation, query } from "./_generated/server";
import { addressValidator } from "./schema";
import {
  computeTotals,
  isValidEmail,
  isValidIndianPhone,
  isValidPostalCode,
  makeOrderNumber,
  resolveOwnerKey,
} from "./shopHelpers";

const paymentValidator = v.union(v.literal("cod"), v.literal("upi"), v.literal("card"));

const paymentLabels: Record<"cod" | "upi" | "card", string> = {
  cod: "Cash on Delivery (DEMO)",
  upi: "UPI — demo@cartnest (DEMO)",
  card: "Demo Card ending 4242 (DEMO)",
};

const STATUS_ORDER = [
  "Order Placed",
  "Processing",
  "Shipped",
  "Out for Delivery",
  "Delivered",
] as const;

const DAY = 24 * 60 * 60 * 1000;

async function uniqueOrderNumber(ctx: MutationCtx, seed: number) {
  for (let attempt = 0; attempt < 8; attempt++) {
    const candidate = makeOrderNumber(seed + attempt * 7919);
    const clash = await ctx.db
      .query("orders")
      .withIndex("by_number", (q) => q.eq("orderNumber", candidate))
      .unique();
    if (!clash) return candidate;
  }
  return `CN-${new Date(seed).getFullYear()}-${Math.random()
    .toString(36)
    .slice(2, 8)
    .toUpperCase()}`;
}

export const create = mutation({
  args: {
    guestKey: v.optional(v.string()),
    customerName: v.string(),
    customerEmail: v.string(),
    customerPhone: v.string(),
    address: addressValidator,
    deliveryMethod: v.union(v.literal("standard"), v.literal("express")),
    deliveryInstructions: v.optional(v.string()),
    paymentMethod: paymentValidator,
    couponCode: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const ownerKey = await resolveOwnerKey(ctx, args.guestKey);

    const name = args.customerName.trim();
    const email = args.customerEmail.trim().toLowerCase();
    const phone = args.customerPhone.trim();
    const address = args.address;

    if (name.length < 3) throw new Error("Enter the customer's full name.");
    if (!isValidEmail(email)) throw new Error("Enter a valid email address.");
    if (!isValidIndianPhone(phone)) {
      throw new Error("Enter a valid 10-digit Indian mobile number.");
    }
    if (
      !address.house.trim() ||
      !address.street.trim() ||
      !address.city.trim() ||
      !address.state.trim()
    ) {
      throw new Error("The delivery address is incomplete.");
    }
    if (!isValidPostalCode(address.postalCode)) {
      throw new Error("Enter a valid 6-digit PIN code.");
    }

    const cartRows = await ctx.db
      .query("cartItems")
      .withIndex("by_owner", (q) => q.eq("ownerKey", ownerKey))
      .collect();
    if (cartRows.length === 0) throw new Error("Your cart is empty.");

    const items = [];
    for (const row of cartRows) {
      const product = await ctx.db.get(row.productId);
      if (!product) continue;
      items.push({
        productId: product._id,
        name: product.name,
        brand: product.brand,
        image: product.image,
        price: product.price,
        quantity: Math.min(row.quantity, product.stock),
        slug: product.slug,
      });
    }
    if (items.length === 0) throw new Error("Your cart is empty.");

    let coupon = null;
    if (args.couponCode?.trim()) {
      coupon = await ctx.db
        .query("coupons")
        .withIndex("by_code", (q) => q.eq("code", args.couponCode!.trim().toUpperCase()))
        .unique();
      if (!coupon || !coupon.active) throw new Error("That coupon code is not valid.");
      const preSubtotal = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
      if (preSubtotal < coupon.minSubtotal) {
        throw new Error(`The coupon needs a minimum subtotal of ₹${coupon.minSubtotal}.`);
      }
    }

    const totals = computeTotals(items, args.deliveryMethod, coupon);
    const now = Date.now();
    const orderNumber = await uniqueOrderNumber(ctx, now);
    const estimatedDelivery = now + (args.deliveryMethod === "express" ? 2 : 5) * DAY;

    const orderId = await ctx.db.insert("orders", {
      ownerKey,
      orderNumber,
      placedAt: now,
      status: "Order Placed",
      statusHistory: [
        { status: "Order Placed", at: now, note: "Demo order confirmed — no payment captured." },
      ],
      customerName: name,
      customerEmail: email,
      customerPhone: phone,
      address,
      deliveryMethod: args.deliveryMethod,
      deliveryInstructions: args.deliveryInstructions?.trim().slice(0, 400) || undefined,
      paymentMethod: args.paymentMethod,
      paymentLabel: paymentLabels[args.paymentMethod],
      couponCode: coupon?.code,
      items,
      subtotal: totals.subtotal,
      discount: totals.discount,
      deliveryFee: totals.deliveryFee,
      total: totals.total,
      estimatedDelivery,
    });

    for (const row of cartRows) {
      await ctx.db.delete(row._id);
    }

    for (const item of items) {
      const product = await ctx.db.get(item.productId);
      if (!product) continue;
      await ctx.db.patch(product._id, {
        stock: Math.max(0, product.stock - item.quantity),
      });
    }

    return { orderId, orderNumber, total: totals.total };
  },
});

export const listMine = query({
  args: { guestKey: v.optional(v.string()) },
  handler: async (ctx, { guestKey }) => {
    const ownerKey = await resolveOwnerKey(ctx, guestKey);
    const rows = await ctx.db
      .query("orders")
      .withIndex("by_owner", (q) => q.eq("ownerKey", ownerKey))
      .collect();
    return rows
      .sort((a, b) => b.placedAt - a.placedAt)
      .map((order) => ({
        _id: order._id,
        orderNumber: order.orderNumber,
        placedAt: order.placedAt,
        status: order.status,
        statusHistory: order.statusHistory,
        total: order.total,
        itemCount: order.items.reduce((sum, item) => sum + item.quantity, 0),
        items: order.items,
        paymentLabel: order.paymentLabel,
        estimatedDelivery: order.estimatedDelivery,
      }));
  },
});

export const getByNumber = query({
  args: { orderNumber: v.string(), guestKey: v.optional(v.string()) },
  handler: async (ctx, { orderNumber, guestKey }) => {
    const ownerKey = await resolveOwnerKey(ctx, guestKey);
    const order = await ctx.db
      .query("orders")
      .withIndex("by_number", (q) => q.eq("orderNumber", orderNumber.trim().toUpperCase()))
      .unique();
    if (!order || order.ownerKey !== ownerKey) return null;
    return order;
  },
});

export const count = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query("orders").collect();
    return rows.length;
  },
});

function historyFor(status: (typeof STATUS_ORDER)[number], placedAt: number) {
  const reached = STATUS_ORDER.indexOf(status);
  const notes: Record<string, string> = {
    "Order Placed": "Demo order confirmed — no payment captured.",
    Processing: "Seller is packing your order.",
    Shipped: "Handed to the demo courier partner.",
    "Out for Delivery": "Courier is on the way to your address.",
    Delivered: "Delivered to the recipient. Demo signature on file.",
  };
  return STATUS_ORDER.slice(0, reached + 1).map((entry, index) => ({
    status: entry,
    at: placedAt + index * DAY * 0.8,
    note: notes[entry],
  }));
}

/** Three synthetic orders with different tracking states, for the demo account. */
export async function seedDemoOrders(ctx: MutationCtx, ownerKey: string) {
  const existing = await ctx.db
    .query("orders")
    .withIndex("by_owner", (q) => q.eq("ownerKey", ownerKey))
    .collect();
  if (existing.length > 0) return { seeded: 0 };

  const addresses = await ctx.db
    .query("addresses")
    .withIndex("by_owner", (q) => q.eq("ownerKey", ownerKey))
    .collect();
  const primary = addresses.find((a) => a.isDefault) ?? addresses[0];

  const address = primary
    ? {
        fullName: primary.fullName,
        phone: primary.phone,
        house: primary.house,
        street: primary.street,
        city: primary.city,
        state: primary.state,
        postalCode: primary.postalCode,
        country: primary.country,
        addressType: primary.addressType,
      }
    : {
        fullName: "Ananya Deshpande",
        phone: "+91 98200 45512",
        house: "Flat 704, B Wing, Sundaram Residency",
        street: "Off Link Road, Andheri West",
        city: "Mumbai",
        state: "Maharashtra",
        postalCode: "400053",
        country: "India",
        addressType: "Home" as const,
      };

  const products = await ctx.db.query("products").collect();
  const bySlug = new Map(products.map((p) => [p.slug, p]));

  const specs: {
    status: (typeof STATUS_ORDER)[number];
    daysAgo: number;
    slugs: [string, number][];
    deliveryMethod: "standard" | "express";
    paymentMethod: "cod" | "upi" | "card";
    couponCode?: string;
    instructions?: string;
  }[] = [
    {
      status: "Out for Delivery",
      daysAgo: 5,
      slugs: [
        ["airwave-pro-anc-headphones", 1],
        ["pulse-buds-mini", 1],
      ],
      deliveryMethod: "express",
      paymentMethod: "upi",
      instructions: "Please call on arrival. Leave with the security desk if unavailable.",
    },
    {
      status: "Delivered",
      daysAgo: 18,
      slugs: [
        ["lumiere-vitamin-c-serum", 2],
        ["hydra-bloom-moisturiser", 1],
      ],
      deliveryMethod: "standard",
      paymentMethod: "card",
      couponCode: "CARTNEST10",
    },
    {
      status: "Processing",
      daysAgo: 1,
      slugs: [["trailhead-28l-backpack", 1]],
      deliveryMethod: "standard",
      paymentMethod: "cod",
    },
  ];

  let seeded = 0;
  for (const [index, spec] of specs.entries()) {
    const placedAt = Date.now() - spec.daysAgo * DAY - index * 3_600_000;
    const items = spec.slugs
      .map(([slug, quantity]) => {
        const product = bySlug.get(slug);
        if (!product) return null;
        return {
          productId: product._id,
          name: product.name,
          brand: product.brand,
          image: product.image,
          price: product.price,
          quantity,
          slug: product.slug,
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);
    if (items.length === 0) continue;

    const subtotal = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
    const coupon = spec.couponCode
      ? await ctx.db
          .query("coupons")
          .withIndex("by_code", (q) => q.eq("code", spec.couponCode!))
          .unique()
      : null;
    const totals = computeTotals(items, spec.deliveryMethod, coupon);
    const orderNumber = await uniqueOrderNumber(ctx, placedAt);

    await ctx.db.insert("orders", {
      ownerKey,
      orderNumber,
      placedAt,
      status: spec.status,
      statusHistory: historyFor(spec.status, placedAt),
      customerName: address.fullName,
      customerEmail: "ananya.deshpande@example.com",
      customerPhone: address.phone,
      address,
      deliveryMethod: spec.deliveryMethod,
      deliveryInstructions: spec.instructions,
      paymentMethod: spec.paymentMethod,
      paymentLabel: paymentLabels[spec.paymentMethod],
      couponCode: coupon?.code,
      items,
      subtotal: totals.subtotal,
      discount: totals.discount,
      deliveryFee: totals.deliveryFee,
      total: totals.total,
      estimatedDelivery: placedAt + (spec.deliveryMethod === "express" ? 2 : 5) * DAY,
    });
    seeded++;
  }

  return { seeded };
}

/** Used by the account page to show an accurate spend summary. */
export const summary = query({
  args: { guestKey: v.optional(v.string()) },
  handler: async (ctx, { guestKey }) => {
    const ownerKey = await resolveOwnerKey(ctx, guestKey);
    const rows = await ctx.db
      .query("orders")
      .withIndex("by_owner", (q) => q.eq("ownerKey", ownerKey))
      .collect();
    return {
      orderCount: rows.length,
      deliveredCount: rows.filter((o) => o.status === "Delivered").length,
      totalSpend: rows.reduce((sum, o) => sum + o.total, 0),
    };
  },
});

