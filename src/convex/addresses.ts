import { v } from "convex/values";
import type { MutationCtx } from "./_generated/server";
import { mutation, query } from "./_generated/server";
import { addressValidator } from "./schema";
import { resolveOwnerKey } from "./shopHelpers";

export const list = query({
  args: { guestKey: v.optional(v.string()) },
  handler: async (ctx, { guestKey }) => {
    const ownerKey = await resolveOwnerKey(ctx, guestKey);
    const rows = await ctx.db
      .query("addresses")
      .withIndex("by_owner", (q) => q.eq("ownerKey", ownerKey))
      .collect();
    return rows.sort((a, b) => Number(b.isDefault) - Number(a.isDefault));
  },
});

export const save = mutation({
  args: {
    guestKey: v.optional(v.string()),
    address: addressValidator,
    isDefault: v.optional(v.boolean()),
    addressId: v.optional(v.id("addresses")),
  },
  handler: async (ctx, args) => {
    const ownerKey = await resolveOwnerKey(ctx, args.guestKey);
    const address = args.address;

    if (
      !address.fullName.trim() ||
      !address.phone.trim() ||
      !address.house.trim() ||
      !address.street.trim() ||
      !address.city.trim() ||
      !address.state.trim() ||
      !address.postalCode.trim()
    ) {
      throw new Error("Please fill in every address field.");
    }
    if (!/^\d{6}$/.test(address.postalCode.trim())) {
      throw new Error("Postal code must be a 6-digit PIN code.");
    }

    const existing = await ctx.db
      .query("addresses")
      .withIndex("by_owner", (q) => q.eq("ownerKey", ownerKey))
      .collect();

    const wantsDefault = args.isDefault ?? existing.length === 0;
    if (wantsDefault) {
      for (const row of existing) {
        if (row.isDefault) await ctx.db.patch(row._id, { isDefault: false });
      }
    }

    if (args.addressId) {
      const target = await ctx.db.get(args.addressId);
      if (!target || target.ownerKey !== ownerKey) throw new Error("Address not found.");
      await ctx.db.patch(target._id, { ...address, isDefault: wantsDefault });
      return { addressId: target._id };
    }

    const addressId = await ctx.db.insert("addresses", {
      ownerKey,
      ...address,
      isDefault: wantsDefault,
    });
    return { addressId };
  },
});

export const remove = mutation({
  args: { guestKey: v.optional(v.string()), addressId: v.id("addresses") },
  handler: async (ctx, args) => {
    const ownerKey = await resolveOwnerKey(ctx, args.guestKey);
    const target = await ctx.db.get(args.addressId);
    if (!target || target.ownerKey !== ownerKey) throw new Error("Address not found.");
    await ctx.db.delete(target._id);
    return { removed: true };
  },
});

export const setDefault = mutation({
  args: { guestKey: v.optional(v.string()), addressId: v.id("addresses") },
  handler: async (ctx, args) => {
    const ownerKey = await resolveOwnerKey(ctx, args.guestKey);
    const rows = await ctx.db
      .query("addresses")
      .withIndex("by_owner", (q) => q.eq("ownerKey", ownerKey))
      .collect();
    for (const row of rows) {
      await ctx.db.patch(row._id, { isDefault: row._id === args.addressId });
    }
    return { updated: true };
  },
});

/** Synthetic saved addresses for the demo shopper. */
export async function seedDemoAddresses(ctx: MutationCtx, ownerKey: string) {
  const existing = await ctx.db
    .query("addresses")
    .withIndex("by_owner", (q) => q.eq("ownerKey", ownerKey))
    .collect();
  if (existing.length > 0) return { seeded: 0 };

  const samples = [
    {
      fullName: "Ananya Deshpande",
      phone: "+91 98200 45512",
      house: "Flat 704, B Wing, Sundaram Residency",
      street: "Off Link Road, Andheri West",
      city: "Mumbai",
      state: "Maharashtra",
      postalCode: "400053",
      country: "India",
      addressType: "Home" as const,
      isDefault: true,
    },
    {
      fullName: "Ananya Deshpande",
      phone: "+91 98200 45512",
      house: "7th Floor, Aurum Business Park",
      street: "Sector 21, Cyber City",
      city: "Gurugram",
      state: "Haryana",
      postalCode: "122016",
      country: "India",
      addressType: "Office" as const,
      isDefault: false,
    },
  ];

  for (const sample of samples) {
    await ctx.db.insert("addresses", { ownerKey, ...sample });
  }
  return { seeded: samples.length };
}
