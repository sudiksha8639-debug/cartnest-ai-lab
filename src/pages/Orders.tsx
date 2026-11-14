import { api } from "@/convex/_generated/api";
import { EmptyState } from "@/components/shop/EmptyState";
import { ProductImage } from "@/components/shop/ProductImage";
import { Button } from "@/components/ui/button";
import { useShop } from "@/context/ShopProvider";
import { formatDate, formatINR, statusTone } from "@/lib/shop";
import { cn } from "@/lib/utils";
import { useQuery } from "convex/react";
import { motion } from "framer-motion";
import { ChevronRight, Loader2, Package, PackageOpen, Truck } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";

const FILTERS = ["All", "Active", "Delivered"] as const;

export default function Orders() {
  const { guestKey } = useShop();
  const orders = useQuery(api.orders.listMine, { guestKey });
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("All");

  const filtered = (orders ?? []).filter((order) => {
    if (filter === "Active") return order.status !== "Delivered";
    if (filter === "Delivered") return order.status === "Delivered";
    return true;
  });

  return (
    <div className="page-shell py-8 sm:py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Order history</p>
          <h1 className="mt-1.5 text-[30px] font-bold tracking-tight sm:text-[36px]">My orders</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Track demo orders across five realistic statuses.
          </p>
        </div>
        <Button asChild variant="outline" className="rounded-full">
          <Link to="/shop">Continue shopping</Link>
        </Button>
      </div>

      <div className="mt-6 flex flex-wrap gap-1.5">
        {FILTERS.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setFilter(option)}
            aria-pressed={filter === option}
            data-testid={`orders-filter-${option.toLowerCase()}`}
            className={cn(
              "rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors",
              filter === option
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground",
            )}
          >
            {option}
            {orders && (
              <span className="ml-1.5 opacity-70">
                {option === "All"
                  ? orders.length
                  : option === "Active"
                    ? orders.filter((order) => order.status !== "Delivered").length
                    : orders.filter((order) => order.status === "Delivered").length}
              </span>
            )}
          </button>
        ))}
      </div>

      {orders === undefined ? (
        <div className="mt-8 flex items-center justify-center rounded-2xl border border-border/70 bg-card py-24">
          <Loader2 className="size-6 animate-spin text-muted-foreground" aria-hidden="true" />
          <span className="ml-3 text-sm text-muted-foreground">Loading your orders…</span>
        </div>
      ) : orders.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            icon={<PackageOpen className="size-6" aria-hidden="true" />}
            title="No demo orders yet"
            description="Place a demo order through the checkout and it will appear here with a tracking timeline."
            action={
              <Button asChild className="rounded-full">
                <Link to="/shop">Start shopping</Link>
              </Button>
            }
          />
        </div>
      ) : filtered.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            icon={<Package className="size-6" aria-hidden="true" />}
            title={`No ${filter.toLowerCase()} orders`}
            description="Try another filter to see your demo order history."
          />
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          {filtered.map((order, index) => (
            <motion.article
              key={order._id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.04 }}
              data-testid={`order-row-${order.orderNumber}`}
              className="overflow-hidden rounded-2xl border border-border/80 bg-card"
            >
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-secondary/35 px-4 py-3 sm:px-5">
                <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-[11px] text-muted-foreground">
                  <span>
                    Order{" "}
                    <span className="font-mono font-semibold text-foreground" data-testid="order-number">
                      {order.orderNumber}
                    </span>
                  </span>
                  <span>Placed {formatDate(order.placedAt)}</span>
                  <span>Total {formatINR(order.total)}</span>
                </div>
                <span
                  className={cn(
                    "rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide",
                    statusTone(order.status),
                  )}
                  data-testid="order-status"
                >
                  {order.status}
                </span>
              </div>

              <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:px-5">
                <div className="flex items-center gap-2">
                  {order.items.slice(0, 4).map((item) => (
                    <Link
                      key={`${item.slug}-${item.productId}`}
                      to={`/product/${item.slug}`}
                      className="size-14 overflow-hidden rounded-lg bg-secondary"
                      aria-label={`View ${item.name}`}
                    >
                      <ProductImage
                        src={item.image}
                        alt={item.name}
                        className="h-full w-full object-cover"
                      />
                    </Link>
                  ))}
                  {order.items.length > 4 && (
                    <span className="grid size-14 place-items-center rounded-lg bg-secondary text-xs font-semibold text-muted-foreground">
                      +{order.items.length - 4}
                    </span>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">
                    {order.items[0]?.name}
                    {order.items.length > 1 ? ` + ${order.items.length - 1} more` : ""}
                  </p>
                  <p className="mt-0.5 text-[11.5px] text-muted-foreground">
                    {order.itemCount} item{order.itemCount === 1 ? "" : "s"} ·{" "}
                    {order.paymentLabel.replace(" (DEMO)", "")}
                  </p>
                  {order.status !== "Delivered" && (
                    <p className="mt-1 inline-flex items-center gap-1 text-[11px] font-medium text-primary">
                      <Truck className="size-3.5" aria-hidden="true" />
                      Arriving by {formatDate(order.estimatedDelivery)}
                    </p>
                  )}
                </div>

                <Button asChild variant="outline" size="sm" className="rounded-full self-start sm:self-auto">
                  <Link to={`/orders/${order.orderNumber}`} data-testid={`view-order-${order.orderNumber}`}>
                    View details <ChevronRight className="size-3.5" />
                  </Link>
                </Button>
              </div>
            </motion.article>
          ))}
        </div>
      )}

      <p className="mt-6 rounded-xl border border-border/70 bg-card px-4 py-3 text-[11px] leading-5 text-muted-foreground">
        Demo note: order records include synthetic names, phone numbers and addresses so a
        privacy-aware browser agent can inspect them. Nothing is shipped and no payment is taken.
      </p>
    </div>
  );
}
