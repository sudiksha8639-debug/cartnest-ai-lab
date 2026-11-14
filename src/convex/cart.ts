import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { mutation, query } from "./_generated/server";
import { resolveOwnerKey } from "./shopHelpers";

async function loadCart(ctx: QueryCtx | MutationCtx, ownerKey: string) {
  const rows = await ctx.db
    .query("cartItems")
    .withIndex("by_owner", (q) => q.eq("ownerKey", ownerKey))
    .collect();

  const items = [];
  for (const row of rows) {
    const product = await ctx.db.get(row.productId);
    // A product removed from the catalogue is skipped rather than showing a
    // broken cart line; checkout recomputes from the same live rows.
    if (!product) continue;
    items.push({
      _id: row._id,
      productId: row.productId,
      quantity: row.quantity,
      product,
    });
  }

  items.sort((a, b) => a._id.localeCompare(b._id));

  return {
    items,
    count: items.reduce((sum, item) => sum + item.quantity, 0),
    subtotal: items.reduce((sum, item) => sum + item.product.price * item.quantity, 0),
  };
}

export const get = query({
  args: { guestKey: v.optional(v.string()) },
  handler: async (ctx, { guestKey }) => {
    const ownerKey = await resolveOwnerKey(ctx, guestKey);
    return await loadCart(ctx, ownerKey);
  },
});

export const add = mutation({
  args: {
    guestKey: v.optional(v.string()),
    productId: v.id("products"),
    quantity: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const ownerKey = await resolveOwnerKey(ctx, args.guestKey);
    const quantity = Math.min(Math.max(Math.trunc(args.quantity ?? 1), 1), 10);
    const product = await ctx.db.get(args.productId);
    if (!product) throw new Error("This product is no longer available.");
    if (product.stock <= 0) throw new Error(`${product.name} is out of stock.`);

    const existing = await ctx.db
      .query("cartItems")
      .withIndex("by_owner_product", (q) =>
        q.eq("ownerKey", ownerKey).eq("productId", args.productId),
      )
      .unique();

    if (existing) {
      const next = Math.min(existing.quantity + quantity, 10, product.stock);
      await ctx.db.patch(existing._id, { quantity: next });
      return { quantity: next, added: false };
    }

    const next = Math.min(quantity, product.stock);
    await ctx.db.insert("cartItems", {
      ownerKey,
      productId: args.productId,
      quantity: next,
      addedAt: Date.now(),
    });
    return { quantity: next, added: true };
  },
});

export const setQuantity = mutation({
  args: {
    guestKey: v.optional(v.string()),
    itemId: v.id("cartItems"),
    quantity: v.number(),
  },
  handler: async (ctx, args) => {
    const ownerKey = await resolveOwnerKey(ctx, args.guestKey);
    const row = await ctx.db.get(args.itemId);
    if (!row || row.ownerKey !== ownerKey) throw new Error("Cart item not found.");
    const quantity = Math.trunc(args.quantity);
    if (quantity <= 0) {
      await ctx.db.delete(row._id);
      return { removed: true, quantity: 0 };
    }
    const product = await ctx.db.get(row.productId);
    const capped = Math.min(quantity, 10, product?.stock ?? 10);
    await ctx.db.patch(row._id, { quantity: capped });
    return { removed: false, quantity: capped };
  },
});

export const remove = mutation({
  args: { guestKey: v.optional(v.string()), itemId: v.id("cartItems") },
  handler: async (ctx, args) => {
    const ownerKey = await resolveOwnerKey(ctx, args.guestKey);
    const row = await ctx.db.get(args.itemId);
    if (!row || row.ownerKey !== ownerKey) throw new Error("Cart item not found.");
    await ctx.db.delete(row._id);
    return { removed: true };
  },
});

export const clear = mutation({
  args: { guestKey: v.optional(v.string()) },
  handler: async (ctx, { guestKey }) => {
    const ownerKey = await resolveOwnerKey(ctx, guestKey);
    const rows = await ctx.db
      .query("cartItems")
      .withIndex("by_owner", (q) => q.eq("ownerKey", ownerKey))
      .collect();
    for (const row of rows) await ctx.db.delete(row._id);
    return { cleared: rows.length };
  },
});

/** Move a guest session's cart and wishlist onto the signed-in account. */
export const mergeGuestSession = mutation({
  args: { guestKey: v.optional(v.string()) },
  handler: async (ctx, { guestKey }) => {
    const userId = await getAuthUserId(ctx);
    const key = (guestKey ?? "").trim();
    if (!userId || !/^guest_[a-zA-Z0-9_-]{8,64}$/.test(key)) {
      return { merged: 0 };
    }
    const userKey = `user:${userId}`;
    const guestKeyValue = `guest:${key}`;

    const guestCart = await ctx.db
      .query("cartItems")
      .withIndex("by_owner", (q) => q.eq("ownerKey", guestKeyValue))
      .collect();

    let merged = 0;
    for (const row of guestCart) {
      const existing = await ctx.db
        .query("cartItems")
        .withIndex("by_owner_product", (q) =>
          q.eq("ownerKey", userKey).eq("productId", row.productId),
        )
        .unique();
      if (existing) {
        await ctx.db.patch(existing._id, {
          quantity: Math.min(existing.quantity + row.quantity, 10),
        });
      } else {
        await ctx.db.insert("cartItems", {
          ownerKey: userKey,
          productId: row.productId,
          quantity: row.quantity,
          addedAt: row.addedAt,
        });
      }
      await ctx.db.delete(row._id);
      merged++;
    }

    const guestWishlist = await ctx.db
      .query("wishlistItems")
      .withIndex("by_owner_product", (q) => q.eq("ownerKey", guestKeyValue))
      .collect();

    for (const row of guestWishlist) {
      const existing = await ctx.db
        .query("wishlistItems")
        .withIndex("by_owner_product", (q) =>
          q.eq("ownerKey", userKey).eq("productId", row.productId),
        )
        .unique();
      if (!existing) {
        await ctx.db.insert("wishlistItems", {
          ownerKey: userKey,
          productId: row.productId,
          addedAt: row.addedAt,
        });
      }
      await ctx.db.delete(row._id);
    }

    return { merged };
  },
});
