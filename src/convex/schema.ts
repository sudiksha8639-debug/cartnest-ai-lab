import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { Infer, v } from "convex/values";

// default user roles. can add / remove based on the project as needed
export const ROLES = {
  ADMIN: "admin",
  USER: "user",
  MEMBER: "member",
} as const;

export const roleValidator = v.union(
  v.literal(ROLES.ADMIN),
  v.literal(ROLES.USER),
  v.literal(ROLES.MEMBER),
);
export type Role = Infer<typeof roleValidator>;

export const addressValidator = v.object({
  fullName: v.string(),
  phone: v.string(),
  house: v.string(),
  street: v.string(),
  city: v.string(),
  state: v.string(),
  postalCode: v.string(),
  country: v.string(),
  addressType: v.union(v.literal("Home"), v.literal("Office")),
});

const schema = defineSchema(
  {
    // default auth tables using convex auth.
    ...authTables, // do not remove or modify

    // the users table is the default users table that is brought in by the authTables
    users: defineTable({
      name: v.optional(v.string()), // name of the user. do not remove
      image: v.optional(v.string()), // image of the user. do not remove
      email: v.optional(v.string()), // email of the user. do not remove
      emailVerificationTime: v.optional(v.number()), // email verification time. do not remove
      isAnonymous: v.optional(v.boolean()), // is the user anonymous. do not remove

      role: v.optional(roleValidator), // role of the user. do not remove
      phone: v.optional(v.string()),
      isDemo: v.optional(v.boolean()),
    }).index("email", ["email"]), // index for the email. do not remove or modify

    meta: defineTable({
      key: v.string(),
      value: v.string(),
    }).index("by_key", ["key"]),

    products: defineTable({
      slug: v.string(),
      name: v.string(),
      brand: v.string(),
      category: v.string(),
      description: v.string(),
      highlights: v.array(v.string()),
      price: v.number(),
      mrp: v.number(),
      rating: v.number(),
      reviewCount: v.number(),
      stock: v.number(),
      image: v.string(),
      gallery: v.array(v.string()),
      specs: v.array(v.object({ label: v.string(), value: v.string() })),
      tags: v.array(v.string()),
      featured: v.boolean(),
      trending: v.boolean(),
      bestSeller: v.boolean(),
      isNew: v.boolean(),
      accent: v.string(),
      createdAt: v.number(),
    })
      .index("by_slug", ["slug"])
      .index("by_category", ["category"]),

    cartItems: defineTable({
      ownerKey: v.string(),
      productId: v.id("products"),
      quantity: v.number(),
      addedAt: v.number(),
    })
      .index("by_owner", ["ownerKey"])
      .index("by_owner_product", ["ownerKey", "productId"]),

    wishlistItems: defineTable({
      ownerKey: v.string(),
      productId: v.id("products"),
      addedAt: v.number(),
    }).index("by_owner_product", ["ownerKey", "productId"]),

    addresses: defineTable({
      ownerKey: v.string(),
      fullName: v.string(),
      phone: v.string(),
      house: v.string(),
      street: v.string(),
      city: v.string(),
      state: v.string(),
      postalCode: v.string(),
      country: v.string(),
      addressType: v.union(v.literal("Home"), v.literal("Office")),
      isDefault: v.boolean(),
    }).index("by_owner", ["ownerKey"]),

    orders: defineTable({
      ownerKey: v.string(),
      orderNumber: v.string(),
      placedAt: v.number(),
      status: v.union(
        v.literal("Order Placed"),
        v.literal("Processing"),
        v.literal("Shipped"),
        v.literal("Out for Delivery"),
        v.literal("Delivered"),
      ),
      statusHistory: v.array(
        v.object({
          status: v.string(),
          at: v.number(),
          note: v.optional(v.string()),
        }),
      ),
      customerName: v.string(),
      customerEmail: v.string(),
      customerPhone: v.string(),
      address: addressValidator,
      deliveryMethod: v.union(v.literal("standard"), v.literal("express")),
      deliveryInstructions: v.optional(v.string()),
      paymentMethod: v.union(
        v.literal("cod"),
        v.literal("upi"),
        v.literal("card"),
      ),
      paymentLabel: v.string(),
      couponCode: v.optional(v.string()),
      items: v.array(
        v.object({
          productId: v.id("products"),
          name: v.string(),
          brand: v.string(),
          image: v.string(),
          price: v.number(),
          quantity: v.number(),
          slug: v.string(),
        }),
      ),
      subtotal: v.number(),
      discount: v.number(),
      deliveryFee: v.number(),
      total: v.number(),
      estimatedDelivery: v.number(),
    })
      .index("by_owner", ["ownerKey"])
      .index("by_number", ["orderNumber"]),

    coupons: defineTable({
      code: v.string(),
      description: v.string(),
      kind: v.union(v.literal("percent"), v.literal("flat"), v.literal("shipping")),
      value: v.number(),
      minSubtotal: v.number(),
      active: v.boolean(),
    }).index("by_code", ["code"]),

    reviews: defineTable({
      userId: v.id("users"),
      authorName: v.string(),
      productId: v.id("products"),
      rating: v.number(),
      title: v.string(),
      body: v.string(),
      photoId: v.optional(v.id("_storage")),
      status: v.union(v.literal("pending"), v.literal("approved"), v.literal("rejected")),
      createdAt: v.number(),
      moderatedAt: v.optional(v.number()),
    })
      .index("by_product", ["productId", "status"])
      .index("by_user", ["userId"])
      .index("by_status", ["status"])
      .index("by_created", ["createdAt"]),

    supportRequests: defineTable({
      name: v.string(),
      email: v.string(),
      phone: v.string(),
      topic: v.string(),
      orderNumber: v.optional(v.string()),
      message: v.string(),
      status: v.union(v.literal("open"), v.literal("resolved")),
      createdAt: v.number(),
    }).index("by_created", ["createdAt"]),

    newsletterSubscribers: defineTable({
      email: v.string(),
      createdAt: v.number(),
    }).index("by_email", ["email"]),
  },
  {
    schemaValidation: false,
  },
);

export default schema;
