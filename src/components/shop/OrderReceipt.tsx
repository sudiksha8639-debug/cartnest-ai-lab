import type { Doc } from "@/convex/_generated/dataModel";
import { formatDate, formatINR, statusTone } from "@/lib/shop";
import { cn } from "@/lib/utils";
import { CreditCard, MapPin, Receipt, Truck, UserRound } from "lucide-react";
import { Link } from "react-router";
import { OrderTimeline } from "./OrderTimeline";
import { ProductImage } from "./ProductImage";

export function OrderReceipt({ order }: { order: Doc<"orders"> }) {
  return (
    <div className="grid gap-6 lg:grid-cols-[1.45fr_0.85fr]">
      <div className="space-y-5">
        <div className="overflow-hidden rounded-2xl border border-border/80 bg-card">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-5 py-4">
            <h2 className="text-sm font-bold">Items in this order</h2>
            <span className="text-[11px] text-muted-foreground">
              {order.items.reduce((sum, item) => sum + item.quantity, 0)} item
              {order.items.reduce((sum, item) => sum + item.quantity, 0) === 1 ? "" : "s"}
            </span>
          </div>
          <ul className="divide-y divide-border">
            {order.items.map((item) => (
              <li key={`${item.productId}-${item.slug}`} className="flex items-center gap-3.5 p-4">
                <Link
                  to={`/product/${item.slug}`}
                  className="size-16 shrink-0 overflow-hidden rounded-xl bg-secondary"
                  aria-label={`View ${item.name}`}
                >
                  <ProductImage
                    src={item.image}
                    alt={item.name}
                    className="h-full w-full object-cover"
                  />
                </Link>
                <div className="min-w-0 flex-1">
                  <p className="eyebrow">{item.brand}</p>
                  <Link
                    to={`/product/${item.slug}`}
                    className="mt-0.5 block truncate text-sm font-semibold hover:text-primary"
                  >
                    {item.name}
                  </Link>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    Qty {item.quantity} · {formatINR(item.price)} each
                  </p>
                </div>
                <p className="text-sm font-bold">{formatINR(item.price * item.quantity)}</p>
              </li>
            ))}
          </ul>

          <dl className="space-y-2 border-t border-border bg-secondary/30 px-5 py-4 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Subtotal</dt>
              <dd>{formatINR(order.subtotal)}</dd>
            </div>
            {order.discount > 0 && (
              <div className="flex justify-between text-emerald-700">
                <dt>Coupon {order.couponCode ?? ""}</dt>
                <dd>− {formatINR(order.discount)}</dd>
              </div>
            )}
            <div className="flex justify-between">
              <dt className="text-muted-foreground">
                Delivery ({order.deliveryMethod === "express" ? "express" : "standard"})
              </dt>
              <dd>{order.deliveryFee === 0 ? "Free" : formatINR(order.deliveryFee)}</dd>
            </div>
            <div className="flex items-baseline justify-between border-t border-border pt-3">
              <dt className="font-semibold">Total</dt>
              <dd className="text-xl font-bold" data-testid="receipt-total">
                {formatINR(order.total)}
              </dd>
            </div>
          </dl>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-border/80 bg-card p-4">
            <div className="flex items-center gap-2 text-primary">
              <UserRound className="size-4" aria-hidden="true" />
              <h2 className="text-xs font-bold uppercase tracking-wide">Customer details</h2>
            </div>
            <dl className="mt-3 space-y-1.5 text-xs">
              <div>
                <dt className="sr-only">Customer name</dt>
                <dd className="font-semibold" data-testid="receipt-customer-name">
                  {order.customerName}
                </dd>
              </div>
              <div>
                <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">Email</dt>
                <dd data-testid="receipt-customer-email">{order.customerEmail}</dd>
              </div>
              <div>
                <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">Phone</dt>
                <dd data-testid="receipt-customer-phone">{order.customerPhone}</dd>
              </div>
            </dl>
          </div>

          <div className="rounded-2xl border border-border/80 bg-card p-4">
            <div className="flex items-center gap-2 text-primary">
              <MapPin className="size-4" aria-hidden="true" />
              <h2 className="text-xs font-bold uppercase tracking-wide">Delivery address</h2>
            </div>
            <address className="mt-3 space-y-1 text-xs not-italic" data-testid="receipt-address">
              <p className="font-semibold">{order.address.fullName}</p>
              <p>{order.address.house}</p>
              <p>{order.address.street}</p>
              <p>
                {order.address.city}, {order.address.state} — {order.address.postalCode}
              </p>
              <p>{order.address.country}</p>
              <p className="text-muted-foreground">{order.address.phone}</p>
              <p className="pt-1">
                <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
                  {order.address.addressType}
                </span>
              </p>
            </address>
          </div>
        </div>

        <div className="rounded-2xl border border-border/80 bg-card p-4">
          <div className="flex items-center gap-2 text-primary">
            <CreditCard className="size-4" aria-hidden="true" />
            <h2 className="text-xs font-bold uppercase tracking-wide">Payment</h2>
          </div>
          <p className="mt-2 text-sm font-semibold" data-testid="receipt-payment-method">
            {order.paymentLabel}
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Simulated transaction — no gateway was contacted and no money moved.
          </p>
          {order.deliveryInstructions && (
            <p className="mt-3 border-t border-border pt-3 text-[11.5px] italic text-muted-foreground">
              Delivery note: “{order.deliveryInstructions}”
            </p>
          )}
        </div>
      </div>

      <aside className="space-y-4">
        <div className="rounded-2xl border border-border/80 bg-card p-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-primary">
              <Receipt className="size-4" aria-hidden="true" />
              <h2 className="text-xs font-bold uppercase tracking-wide">Order</h2>
            </div>
            <span
              className={cn(
                "rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide",
                statusTone(order.status),
              )}
              data-testid="receipt-status"
            >
              {order.status}
            </span>
          </div>
          <dl className="mt-3 space-y-2 text-xs">
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Order ID</dt>
              <dd className="font-mono font-semibold" data-testid="receipt-order-number">
                {order.orderNumber}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Placed on</dt>
              <dd>{formatDate(order.placedAt)}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Estimated delivery</dt>
              <dd className="text-right font-medium">{formatDate(order.estimatedDelivery)}</dd>
            </div>
          </dl>
        </div>

        <div className="rounded-2xl border border-border/80 bg-card p-4">
          <div className="flex items-center gap-2 text-primary">
            <Truck className="size-4" aria-hidden="true" />
            <h2 className="text-xs font-bold uppercase tracking-wide">Tracking</h2>
          </div>
          <OrderTimeline status={order.status} history={order.statusHistory} />
        </div>
      </aside>
    </div>
  );
}
