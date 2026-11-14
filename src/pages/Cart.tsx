import { api } from "@/convex/_generated/api";
import { EmptyState } from "@/components/shop/EmptyState";
import { ProductImage } from "@/components/shop/ProductImage";
import { QuantityStepper } from "@/components/shop/QuantityStepper";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useShop } from "@/context/ShopProvider";
import { readStoredCoupon, storeCoupon, totalsFor, type AppliedCoupon } from "@/lib/coupons";
import { formatINR } from "@/lib/shop";
import { useConvex } from "convex/react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRight,
  ChevronRight,
  Loader2,
  ShieldCheck,
  ShoppingBag,
  Tag,
  Trash2,
  Truck,
  X,
} from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import { toast } from "sonner";

export default function Cart() {
  const { cart, setQuantity, removeItem, clearCart } = useShop();
  const convex = useConvex();
  const [coupon, setCoupon] = useState<AppliedCoupon | null>(readStoredCoupon);
  const [codeDraft, setCodeDraft] = useState("");
  const [couponError, setCouponError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  const subtotal = cart?.subtotal ?? 0;
  const totals = totalsFor(subtotal, "standard", coupon);
  const savings = (cart?.items ?? []).reduce(
    (sum, item) => sum + (item.product.mrp - item.product.price) * item.quantity,
    0,
  );
  const towardsFreeDelivery = Math.max(0, 999 - subtotal);

  async function applyCoupon(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const code = codeDraft.trim();
    if (!code) {
      setCouponError("Enter a coupon code first.");
      return;
    }
    if (subtotal <= 0) {
      setCouponError("Add a product before applying a coupon.");
      return;
    }
    setChecking(true);
    setCouponError(null);
    try {
      const result = await convex.query(api.coupons.validate, {
        code,
        subtotal,
        deliveryMethod: "standard",
      });
      if (!result.ok) {
        setCouponError(result.message);
        return;
      }
      const applied: AppliedCoupon = {
        code: result.code,
        description: result.description,
        kind: result.kind,
        value: result.value,
        minSubtotal: result.minSubtotal,
      };
      setCoupon(applied);
      storeCoupon(applied);
      setCodeDraft("");
      toast.success(`${applied.code} applied`, { description: applied.description });
    } catch (error) {
      setCouponError(error instanceof Error ? error.message : "Could not validate that coupon.");
    } finally {
      setChecking(false);
    }
  }

  function removeCoupon() {
    setCoupon(null);
    storeCoupon(null);
    setCouponError(null);
    toast("Coupon removed");
  }

  if (cart === undefined) {
    return (
      <div className="page-shell flex min-h-[50vh] items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" aria-hidden="true" />
        <span className="ml-3 text-sm text-muted-foreground">Loading your cart…</span>
      </div>
    );
  }

  if (cart.items.length === 0) {
    return (
      <div className="page-shell py-12 sm:py-16">
        <h1 className="text-[30px] font-bold tracking-tight sm:text-[36px]">Your cart</h1>
        <div className="mt-8">
          <EmptyState
            icon={<ShoppingBag className="size-6" aria-hidden="true" />}
            title="Your cart is empty"
            description="Browse the collection and add something you love. Your cart is saved to this browser session as you shop."
            action={
              <Button asChild size="lg" className="rounded-full">
                <Link to="/shop">Start shopping</Link>
              </Button>
            }
          />
        </div>
      </div>
    );
  }

  return (
    <div className="page-shell py-8 sm:py-10">
      <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-xs text-muted-foreground">
        <Link to="/" className="hover:text-foreground">
          Home
        </Link>
        <ChevronRight className="size-3" aria-hidden="true" />
        <span className="font-medium text-foreground">Cart</span>
      </nav>

      <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[30px] font-bold tracking-tight sm:text-[36px]" data-testid="cart-heading">
            Your cart
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            {cart.count} item{cart.count === 1 ? "" : "s"} · prices include all taxes
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="text-xs text-muted-foreground"
          onClick={() => void clearCart()}
          data-testid="clear-cart"
        >
          <Trash2 className="size-3.5" /> Empty cart
        </Button>
      </div>

      <div className="mt-7 grid gap-8 lg:grid-cols-[1.55fr_0.85fr]">
        <div className="space-y-4">
          <AnimatePresence initial={false}>
            {cart.items.map((item) => (
              <motion.article
                key={item._id}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                data-testid={`cart-item-${item.product.slug}`}
                className="flex gap-4 rounded-2xl border border-border/80 bg-card p-3.5 sm:p-4"
              >
                <Link
                  to={`/product/${item.product.slug}`}
                  className="size-24 shrink-0 overflow-hidden rounded-xl bg-secondary sm:size-28"
                  aria-label={`View ${item.product.name}`}
                >
                  <ProductImage
                    src={item.product.image}
                    alt={item.product.name}
                    accent={item.product.accent}
                    className="h-full w-full object-cover transition-transform duration-500 hover:scale-105"
                  />
                </Link>

                <div className="flex min-w-0 flex-1 flex-col">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="eyebrow">{item.product.brand}</p>
                      <h2 className="mt-0.5 line-clamp-2 text-sm font-semibold leading-5">
                        <Link to={`/product/${item.product.slug}`} className="hover:text-primary">
                          {item.product.name}
                        </Link>
                      </h2>
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        {item.product.category} · In stock
                      </p>
                    </div>
                    <button
                      type="button"
                      aria-label={`Remove ${item.product.name} from cart`}
                      data-testid={`remove-item-${item.product.slug}`}
                      onClick={() => void removeItem(item._id)}
                      className="grid size-8 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-destructive"
                    >
                      <Trash2 className="size-4" aria-hidden="true" />
                    </button>
                  </div>

                  <div className="mt-auto flex flex-wrap items-end justify-between gap-3 pt-3">
                    <QuantityStepper
                      value={item.quantity}
                      onChange={(next) => void setQuantity(item._id, next)}
                      max={Math.max(1, Math.min(10, item.product.stock))}
                      label={`Quantity for ${item.product.name}`}
                      testId={`cart-quantity-${item.product.slug}`}
                    />
                    <div className="text-right">
                      <p className="text-sm font-bold">
                        {formatINR(item.product.price * item.quantity)}
                      </p>
                      {item.product.mrp > item.product.price && (
                        <p className="text-[11px] text-muted-foreground line-through">
                          {formatINR(item.product.mrp * item.quantity)}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </motion.article>
            ))}
          </AnimatePresence>

          <div className="rounded-2xl border border-border/80 bg-card p-5">
            <div className="flex items-center gap-2">
              <Tag className="size-4 text-primary" aria-hidden="true" />
              <h2 className="text-sm font-bold">Have a coupon?</h2>
            </div>
            <p className="mt-1 text-[11.5px] text-muted-foreground">
              Try <span className="font-semibold text-foreground">CARTNEST10</span>,{" "}
              <span className="font-semibold text-foreground">WELCOME200</span> or{" "}
              <span className="font-semibold text-foreground">FREESHIP</span>.
            </p>

            <AnimatePresence mode="wait">
              {coupon ? (
                <motion.div
                  key={coupon.code}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-emerald-200 bg-emerald-50/70 px-3.5 py-2.5"
                  data-testid="applied-coupon"
                >
                  <div>
                    <p className="text-xs font-bold text-emerald-800">{coupon.code} applied</p>
                    <p className="text-[11px] text-emerald-700">{coupon.description}</p>
                  </div>
                  <button
                    type="button"
                    onClick={removeCoupon}
                    aria-label={`Remove coupon ${coupon.code}`}
                    className="inline-flex items-center gap-1 rounded-full border border-emerald-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-emerald-800 hover:bg-emerald-50"
                  >
                    <X className="size-3" aria-hidden="true" /> Remove
                  </button>
                </motion.div>
              ) : (
                <form onSubmit={applyCoupon} className="mt-3" data-testid="coupon-form">
                  <label htmlFor="coupon-code" className="sr-only">
                    Coupon code
                  </label>
                  <div className="flex gap-2">
                    <Input
                      id="coupon-code"
                      name="coupon_code"
                      value={codeDraft}
                      onChange={(event) => {
                        setCodeDraft(event.target.value.toUpperCase());
                        setCouponError(null);
                      }}
                      placeholder="Enter coupon code"
                      className="h-10 uppercase"
                      data-testid="coupon-input"
                      aria-invalid={Boolean(couponError)}
                    />
                    <Button
                      type="submit"
                      variant="outline"
                      disabled={checking}
                      data-testid="apply-coupon"
                      className="h-10 shrink-0"
                    >
                      {checking ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
                      Apply
                    </Button>
                  </div>
                  {couponError && (
                    <p role="alert" className="mt-2 text-[11.5px] font-medium text-destructive">
                      {couponError}
                    </p>
                  )}
                </form>
              )}
            </AnimatePresence>
          </div>

          <div className="flex items-center gap-2 rounded-2xl border border-border/70 bg-card px-4 py-3 text-[11.5px] text-muted-foreground">
            <ShieldCheck className="size-4 shrink-0 text-emerald-600" aria-hidden="true" />
            Demo cart — nothing is purchased and no payment details are collected.
          </div>
        </div>

        <aside className="lg:sticky lg:top-32 lg:self-start">
          <div className="rounded-2xl border border-border/80 bg-card p-5">
            <h2 className="text-base font-bold">Order summary</h2>

            <dl className="mt-4 space-y-2.5 text-sm">
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted-foreground">Subtotal ({cart.count} items)</dt>
                <dd className="font-medium">{formatINR(totals.subtotal)}</dd>
              </div>
              {coupon && totals.discount > 0 && (
                <div className="flex items-center justify-between gap-3 text-emerald-700">
                  <dt>Coupon {coupon.code}</dt>
                  <dd className="font-medium">− {formatINR(totals.discount)}</dd>
                </div>
              )}
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted-foreground">Delivery (standard)</dt>
                <dd className="font-medium">
                  {totals.deliveryFee === 0 ? (
                    <span className="text-emerald-700">Free</span>
                  ) : (
                    formatINR(totals.deliveryFee)
                  )}
                </dd>
              </div>
              {savings > 0 && (
                <div className="flex items-center justify-between gap-3 text-[12px] text-emerald-700">
                  <dt>Product savings</dt>
                  <dd>You save {formatINR(savings)}</dd>
                </div>
              )}
            </dl>

            <div className="mt-4 flex items-baseline justify-between border-t border-border pt-4">
              <span className="text-sm font-semibold">Total payable</span>
              <span className="text-2xl font-bold tracking-tight" data-testid="cart-total">
                {formatINR(totals.total)}
              </span>
            </div>

            {towardsFreeDelivery > 0 && (
              <p className="mt-2 rounded-lg bg-secondary px-3 py-2 text-[11px] text-muted-foreground">
                Add {formatINR(towardsFreeDelivery)} more for free standard delivery.
              </p>
            )}

            <Button asChild size="lg" className="mt-5 h-12 w-full rounded-full" data-testid="cart-checkout">
              <Link to="/checkout">
                Proceed to checkout
                <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            </Button>
            <Link
              to="/shop"
              className="mt-2.5 block rounded-full py-2 text-center text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground"
            >
              Continue shopping
            </Link>

            <div className="mt-4 space-y-2 border-t border-border pt-4 text-[11px] text-muted-foreground">
              <p className="flex items-center gap-2">
                <Truck className="size-3.5 shrink-0" aria-hidden="true" /> Delivery options chosen at checkout
              </p>
              <p className="flex items-center gap-2">
                <ShieldCheck className="size-3.5 shrink-0" aria-hidden="true" /> Demo payments only — COD,
                UPI demo or card demo
              </p>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
