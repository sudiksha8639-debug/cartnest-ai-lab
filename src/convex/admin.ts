import { getAuthUserId } from "@convex-dev/auth/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

const orderStatusValidator = v.union(
  v.literal("Order Placed"),
  v.literal("Processing"),
  v.literal("Shipped"),
  v.literal("Out for Delivery"),
  v.literal("Delivered"),
);

const reviewStatusValidator = v.union(
  v.literal("pending"),
  v.literal("approved"),
  v.literal("rejected"),
);

const productFields = {
  name: v.string(),
  brand: v.string(),
  category: v.string(),
  description: v.string(),
  price: v.number(),
  mrp: v.number(),
  stock: v.number(),
  image: v.string(),
  featured: v.boolean(),
  trending: v.boolean(),
  bestSeller: v.boolean(),
  isNew: v.boolean(),
};

const STATUS_NOTES: Record<string, string> = {
  "Order Placed": "Order confirmed. Awaiting fulfilment.",
  Processing: "The fulfilment team is preparing this order.",
  Shipped: "Package handed to the delivery partner.",
  "Out for Delivery": "Courier is on the way to the delivery address.",
  Delivered: "Delivered and signed for.",
};

async function requireAdmin(ctx: QueryCtx | MutationCtx) {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new Error("Sign in with a staff account to continue.");
  const user = await ctx.db.get(userId);
  if (!user || user.role !== "admin") {
    throw new Error("Administrator access is required for this area.");
  }
  return userId;
}

function slugify(value: string) {
  const base = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return base || "product";
}

function validateProduct(input: {
  name: string;
  brand: string;
  description: string;
  price: number;
  mrp: number;
  stock: number;
  image: string;
}) {
  if (input.name.trim().length < 3) throw new Error("Product name must be at least 3 characters.");
  if (input.brand.trim().length < 2) throw new Error("Add a brand name.");
  if (input.description.trim().length < 20) {
    throw new Error("Write a description of at least 20 characters.");
  }
  if (!Number.isFinite(input.price) || input.price <= 0) {
    throw new Error("Enter a selling price greater than zero.");
  }
  if (!Number.isFinite(input.mrp) || input.mrp < input.price) {
    throw new Error("The list price cannot be lower than the selling price.");
  }
  if (!Number.isFinite(input.stock) || input.stock < 0) {
    throw new Error("Stock cannot be negative.");
  }
  if (!/^https?:\/\//.test(input.image.trim())) {
    throw new Error("Product image must be a valid http(s) URL.");
  }
}

export const overview = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const products = await ctx.db.query("products").collect();
    const orders = await ctx.db.query("orders").collect();
    const users = await ctx.db.query("users").collect();
    const reviews = await ctx.db.query("reviews").collect();
    const tickets = await ctx.db.query("supportRequests").collect();

    return {
      productCount: products.length,
      orderCount: orders.length,
      customerCount: users.filter((user) => !user.isAnonymous || user.isDemo).length,
      pendingReviews: reviews.filter((review) => review.status === "pending").length,
      openTickets: tickets.filter((ticket) => ticket.status === "open").length,
      revenue: orders.reduce((sum, order) => sum + order.total, 0),
      lowStock: products
        .filter((product) => product.stock <= 6)
        .sort((a, b) => a.stock - b.stock)
        .slice(0, 5)
        .map((product) => ({
          _id: product._id,
          name: product.name,
          stock: product.stock,
          brand: product.brand,
        })),
      recentOrders: orders
        .sort((a, b) => b.placedAt - a.placedAt)
        .slice(0, 6)
        .map((order) => ({
          _id: order._id,
          orderNumber: order.orderNumber,
          customerName: order.customerName,
          total: order.total,
          status: order.status,
          placedAt: order.placedAt,
        })),
    };
  },
});

export const listProducts = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const products = await ctx.db.query("products").collect();
    return products.sort((a, b) => a.name.localeCompare(b.name));
  },
});

export const createProduct = mutation({
  args: productFields,
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    validateProduct(args);
    const base = slugify(args.name);
    let slug = base;
    let attempt = 0;
    while (
      await ctx.db
        .query("products")
        .withIndex("by_slug", (q) => q.eq("slug", slug))
        .unique()
    ) {
      attempt++;
      slug = `${base}-${attempt + 1}`;
      if (attempt > 20) throw new Error("Could not create a unique product URL. Try another name.");
    }

    const productId = await ctx.db.insert("products", {
      slug,
      name: args.name.trim(),
      brand: args.brand.trim(),
      category: args.category,
      description: args.description.trim(),
      highlights: [args.description.trim().slice(0, 120)],
      price: Math.round(args.price),
      mrp: Math.round(args.mrp),
      rating: 0,
      reviewCount: 0,
      stock: Math.round(args.stock),
      image: args.image.trim(),
      gallery: [args.image.trim()],
      specs: [],
      tags: [args.category.toLowerCase(), args.brand.trim().toLowerCase()],
      featured: args.featured,
      trending: args.trending,
      bestSeller: args.bestSeller,
      isNew: args.isNew,
      accent: "#eef0f4",
      createdAt: Date.now(),
    });
    return { productId, slug };
  },
});

