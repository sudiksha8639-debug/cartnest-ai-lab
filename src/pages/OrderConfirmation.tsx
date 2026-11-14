import { api } from "@/convex/_generated/api";
import { EmptyState } from "@/components/shop/EmptyState";
import { OrderReceipt } from "@/components/shop/OrderReceipt";
import { Button } from "@/components/ui/button";
import { useShop } from "@/context/ShopProvider";
import { useAuth } from "@/hooks/use-auth";
import { formatDate } from "@/lib/shop";
import { useQuery } from "convex/react";
import { motion } from "framer-motion";
import { ArrowRight, CheckCircle2, Loader2, PackageSearch, ShieldCheck } from "lucide-react";
import { Link, useParams, useSearchParams } from "react-router";

export default function OrderConfirmation() {
  const { orderNumber = "" } = useParams();
  const [searchParams] = useSearchParams();
  const isNew = searchParams.get("new") === "1";
  const { guestKey } = useShop();
  const { isAuthenticated } = useAuth();
  const order = useQuery(api.orders.getByNumber, { orderNumber, guestKey });

  if (order === undefined) {
    return (
      <div className="page-shell flex min-h-[50vh] items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" aria-hidden="true" />
        <span className="ml-3 text-sm text-muted-foreground">Loading your demo order…</span>
      </div>
    );
  }

  if (order === null) {
    return (
      <div className="page-shell py-14">
        <EmptyState
          icon={<PackageSearch className="size-6" aria-hidden="true" />}
          title="We couldn't find that order"
          description="This demo order may belong to another browser session or may not exist. Signed-in customers can find their orders under My Orders."
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Button asChild className="rounded-full">
                <Link to="/shop">Continue shopping</Link>
              </Button>
              <Button asChild variant="outline" className="rounded-full">
                <Link to="/orders">My orders</Link>
              </Button>
            </div>
          }
        />
      </div>
    );
  }

  return (
    <div className="page-shell py-8 sm:py-12">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="overflow-hidden rounded-3xl border border-border/80 bg-[oklch(0.972_0.012_275)]"
      >
        <div className="flex flex-col gap-6 p-6 sm:p-9 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-4">
            <span className="grid size-12 shrink-0 place-items-center rounded-full bg-emerald-100 text-emerald-700">
              <CheckCircle2 className="size-6" aria-hidden="true" />
            </span>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-emerald-700">
                {isNew ? "Demo order confirmed" : "Demo order receipt"}
              </p>
              <h1 className="mt-1.5 text-[28px] font-bold leading-tight tracking-tight sm:text-[34px]">
                Thank you, {order.customerName.split(" ")[0]}.
              </h1>
              <p className="mt-1.5 max-w-xl text-sm leading-6 text-muted-foreground">
                Order <span className="font-mono font-semibold text-foreground" data-testid="confirmation-order-number">{order.orderNumber}</span>{" "}
                is placed in demo mode. Estimated delivery{" "}
                <span className="font-semibold text-foreground">{formatDate(order.estimatedDelivery)}</span>.
              </p>
              <p className="mt-1.5 inline-flex items-center gap-1.5 text-[11px] font-medium text-emerald-700">
                <ShieldCheck className="size-3.5" aria-hidden="true" />
                No payment was captured. This is a simulated transaction.
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row lg:flex-col">
            {isAuthenticated ? (
              <Button asChild className="rounded-full">
                <Link to={`/orders/${order.orderNumber}`} data-testid="confirmation-track-order">
                  Track this order <ArrowRight className="size-4" />
                </Link>
              </Button>
            ) : (
              <Button asChild className="rounded-full">
                <Link to="/auth?returnTo=/orders">Sign in to track this order</Link>
              </Button>
            )}
            <Button asChild variant="outline" className="rounded-full bg-card">
              <Link to="/shop">Continue shopping</Link>
            </Button>
          </div>
        </div>
      </motion.div>

      <div className="mt-7">
        <OrderReceipt order={order} />
      </div>

      <p className="mt-5 rounded-xl border border-border/70 bg-card px-4 py-3 text-[11px] leading-5 text-muted-foreground">
        This receipt contains synthetic customer information for privacy-agent testing. It is stored
        in the CartNest demo database and can be viewed again from My Orders when signed in.
      </p>
    </div>
  );
}
