import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { seedDemoAddresses } from "./addresses";
import { seedDemoOrders } from "./orders";

export const me = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const user = await ctx.db.get(userId);
    if (!user) return null;
    return {
      _id: user._id,
      name: user.name ?? null,
      email: user.email ?? null,
      phone: user.phone ?? null,
      isDemo: user.isDemo ?? false,
      role: user.role ?? ("user" as const),
      isAnonymous: user.isAnonymous ?? false,
    };
  },
});

export const saveSignupDetails = mutation({
  args: { name: v.string(), phone: v.string() },
  handler: async (ctx, { name, phone }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Sign in to save your profile.");
    const cleanName = name.trim();
    const cleanPhone = phone.trim();
    if (cleanName.length < 3) throw new Error("Enter your full name.");
    if (!/^(\+91[\s-]?)?[6-9]\d{9}$/.test(cleanPhone.replace(/[\s-]/g, ""))) {
      throw new Error("Enter a valid 10-digit Indian mobile number.");
    }
    await ctx.db.patch(userId, { name: cleanName, phone: cleanPhone });
    return { saved: true };
  },
});

export const updateProfile = mutation({
  args: { name: v.string(), phone: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Sign in to update your profile.");
    const cleanName = args.name.trim();
    const cleanPhone = args.phone.trim();
    if (cleanName.length < 3) throw new Error("Name must be at least 3 characters.");
    if (!/^(\+91[\s-]?)?[6-9]\d{9}$/.test(cleanPhone.replace(/[\s-]/g, ""))) {
      throw new Error("Enter a valid 10-digit Indian mobile number.");
    }
    await ctx.db.patch(userId, { name: cleanName, phone: cleanPhone });
    return { saved: true };
  },
});

/**
 * One-click demo account data: synthetic profile details, saved addresses,
 * sample orders in different tracking states and a couple of wishlist items.
 * Used by the "Continue with demo account" action so privacy-agent testing has
 * realistic PII on every account page.
 */
export const claimDemoStaff = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Sign in to open the staff workspace.");
    const user = await ctx.db.get(userId);
    if (!user) throw new Error("Account not found.");
    if (user.role === "admin") return { role: "admin" as const, alreadyStaff: true };
    if (!user.isAnonymous) {
      throw new Error(
        "Demo staff access is available to the demo staff session only. Sign out and use the staff demo button.",
      );
    }

    await ctx.db.patch(userId, {
      role: "admin",
      name: "Rohan Mehta",
      phone: "+91 98330 71224",
      isDemo: true,
    });
    return { role: "admin" as const, alreadyStaff: false };
  },
});

export const ensureDemoProfile = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Sign in to open the demo account.");
    const user = await ctx.db.get(userId);
    if (!user) throw new Error("Account not found.");

    if (!user.name || user.isAnonymous) {
      await ctx.db.patch(userId, {
        name: "Ananya Deshpande",
        phone: "+91 98200 45512",
        isDemo: true,
      });
    }

    const ownerKey = `user:${userId}`;
    const addresses = await seedDemoAddresses(ctx, ownerKey);
    const orders = await seedDemoOrders(ctx, ownerKey);

    const wishlist = await ctx.db
      .query("wishlistItems")
      .withIndex("by_owner_product", (q) => q.eq("ownerKey", ownerKey))
      .collect();

    const products = await ctx.db.query("products").collect();

    if (wishlist.length === 0) {
      const slugs = ["nomad-leather-wallet", "halo-ambient-table-lamp"];
      for (const slug of slugs) {
        const product = products.find((p) => p.slug === slug);
        if (!product) continue;
        await ctx.db.insert("wishlistItems", {
          ownerKey,
          productId: product._id,
          addedAt: Date.now(),
        });
      }
    }

    const existingReviews = await ctx.db
      .query("reviews")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    if (existingReviews.length === 0) {
      const now = Date.now();
      const demoName = user.name ?? "Ananya Deshpande";
      const approvedProduct = products.find((p) => p.slug === "airwave-pro-anc-headphones");
      const pendingProduct = products.find((p) => p.slug === "nova-x9-pro-5g");

      if (approvedProduct) {
        await ctx.db.insert("reviews", {
          userId,
          authorName: demoName,
          productId: approvedProduct._id,
          rating: 5,
          title: "Exceptional sound and build quality",
          body: "I use these on a daily commute and the noise cancellation is genuinely impressive. The ear cushions stay comfortable for hours, and the battery easily lasts a full working week.",
          status: "approved",
          createdAt: now - 6 * 24 * 60 * 60 * 1000,
          moderatedAt: now - 5 * 24 * 60 * 60 * 1000,
        });
      }

      if (pendingProduct) {
        await ctx.db.insert("reviews", {
          userId,
          authorName: demoName,
          productId: pendingProduct._id,
          rating: 4,
          title: "Excellent camera, slightly heavy",
          body: "The display is beautiful and low-light photos are excellent. It is a little heavier than my previous phone, but the battery life more than makes up for it.",
          status: "pending",
          createdAt: now - 18 * 60 * 60 * 1000,
        });
      }
    }

    return {
      name: "Ananya Deshpande",
      addressesSeeded: addresses.seeded,
      ordersSeeded: orders.seeded,
    };
  },
});