export const updateProduct = mutation({
  args: { productId: v.id("products"), ...productFields },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const product = await ctx.db.get(args.productId);
    if (!product) throw new Error("Product not found.");
    validateProduct(args);

    const image = args.image.trim();
    await ctx.db.patch(product._id, {
      name: args.name.trim(),
      brand: args.brand.trim(),
      category: args.category,
      description: args.description.trim(),
      price: Math.round(args.price),
      mrp: Math.round(args.mrp),
      stock: Math.round(args.stock),
      image,
      gallery: product.gallery[0] === image ? product.gallery : [image, ...product.gallery.slice(1)],
      featured: args.featured,
      trending: args.trending,
      bestSeller: args.bestSeller,
      isNew: args.isNew,
    });
    return { updated: true };
  },
});

export const deleteProduct = mutation({
  args: { productId: v.id("products") },
  handler: async (ctx, { productId }) => {
    await requireAdmin(ctx);
    const product = await ctx.db.get(productId);
    if (!product) throw new Error("Product not found.");

    const cartRows = await ctx.db.query("cartItems").collect();
    for (const row of cartRows) {
      if (row.productId === productId) await ctx.db.delete(row._id);
    }
    const wishlistRows = await ctx.db.query("wishlistItems").collect();
    for (const row of wishlistRows) {
      if (row.productId === productId) await ctx.db.delete(row._id);
    }
    const reviews = await ctx.db.query("reviews").collect();
    for (const review of reviews) {
      if (review.productId !== productId) continue;
      if (review.photoId) await ctx.storage.delete(review.photoId);
      await ctx.db.delete(review._id);
    }

    await ctx.db.delete(productId);
    return { deleted: true };
  },
});

export const listOrders = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const orders = await ctx.db.query("orders").collect();
    return orders.sort((a, b) => b.placedAt - a.placedAt).slice(0, 80);
  },
});

export const updateOrderStatus = mutation({
  args: { orderId: v.id("orders"), status: orderStatusValidator },
  handler: async (ctx, { orderId, status }) => {
    await requireAdmin(ctx);
    const order = await ctx.db.get(orderId);
    if (!order) throw new Error("Order not found.");
    if (order.status === status) return { updated: false };

    await ctx.db.patch(order._id, {
      status,
      statusHistory: [
        ...order.statusHistory,
        { status, at: Date.now(), note: STATUS_NOTES[status] },
      ],
    });
    return { updated: true };
  },
});

export const listCustomers = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const users = await ctx.db.query("users").collect();
    const orders = await ctx.db.query("orders").collect();

    const byOwner = new Map<string, { count: number; spend: number }>();
    for (const order of orders) {
      const current = byOwner.get(order.ownerKey) ?? { count: 0, spend: 0 };
      current.count += 1;
      current.spend += order.total;
      byOwner.set(order.ownerKey, current);
    }

    return users
      .filter((user) => !user.isAnonymous || user.isDemo)
      .map((user) => {
        const stats = byOwner.get(`user:${user._id}`) ?? { count: 0, spend: 0 };
        return {
          _id: user._id,
          name: user.name ?? "Unnamed customer",
          email: user.email ?? null,
          phone: user.phone ?? null,
          role: user.role ?? "user",
          isDemo: user.isDemo ?? false,
          orderCount: stats.count,
          totalSpend: stats.spend,
          joinedAt: user._creationTime,
        };
      })
      .sort((a, b) => b.totalSpend - a.totalSpend || a.name.localeCompare(b.name));
  },
});

export const listReviews = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const reviews = await ctx.db.query("reviews").collect();
    const result = [];
    for (const review of reviews) {
      const product = await ctx.db.get(review.productId);
      const photoUrl = review.photoId ? await ctx.storage.getUrl(review.photoId) : null;
      result.push({
        _id: review._id,
        authorName: review.authorName,
        rating: review.rating,
        title: review.title,
        body: review.body,
        status: review.status,
        createdAt: review.createdAt,
        photoUrl,
        product: product ? { name: product.name, slug: product.slug } : null,
      });
    }
    return result.sort((a, b) => {
      if (a.status === "pending" && b.status !== "pending") return -1;
      if (b.status === "pending" && a.status !== "pending") return 1;
      return b.createdAt - a.createdAt;
    });
  },
});

export const setReviewStatus = mutation({
  args: { reviewId: v.id("reviews"), status: reviewStatusValidator },
  handler: async (ctx, { reviewId, status }) => {
    await requireAdmin(ctx);
    const review = await ctx.db.get(reviewId);
    if (!review) throw new Error("Review not found.");
    await ctx.db.patch(review._id, { status, moderatedAt: Date.now() });
    return { updated: true };
  },
});

export const deleteReview = mutation({
  args: { reviewId: v.id("reviews") },
  handler: async (ctx, { reviewId }) => {
    await requireAdmin(ctx);
    const review = await ctx.db.get(reviewId);
    if (!review) throw new Error("Review not found.");
    if (review.photoId) await ctx.storage.delete(review.photoId);
    await ctx.db.delete(review._id);
    return { deleted: true };
  },
});

export const listSupport = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const tickets = await ctx.db.query("supportRequests").collect();
    return tickets.sort((a, b) => b.createdAt - a.createdAt);
  },
});

export const updateSupportStatus = mutation({
  args: {
    ticketId: v.id("supportRequests"),
    status: v.union(v.literal("open"), v.literal("resolved")),
  },
  handler: async (ctx, { ticketId, status }) => {
    await requireAdmin(ctx);
    const ticket = await ctx.db.get(ticketId);
    if (!ticket) throw new Error("Support request not found.");
    await ctx.db.patch(ticket._id, { status });
    return { updated: true };
  },
});
