import { api } from "@/convex/_generated/api";
import { EmptyState } from "@/components/shop/EmptyState";
import { ProductCard } from "@/components/shop/ProductCard";
import { CategoryIcon } from "@/components/shop/CategoryIcon";
import { ProductImage } from "@/components/shop/ProductImage";
import { Rating } from "@/components/shop/Rating";
import { SectionHeading } from "@/components/shop/SectionHeading";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useShop } from "@/context/ShopProvider";
import { useAuth } from "@/hooks/use-auth";
import { CATEGORIES, formatINR } from "@/lib/shop";
import { useMutation, useQuery } from "convex/react";
import { motion } from "framer-motion";
import {
  ArrowRight,
  BadgePercent,
  ChevronRight,
  Headphones,
  Loader2,
  PackageCheck,
  ShieldCheck,
  Sparkles,
  Star,
  Truck,
  Undo2,
} from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import { toast } from "sonner";

const HERO_IMAGE =
  "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=1200&q=80";

export default function Home() {
  const featured = useQuery(api.products.list, { collection: "featured", limit: 4 });
  const trending = useQuery(api.products.list, { collection: "trending", limit: 4 });
  const bestSellers = useQuery(api.products.list, { collection: "bestSeller", limit: 4 });
  const deals = useQuery(api.products.list, { collection: "deals", sort: "discount", limit: 3 });
  const stats = useQuery(api.products.catalogueStats, {});
  const { recentlyViewed } = useShop();
  const { isAuthenticated } = useAuth();
  const [email, setEmail] = useState("");
  const [subscribing, setSubscribing] = useState(false);
  const subscribe = useMutation(api.support.subscribe);

  async function handleSubscribe(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubscribing(true);
    try {
      const result = await subscribe({ email });
      toast.success(result?.alreadySubscribed ? "You're already on the list" : "You're subscribed!", {
        description: "Demo newsletters are simulated — no email will be sent.",
      });
      setEmail("");
    } catch (error) {
      toast.error("Could not subscribe", {
        description: error instanceof Error ? error.message : "Please try a different email.",
      });
    } finally {
      setSubscribing(false);
    }
  }

  const counts = new Map(stats?.categories.map((c) => [c.name, c.count]) ?? []);

  return (
    <div className="pb-4">
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-border/70 bg-[oklch(0.972_0.008_275)]">
        <div
          className="pointer-events-none absolute -right-24 -top-32 size-[420px] rounded-full bg-[oklch(0.88_0.06_280)] opacity-50 blur-3xl"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute -bottom-40 left-1/3 size-[380px] rounded-full bg-[oklch(0.92_0.04_230)] opacity-50 blur-3xl"
          aria-hidden="true"
        />
        <div className="page-shell relative grid items-center gap-10 py-12 lg:grid-cols-[1.05fr_0.95fr] lg:gap-14 lg:py-20">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, ease: "easeOut" }}
          >
            <span className="inline-flex items-center gap-2 rounded-full border border-primary/15 bg-card/80 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">
              <Sparkles className="size-3.5" aria-hidden="true" />
              The CartNest collection
            </span>
            <h1 className="mt-5 max-w-xl text-[38px] font-bold leading-[1.06] tracking-[-0.035em] sm:text-[52px] lg:text-[60px]">
              Everything you love,
              <br />
              <span className="display-serif italic text-primary">all in one place.</span>
            </h1>
            <p className="mt-5 max-w-lg text-[15px] leading-7 text-muted-foreground">
              A considered collection of electronics, fashion, home and beauty essentials — with
              transparent pricing, dependable delivery and service you can rely on.
            </p>

            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Button asChild size="lg" className="h-12 rounded-full px-6" data-testid="hero-shop-cta">
                <Link to="/shop">
                  Shop all products
                  <ArrowRight className="size-4" aria-hidden="true" />
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="h-12 rounded-full border-border bg-card/70 px-6"
                data-testid="hero-deals-cta"
              >
                <Link to="/deals">
                  <BadgePercent className="size-4" aria-hidden="true" />
                  Explore deals
                </Link>
              </Button>
            </div>

            <dl className="mt-9 flex flex-wrap gap-x-10 gap-y-4 border-t border-border/80 pt-6">
              <div>
                <dt className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  Curated products
                </dt>
                <dd className="mt-1 text-xl font-bold">{stats?.productCount ?? 30}+</dd>
              </div>
              <div>
                <dt className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  Average rating
                </dt>
                <dd className="mt-1 flex items-center gap-1.5 text-xl font-bold">
                  4.4 <Star className="size-4 fill-amber-400 text-amber-400" aria-hidden="true" />
                </dd>
              </div>
              <div>
                <dt className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  Environment
                </dt>
                <dd className="mt-1 flex items-center gap-1.5 text-xl font-bold">
                  Demo store <ShieldCheck className="size-4 text-emerald-600" aria-hidden="true" />
                </dd>
              </div>
            </dl>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.1, ease: "easeOut" }}
            className="relative mx-auto w-full max-w-[520px]"
          >
            <div className="relative aspect-[4/4.3] overflow-hidden rounded-[30px] border border-white/60 bg-secondary soft-card">
              <ProductImage
                src={HERO_IMAGE}
                alt="Premium over-ear headphones on a warm neutral backdrop"
                eager
                className="h-full w-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/25 via-transparent to-transparent" />
              <div className="absolute left-5 top-5 inline-flex items-center gap-1.5 rounded-full bg-white/90 px-3 py-1.5 text-[11px] font-semibold text-foreground backdrop-blur">
                <Truck className="size-3.5" aria-hidden="true" /> Free delivery over ₹999
              </div>
            </div>

            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35, duration: 0.5 }}
              className="absolute -bottom-5 left-2 w-[248px] rounded-2xl border border-border/80 bg-card/95 p-3.5 backdrop-blur sm:-left-6"
            >
              <div className="flex items-center gap-3">
                <div className="size-12 shrink-0 overflow-hidden rounded-xl bg-secondary">
                  <ProductImage
                    src="https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=200&q=80"
                    alt="Airwave Pro ANC Headphones"
                    className="h-full w-full object-cover"
                  />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold">Airwave Pro ANC</p>
                  <div className="mt-0.5 flex items-center gap-1 text-[10px] text-muted-foreground">
                    <Star className="size-3 fill-amber-400 text-amber-400" aria-hidden="true" /> 4.7 ·
                    1,922 reviews
                  </div>
                  <p className="mt-1 text-sm font-bold">
                    ₹8,999{" "}
                    <span className="text-[10px] font-medium text-muted-foreground line-through">
                      ₹12,999
                    </span>
                  </p>
                </div>
              </div>
            </motion.div>

            <div className="absolute -right-2 top-24 hidden rounded-2xl border border-border/80 bg-card/95 px-3.5 py-2.5 backdrop-blur sm:block">
              <p className="flex items-center gap-1 text-[11px] font-semibold">
                <Headphones className="size-3.5 text-primary" aria-hidden="true" /> 40-hour battery
              </p>
              <p className="mt-0.5 text-[10px] text-muted-foreground">Adaptive noise cancellation</p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Trust strip */}
      <section aria-label="Shopping benefits" className="border-b border-border/70 bg-background">
        <div className="page-shell grid grid-cols-2 gap-4 py-6 sm:grid-cols-4">
          {[
            { icon: Truck, title: "Complimentary delivery", copy: "On orders above ₹999" },
            { icon: Undo2, title: "7-day returns", copy: "Simple, no-questions returns" },
            { icon: ShieldCheck, title: "Demo payments", copy: "No real money moves" },
            { icon: PackageCheck, title: "Order tracking", copy: "Five clear statuses" },
          ].map(({ icon: Icon, title, copy }) => (
            <div key={title} className="flex items-center gap-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-secondary text-primary">
                <Icon className="size-4" aria-hidden="true" />
              </span>
              <div>
                <p className="text-xs font-semibold">{title}</p>
                <p className="text-[11px] text-muted-foreground">{copy}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Categories */}
      <section className="page-shell pt-14">
        <SectionHeading
          eyebrow="Shop by department"
          title="Shop by category"
          description="Five considered departments, each edited for the way you live."
          action="/shop"
          actionLabel="Browse everything"
        />
        <div className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {CATEGORIES.map((category, index) => (
            <motion.div
              key={category.name}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.05 }}
            >
              <Link
                to={`/shop?category=${encodeURIComponent(category.name)}`}
                data-testid={`home-category-${category.name.toLowerCase().replace(/[^a-z]+/g, "-")}`}
                className="group flex h-full flex-col justify-between gap-6 rounded-2xl border border-border/80 bg-card p-4 transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:soft-card sm:p-5"
              >
                <span className="grid size-11 place-items-center rounded-xl border border-border/70 bg-secondary text-primary transition-colors group-hover:border-primary/25 group-hover:bg-accent">
                  <CategoryIcon category={category.name} className="size-5" />
                </span>
                <span>
                  <span className="flex items-center gap-1 text-sm font-semibold">
                    {category.name}
                    <ChevronRight className="size-3.5 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                  </span>
                  <span className="mt-1 block text-[11px] text-muted-foreground">
                    {counts.get(category.name) ?? 0} products · {category.blurb}
                  </span>
                </span>
              </Link>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Featured */}
      <section className="page-shell pt-16">
        <SectionHeading
          eyebrow="The edit"
          title={<>Featured selection</>}
          description="A considered shortlist of pieces that define the collection."
          action="/shop?sort=rating"
          actionLabel="See top rated"
        />
        <div className="mt-7 grid grid-cols-2 gap-4 lg:grid-cols-4">
          {(featured ?? []).map((product, index) => (
            <ProductCard key={product._id} product={product} index={index} />
          ))}
        </div>
        {featured !== undefined && featured.length === 0 && (
          <div className="mt-7">
            <EmptyState
              title="The shelves are being stocked"
              description="Demo products are loading. Refresh in a moment to browse the catalogue."
            />
          </div>
        )}
      </section>

      {/* Deals band */}
      <section className="page-shell pt-16">
        <div className="relative overflow-hidden rounded-[28px] bg-[oklch(0.235_0.035_264)] text-white">
          <div
            className="pointer-events-none absolute -right-20 -top-24 size-80 rounded-full bg-[oklch(0.6_0.15_280)] opacity-30 blur-3xl"
            aria-hidden="true"
          />
          <div className="relative grid gap-8 p-7 sm:p-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/60">
                The CartNest Sale · demo offers
              </p>
              <h2 className="mt-3 text-[32px] font-bold leading-[1.08] tracking-tight sm:text-[40px]">
                Up to <span className="display-serif italic text-[oklch(0.85_0.09_285)]">45% off</span>{" "}
                selected favourites.
              </h2>
              <p className="mt-3 max-w-md text-sm leading-6 text-white/65">
                Apply a demo coupon to pieces that are already reduced. Each code is validated by
                the CartNest checkout before it is accepted.
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                {[
                  { code: "CARTNEST10", copy: "10% off · max ₹750" },
                  { code: "WELCOME200", copy: "₹200 off over ₹1,499" },
                ].map((coupon) => (
                  <span
                    key={coupon.code}
                    className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-3 py-1.5 text-[11px]"
                  >
                    <span className="font-bold tracking-wide">{coupon.code}</span>
                    <span className="text-white/55">{coupon.copy}</span>
                  </span>
                ))}
              </div>
              <Button
                asChild
                size="lg"
                className="mt-6 h-11 rounded-full bg-white px-5 text-[oklch(0.235_0.035_264)] hover:bg-white/90"
              >
                <Link to="/deals" data-testid="deals-band-cta">
                  Explore the offers
                  <ArrowRight className="size-4" aria-hidden="true" />
                </Link>
              </Button>
            </div>

            <div className="grid grid-cols-3 gap-2.5 sm:gap-3">
              {(deals ?? []).map((product) => (
                <Link
                  key={product._id}
                  to={`/product/${product.slug}`}
                  className="group rounded-2xl bg-white/5 p-2.5 ring-1 ring-white/10 transition-colors hover:bg-white/10"
                >
                  <div className="aspect-square overflow-hidden rounded-xl bg-white/10">
                    <ProductImage
                      src={product.image}
                      alt={product.name}
                      accent={product.accent}
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  </div>
                  <p className="mt-2 line-clamp-2 text-[11px] font-medium leading-4 text-white/85">
                    {product.name}
                  </p>
                  <p className="mt-1 text-xs font-bold">
                    {formatINR(product.price)}{" "}
                    <span className="text-[10px] font-normal text-[oklch(0.82_0.09_150)]">
                      {product.discountPercent}% off
                    </span>
                  </p>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Trending */}
      <section className="page-shell pt-16">
        <SectionHeading
          eyebrow="In demand"
          title="Trending this week"
          description="The pieces our customers are adding to their carts most often."
          action="/shop?sort=rating"
          actionLabel="Shop trending"
        />
        <div className="mt-7 grid grid-cols-2 gap-4 lg:grid-cols-4">
          {(trending ?? []).map((product, index) => (
            <ProductCard key={product._id} product={product} index={index} />
          ))}
        </div>
      </section>

      {/* Best sellers */}
      <section className="page-shell pt-16">
        <div className="grid gap-8 lg:grid-cols-[0.85fr_1.15fr] lg:gap-12">
          <div>
            <p className="eyebrow mb-2">Proven favourites</p>
            <h2 className="text-[26px] font-bold leading-[1.15] tracking-tight sm:text-[32px]">
              Best sellers, ranked.
            </h2>
            <p className="mt-3 max-w-sm text-sm leading-6 text-muted-foreground">
              The most reviewed pieces in the collection — a dependable starting point if you are
              exploring the storefront or testing a workflow.
            </p>
            {isAuthenticated ? (
              <Button asChild variant="outline" className="mt-5 rounded-full">
                <Link to="/orders">Review your orders</Link>
              </Button>
            ) : (
              <Button asChild variant="outline" className="mt-5 rounded-full">
                <Link to="/auth?mode=register">Create an account</Link>
              </Button>
            )}
          </div>

          <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border/80 bg-card">
            {(bestSellers ?? []).map((product, index) => (
              <Link
                key={product._id}
                to={`/product/${product.slug}`}
                data-testid={`bestseller-${product.slug}`}
                className="group flex items-center gap-4 p-3.5 transition-colors hover:bg-secondary/50 sm:p-4"
              >
                <span className="w-5 shrink-0 text-center text-sm font-bold tabular-nums text-muted-foreground">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <div className="size-16 shrink-0 overflow-hidden rounded-xl bg-secondary">
                  <ProductImage
                    src={product.image}
                    alt={product.name}
                    accent={product.accent}
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="eyebrow">{product.brand}</p>
                  <p className="mt-0.5 truncate text-sm font-semibold">{product.name}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <Rating value={product.rating} count={product.reviewCount} />
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold">{formatINR(product.price)}</p>
                  <p className="text-[11px] text-emerald-700">{product.discountPercent}% off</p>
                </div>
                <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Recently viewed */}
      {recentlyViewed.length > 0 && (
        <section className="page-shell pt-16">
          <SectionHeading
            eyebrow="Your history"
            title="Recently viewed"
            description="Kept in this browser only — the demo store does not profile you."
          />
          <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {recentlyViewed.slice(0, 4).map((product, index) => (
              <ProductCard key={product._id} product={product} index={index} compact />
            ))}
          </div>
        </section>
      )}

      {/* Newsletter */}
      <section className="page-shell pt-16">
        <div className="relative overflow-hidden rounded-[28px] border border-border/80 bg-[oklch(0.965_0.012_275)] px-6 py-10 sm:px-10">
          <div className="relative grid items-center gap-7 lg:grid-cols-[1.1fr_0.9fr]">
            <div>
              <p className="eyebrow mb-2">Stay in the loop</p>
              <h2 className="max-w-md text-[26px] font-bold leading-[1.15] tracking-tight sm:text-[30px]">
                New arrivals and quiet offers, once a week.
              </h2>
              <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
                A synthetic newsletter for the demo. Subscribing stores only the email you type in
                the CartNest database.
              </p>
            </div>
            <form onSubmit={handleSubscribe} className="w-full" data-testid="newsletter-form">
              <label htmlFor="newsletter-email" className="sr-only">
                Email address for newsletter
              </label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  id="newsletter-email"
                  name="newsletter_email"
                  type="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@example.com"
                  data-testid="newsletter-email"
                  className="h-11 rounded-full border-border bg-card px-4"
                />
                <Button
                  type="submit"
                  disabled={subscribing}
                  data-testid="newsletter-submit"
                  className="h-11 shrink-0 rounded-full px-6"
                >
                  {subscribing ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
                  Subscribe
                </Button>
              </div>
              <p className="mt-2 pl-1 text-[11px] text-muted-foreground">
                No spam. Unsubscribe anytime. Demo only.
              </p>
            </form>
          </div>
        </div>
      </section>
    </div>
  );
}
