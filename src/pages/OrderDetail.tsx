import { api } from "@/convex/_generated/api";
import { EmptyState } from "@/components/shop/EmptyState";
import { OrderReceipt } from "@/components/shop/OrderReceipt";
import { Button } from "@/components/ui/button";
import { useShop } from "@/context/ShopProvider";
import { formatDate } from "@/lib/shop";
import { useQuery } from "convex/react";
import { ArrowLeft, Loader2, PackageSearch } from "lucide-react";
import { Link, useParams } from "react-router";

export default function OrderDetail() {
  const { orderNumber = "" } = useParams();
  const { guestKey } = useShop();
  const order = useQuery(api.orders.getByNumber, { orderNumber, guestKey });

  if (order === undefined) {
    return (
      <div className="page-shell flex min-h-[50vh] items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" aria-hidden="true" />
        <span className="ml-3 text-sm text-muted-foreground">Loading order…</span>
      </div>
    );
  }

  if (order === null) {
    return (
      <div className="page-shell py-14">
        <EmptyState
          icon={<PackageSearch className="size-6" aria-hidden="true" />}
          title="Order not found"
          description="This order does not exist in this browser session's demo account. Head back to your order history."
          action={
            <Button asChild className="rounded-full">
              <Link to="/orders">Back to my orders</Link>
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="page-shell py-8 sm:py-10">
      <Link
        to="/orders"
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" aria-hidden="true" /> All orders
      </Link>

      <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">Order details · demo</p>
          <h1 className="mt-1.5 font-mono text-[26px] font-bold tracking-tight sm:text-[32px]">
            {order.orderNumber}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Placed {formatDate(order.placedAt)} · {order.status}
          </p>
        </div>
        <Button asChild variant="outline" className="rounded-full">
          <Link to="/contact#order-support">Need help with this order?</Link>
        </Button>
      </div>

      <div className="mt-6">
        <OrderReceipt order={order} />
      </div>
    </div>
  );
}
