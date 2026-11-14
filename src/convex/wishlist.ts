import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { resolveOwnerKey } from "./shopHelpers";

export const list = query({
  args: { guestKey: v.optional(v.string()) },
  handler: async (ctx, { guestKey }) => {
    const ownerKey = await resolveOwnerKey(ctx, guestKey);
    const rows = await ctx.db
      .query("wishlistItems")
      .withIndex("by_owner_product", (q) => q.eq("ownerKey", ownerKey))
      .collect();

    const items = [];
    for (const row of rows) {
      const product = await ctx.db.get(row.productId);
      if (product) items.push({ _id: row._id, productId: row.productId, product });
    }
    return items;
  },
});

export const toggle = mutation({
  args: { guestKey: v.optional(v.string()), productId: v.id("products") },
  handler: async (ctx, args) => {
    const ownerKey = await resolveOwnerKey(ctx, args.guestKey);
    const existing = await ctx.db
      .query("wishlistItems")
      .withIndex("by_owner_product", (q) =>
        q.eq("ownerKey", ownerKey).eq("productId", args.productId),
      )
      .unique();

    if (existing) {
      await ctx.db.delete(existing._id);
      return { wishlisted: false };
    }

    const product = await ctx.db.get(args.productId);
    if (!product) throw new Error("This product is no longer available.");
    await ctx.db.insert("wishlistItems", {
      ownerKey,
      productId: args.productId,
      addedAt: Date.now(),
    });
    return { wishlisted: true };
  },
});
