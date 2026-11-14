import { api } from "@/convex/_generated/api";
import { EmptyState } from "@/components/shop/EmptyState";
import { ProductCard } from "@/components/shop/ProductCard";
import { SectionHeading } from "@/components/shop/SectionHeading";
import { Button } from "@/components/ui/button";
import { useQuery } from "convex/react";
import { motion } from "framer-motion";
import { ArrowRight, BadgePercent, Check, Copy, Loader2, Sparkles, Tag } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import { toast } from "sonner";

const COUPONS = [
  {
    code: "CARTNEST10",
    title: "10% off your cart",
    detail: "Up to ₹750 off · minimum cart ₹999",
  },
  {
    code: "WELCOME200",
    title: "Flat ₹200 off",
    detail: "Minimum cart ₹1,499 · one demo use",
  },
  {
    code: "FREESHIP",
    title: "Free standard delivery",
    detail: "Any order value · demo only",
  },
];

export default function Deals() {
  const deals = useQuery(api.products.list, { collection: "deals", sort: "discount" });
  const [copied, setCopied] = useState<string | null>(null);

  async function copyCode(code: string) {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(code);
      toast.success("Coupon copied", { description: `${code} is ready to paste in your cart.` });
      window.setTimeout(() => setCopied(null), 2000);
    } catch {
      toast.error("Could not copy the code", { description: `Type ${code} in the cart instead.` });
    }
  }

  return (
    <div className="pb-4">
      <section className="border-b border-border/70 bg-[oklch(0.965_0.012_275)]">
        <div className="page-shell grid gap-8 py-12 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:py-16">
          <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-card px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">
              <BadgePercent className="size-3.5" aria-hidden="true" /> The CartNest Sale
            </span>
            <h1 className="mt-4 text-[38px] font-bold leading-[1.05] tracking-[-0.03em] sm:text-[48px]">
              Seasonal offers,{" "}
              <span className="display-serif italic text-primary">thoughtfully</span> selected.
            </h1>
            <p className="mt-4 max-w-xl text-[15px] leading-7 text-muted-foreground">
              Selected pieces from the collection, now at reduced prices. Apply a demo coupon at
              checkout and the discount is validated before your order is placed.
            </p>
            <div className="mt-6 flex flex-wrap gap-2.5">
              <Button asChild size="lg" className="h-11 rounded-full">
                <Link to="/shop">
                  Browse the sale <ArrowRight className="size-4" aria-hidden="true" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="h-11 rounded-full bg-card">
                <Link to="/cart">Go to cart</Link>
              </Button>
            </div>
          </motion.div>

          <div className="grid gap-2.5 sm:grid-cols-1">
            {COUPONS.map((coupon) => (
              <div
                key={coupon.code}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/80 bg-card px-4 py-3.5"
              >
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 grid size-8 place-items-center rounded-lg bg-accent text-primary">
                    <Tag className="size-4" aria-hidden="true" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold">{coupon.title}</p>
                    <p className="text-[11px] text-muted-foreground">{coupon.detail}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => void copyCode(coupon.code)}
                  data-testid={`copy-coupon-${coupon.code}`}
                  aria-label={`Copy coupon code ${coupon.code}`}
                  className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-primary/40 bg-accent/60 px-3 py-1.5 text-[11px] font-bold tracking-wide transition-colors hover:bg-accent"
                >
                  {coupon.code}
                  {copied === coupon.code ? (
                    <Check className="size-3.5 text-emerald-600" aria-hidden="true" />
                  ) : (
                    <Copy className="size-3.5" aria-hidden="true" />
                  )}
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="page-shell pt-12">
        <SectionHeading
          eyebrow="On sale now"
          title="Reduced favourites"
          description="Ordered by the largest saving in the collection. Availability is limited."
          action="/shop?sort=discount"
          actionLabel="All offers"
        />

        {deals === undefined ? (
          <div className="mt-8 flex items-center justify-center rounded-2xl border border-border/70 bg-card py-24">
            <Loader2 className="size-6 animate-spin text-muted-foreground" aria-hidden="true" />
            <span className="ml-3 text-sm text-muted-foreground">Loading offers…</span>
          </div>
        ) : deals.length === 0 ? (
          <div className="mt-8">
            <EmptyState
              icon={<Sparkles className="size-6" aria-hidden="true" />}
              title="No active offers right now"
              description="The catalogue is loading or every demo offer has ended. Check the shop for full-price favourites."
              action={
                <Button asChild className="rounded-full">
                  <Link to="/shop">Browse products</Link>
                </Button>
              }
            />
          </div>
        ) : (
          <div className="mt-7 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {deals.map((product, index) => (
              <ProductCard key={product._id} product={product} index={index} compact />
            ))}
          </div>
        )}

        <div className="mt-12 rounded-2xl border border-border/80 bg-card p-6 text-sm text-muted-foreground">
          <p className="font-semibold text-foreground">How demo offers work</p>
          <p className="mt-1.5 leading-6">
            Coupons are stored in the CartNest database and validated server-side at checkout. No
            real money moves, and every order is labelled as a demo transaction.
          </p>
        </div>
      </div>
    </div>
  );
}
