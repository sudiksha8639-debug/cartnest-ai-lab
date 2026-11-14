import { v } from "convex/values";
import { mutation } from "./_generated/server";
import { isValidEmail, isValidIndianPhone } from "./shopHelpers";

export const submit = mutation({
  args: {
    name: v.string(),
    email: v.string(),
    phone: v.string(),
    topic: v.string(),
    orderNumber: v.optional(v.string()),
    message: v.string(),
  },
  handler: async (ctx, args) => {
    const name = args.name.trim();
    const email = args.email.trim().toLowerCase();
    const phone = args.phone.trim();
    const message = args.message.trim();

    if (name.length < 3) throw new Error("Please enter your full name.");
    if (!isValidEmail(email)) throw new Error("Please enter a valid email address.");
    if (!isValidIndianPhone(phone)) {
      throw new Error("Please enter a valid 10-digit Indian mobile number.");
    }
    if (message.length < 15) {
      throw new Error("Please give us a little more detail (at least 15 characters).");
    }

    const ticketId = await ctx.db.insert("supportRequests", {
      name,
      email,
      phone,
      topic: args.topic.trim() || "General enquiry",
      orderNumber: args.orderNumber?.trim().toUpperCase() || undefined,
      message: message.slice(0, 2000),
      status: "open",
      createdAt: Date.now(),
    });

    const ticketNumber = `SUP-${String(ticketId).slice(-6).toUpperCase()}`;
    return { ticketId, ticketNumber };
  },
});

export const subscribe = mutation({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    const clean = email.trim().toLowerCase();
    if (!isValidEmail(clean)) throw new Error("Please enter a valid email address.");
    const existing = await ctx.db
      .query("newsletterSubscribers")
      .withIndex("by_email", (q) => q.eq("email", clean))
      .unique();
    if (existing) return { subscribed: true, alreadySubscribed: true };
    await ctx.db.insert("newsletterSubscribers", {
      email: clean,
      createdAt: Date.now(),
    });
    return { subscribed: true, alreadySubscribed: false };
  },
});
