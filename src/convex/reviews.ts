import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

async function currentUserId(ctx: Parameters<typeof getAuthUserId>[0]) {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new Error("Sign in to post a review.");
  return userId;
}

export const forProduct = query({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const product = await ctx.db
      .query("products")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .unique();
    if (!product) return { reviews: [], average: 0, count: 0 };

    const rows = await ctx.db
      .query("reviews")
      .withIndex("by_product", (q) =>
        q.eq("productId", product._id).eq("status", "approved"),
      )
      .collect();

    const reviews = [];
    for (const row of rows.sort((a, b) => b.createdAt - a.createdAt).slice(0, 20)) {
      const photoUrl = row.photoId ? await ctx.storage.getUrl(row.photoId) : null;
      reviews.push({
        _id: row._id,
        authorName: row.authorName,
        rating: row.rating,
        title: row.title,
        body: row.body,
        photoUrl,
        createdAt: row.createdAt,
        verifiedSession: true,
      });
    }

    const count = reviews.length;
    const average =
      count > 0
        ? Math.round((reviews.reduce((sum, review) => sum + review.rating, 0) / count) * 10) / 10
        : 0;

    return { reviews, average, count };
  },
});

export const listMine = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    const rows = await ctx.db
      .query("reviews")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    const reviews = [];
    for (const row of rows.sort((a, b) => b.createdAt - a.createdAt)) {
      const product = await ctx.db.get(row.productId);
      const photoUrl = row.photoId ? await ctx.storage.getUrl(row.photoId) : null;
      reviews.push({
        _id: row._id,
        rating: row.rating,
        title: row.title,
        body: row.body,
        status: row.status,
        createdAt: row.createdAt,
        photoUrl,
        product: product
          ? { slug: product.slug, name: product.name, image: product.image, brand: product.brand }
          : null,
      });
    }
    return reviews;
  },
});

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Sign in to upload a photo.");
    return await ctx.storage.generateUploadUrl();
  },
});

export const create = mutation({
  args: {
    productId: v.id("products"),
    rating: v.number(),
    title: v.string(),
    body: v.string(),
    photoId: v.optional(v.id("_storage")),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Sign in to post a review.");
    const user = await ctx.db.get(userId);
    if (!user) throw new Error("Account not found.");

    const product = await ctx.db.get(args.productId);
    if (!product) throw new Error("This product is no longer available.");

    const rating = Math.round(args.rating);
    const title = args.title.trim();
    const body = args.body.trim();

    if (rating < 1 || rating > 5) throw new Error("Choose a rating between 1 and 5 stars.");
    if (title.length < 3) throw new Error("Give your review a short title.");
    if (title.length > 90) throw new Error("Keep the title under 90 characters.");
    if (body.length < 10) throw new Error("Tell us a little more (at least 10 characters).");
    if (body.length > 1500) throw new Error("Keep your review under 1,500 characters.");

    const existing = await ctx.db
      .query("reviews")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    if (existing.some((review) => review.productId === args.productId)) {
      throw new Error("You have already reviewed this product.");
    }

    if (args.photoId) {
      const file = await ctx.db.system.get(args.photoId);
      if (!file) throw new Error("The uploaded photo could not be found.");
      if (file.size > MAX_PHOTO_BYTES) {
        await ctx.storage.delete(args.photoId);
        throw new Error("Photos must be 5 MB or smaller.");
      }
      if (file.contentType && !file.contentType.startsWith("image/")) {
        await ctx.storage.delete(args.photoId);
        throw new Error("Please upload an image file.");
      }
    }

    const reviewId = await ctx.db.insert("reviews", {
      userId,
      authorName: user.name?.trim() || "CartNest customer",
      productId: args.productId,
      rating,
      title,
      body,
      photoId: args.photoId,
      status: "pending",
      createdAt: Date.now(),
    });

    return { reviewId, status: "pending" as const };
  },
});

export const deleteMine = mutation({
  args: { reviewId: v.id("reviews") },
  handler: async (ctx, { reviewId }) => {
    const userId = await currentUserId(ctx);
    const review = await ctx.db.get(reviewId);
    if (!review || review.userId !== userId) throw new Error("Review not found.");
    if (review.photoId) await ctx.storage.delete(review.photoId);
    await ctx.db.delete(review._id);
    return { deleted: true };
  },
});

export const countForUser = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return { total: 0, pending: 0 };
    const rows = await ctx.db
      .query("reviews")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    return {
      total: rows.length,
      pending: rows.filter((review) => review.status === "pending").length,
    };
  },
});
