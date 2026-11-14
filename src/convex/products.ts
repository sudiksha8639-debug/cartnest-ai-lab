import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { SEED_COUPONS, SEED_PRODUCTS } from "./catalogue";

const sortValidator = v.union(
  v.literal("relevance"),
  v.literal("price-asc"),
  v.literal("price-desc"),
  v.literal("rating"),
  v.literal("discount"),
  v.literal("newest"),
);

const collectionValidator = v.union(
  v.literal("featured"),
  v.literal("trending"),
  v.literal("bestSeller"),
  v.literal("new"),
  v.literal("deals"),
);

export const seedCatalogue = mutation({
  args: {},
  handler: async (ctx) => {
    const marker = await ctx.db
      .query("meta")
      .withIndex("by_key", (q) => q.eq("key", "catalogue:v1"))
      .unique();

    const existing = await ctx.db.query("products").collect();
    const existingSlugs = new Set(existing.map((p) => p.slug));

    let inserted = 0;
    if (existing.length === 0) {
      const now = Date.now();
      for (const [index, product] of SEED_PRODUCTS.entries()) {
        await ctx.db.insert("products", {
          ...product,
          // stagger arrival dates so "Newest arrivals" has a real order
          createdAt: now - index * 36 * 60 * 60 * 1000,
        });
        inserted++;
      }
    } else if (existingSlugs.size < SEED_PRODUCTS.length) {
      const now = Date.now();
      for (const [index, product] of SEED_PRODUCTS.entries()) {
        if (existingSlugs.has(product.slug)) continue;
        await ctx.db.insert("products", {
          ...product,
          createdAt: now - index * 36 * 60 * 60 * 1000,
        });
        inserted++;
      }
    }

    const couponRows = await ctx.db.query("coupons").collect();
    const couponCodes = new Set(couponRows.map((c) => c.code));
    let couponsInserted = 0;
    for (const coupon of SEED_COUPONS) {
      if (couponCodes.has(coupon.code)) continue;
      await ctx.db.insert("coupons", coupon);
      couponsInserted++;
    }

    if (!marker && inserted > 0) {
      await ctx.db.insert("meta", { key: "catalogue:v1", value: String(inserted) });
    }

    return { productsInserted: inserted, couponsInserted };
  },
});

export const syncProductMedia = mutation({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query("products").collect();
    let updated = 0;
    for (const row of rows) {
      const seed = SEED_PRODUCTS.find((product) => product.slug === row.slug);
      if (!seed) continue;
      if (
        row.image !== seed.image ||
        row.accent !== seed.accent ||
        JSON.stringify(row.gallery) !== JSON.stringify(seed.gallery)
      ) {
        await ctx.db.patch(row._id, {
          image: seed.image,
          gallery: seed.gallery,
          accent: seed.accent,
        });
        updated++;
      }
    }
    return { updated };
  },
});

export const list = query({
  args: {
    search: v.optional(v.string()),
    category: v.optional(v.string()),
    minPrice: v.optional(v.number()),
    maxPrice: v.optional(v.number()),
    minRating: v.optional(v.number()),
    sort: v.optional(sortValidator),
    collection: v.optional(collectionValidator),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const all = await ctx.db.query("products").collect();
    const term = (args.search ?? "").trim().toLowerCase();

    let rows = all.filter((product) => {
      if (args.category && product.category !== args.category) return false;
      if (typeof args.minPrice === "number" && product.price < args.minPrice) return false;
      if (typeof args.maxPrice === "number" && product.price > args.maxPrice) return false;
      if (typeof args.minRating === "number" && product.rating < args.minRating) return false;

      if (args.collection === "featured" && !product.featured) return false;
      if (args.collection === "trending" && !product.trending) return false;
      if (args.collection === "bestSeller" && !product.bestSeller) return false;
      if (args.collection === "new" && !product.isNew) return false;
      if (args.collection === "deals" && product.mrp <= product.price) return false;

      if (term.length > 0) {
        const haystack = [
          product.name,
          product.brand,
          product.category,
          product.description,
          ...product.tags,
        ]
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(term)) return false;
      }
      return true;
    });

    const sort = args.sort ?? (term ? "relevance" : "relevance");
    rows = [...rows].sort((a, b) => {
      switch (sort) {
        case "price-asc":
          return a.price - b.price;
        case "price-desc":
          return b.price - a.price;
        case "rating":
          return b.rating - a.rating || b.reviewCount - a.reviewCount;
        case "discount":
          return b.mrp - b.price - (a.mrp - a.price);
        case "newest":
          return b.createdAt - a.createdAt;
        default:
          return (
            Number(b.featured) - Number(a.featured) ||
            b.rating - a.rating ||
            b.reviewCount - a.reviewCount
          );
      }
    });

    if (args.limit) rows = rows.slice(0, args.limit);

    return rows.map((product) => ({
      ...product,
      discountPercent: Math.max(
        0,
        Math.round(((product.mrp - product.price) / product.mrp) * 100),
      ),
    }));
  },
});

export const getBySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const product = await ctx.db
      .query("products")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .unique();
    if (!product) return null;
    return {
      ...product,
      discountPercent: Math.max(
        0,
        Math.round(((product.mrp - product.price) / product.mrp) * 100),
      ),
    };
  },
});

export const byIds = query({
  args: { ids: v.array(v.id("products")) },
  handler: async (ctx, { ids }) => {
    const rows = [];
    for (const id of ids.slice(0, 12)) {
      const product = await ctx.db.get(id);
      if (product) rows.push(product);
    }
    return rows;
  },
});

export const related = query({
  args: { slug: v.string(), limit: v.optional(v.number()) },
  handler: async (ctx, { slug, limit }) => {
    const product = await ctx.db
      .query("products")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .unique();
    if (!product) return [];
    const sameCategory = await ctx.db
      .query("products")
      .withIndex("by_category", (q) => q.eq("category", product.category))
      .collect();
    const others = sameCategory.filter((p) => p._id !== product._id);
    const sameBrand = others.filter((p) => p.brand === product.brand);
    const rest = others.filter((p) => p.brand !== product.brand);
    return [...sameBrand, ...rest].slice(0, limit ?? 4);
  },
});

export const catalogueStats = query({
  args: {},
  handler: async (ctx) => {
    const products = await ctx.db.query("products").collect();
    const categories = new Map<string, number>();
    for (const product of products) {
      categories.set(product.category, (categories.get(product.category) ?? 0) + 1);
    }
    return {
      productCount: products.length,
      categories: [...categories.entries()].map(([name, count]) => ({ name, count })),
    };
  },
});
