import { api } from "@/convex/_generated/api";
import { EmptyState } from "@/components/shop/EmptyState";
import { ProductCard } from "@/components/shop/ProductCard";
import { ProductImage } from "@/components/shop/ProductImage";
import { ProductReviews } from "@/components/shop/ProductReviews";
import { QuantityStepper } from "@/components/shop/QuantityStepper";
import { Rating } from "@/components/shop/Rating";
import { SectionHeading } from "@/components/shop/SectionHeading";
import { Button } from "@/components/ui/button";
import { useShop } from "@/context/ShopProvider";
import { formatDate, formatINR } from "@/lib/shop";
import { cn } from "@/lib/utils";
import { useQuery } from "convex/react";
import { motion } from "framer-motion";
import {
  BadgeCheck,
  Boxes,
  ChevronRight,
  Heart,
  Loader2,
  PackageX,
  ShieldCheck,
  ShoppingBag,
  Truck,
  Undo2,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";

const DAY = 24 * 60 * 60 * 1000;

export default function ProductDetail() {
  const { slug = "" } = useParams();
  const navigate = useNavigate();
  const product = useQuery(api.products.getBySlug, { slug });
  const related = useQuery(api.products.related, { slug, limit: 4 });
  const { addToCart, toggleWishlist, isWishlisted, recordView } = useShop();
  const [quantity, setQuantity] = useState(1);
  const [imageIndex, setImageIndex] = useState(0);
  const [adding, setAdding] = useState(false);
  const [deliveryDate] = useState(() => formatDate(Date.now() + 3 * DAY));

  useEffect(() => {
    if (product) recordView(product._id);
  }, [product?._id, recordView]);

  if (product === undefined) {
    return (
      <div className="page-shell flex min-h-[50vh] items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" aria-hidden="true" />
        <span className="ml-3 text-sm text-muted-foreground">Loading product…</span>
      </div>
    );
  }

  if (product === null) {
    return (
      <div className="page-shell py-16">
        <EmptyState
          icon={<PackageX className="size-6" aria-hidden="true" />}
          title="This product has moved on"
          description="The item you are looking for is not in the catalogue. Browse the full range to find an alternative."
          action={
            <Button asChild className="rounded-full">
              <Link to="/shop">Back to shop</Link>
            </Button>
          }
        />
      </div>
    );
  }

  const wishlisted = isWishlisted(product._id);
  const outOfStock = product.stock <= 0;
  const gallery = product.gallery.length > 0 ? product.gallery : [product.image];
  const activeImage = Math.min(imageIndex, gallery.length - 1);
  const maxQuantity = Math.max(1, Math.min(10, product.stock));
  const activeQuantity = Math.min(quantity, maxQuantity);

  async function handleAdd(redirect?: "cart" | "checkout") {
    if (!product) return;
    setAdding(true);
    try {
      await addToCart(product, activeQuantity);
      if (redirect === "cart") navigate("/cart");
      if (redirect === "checkout") navigate("/checkout");
    } finally {
      setAdding(false);
    }
  }

  return (
    <div className="page-shell py-6 sm:py-10" data-testid="product-detail">
      <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
        <Link to="/" className="hover:text-foreground">
          Home
        </Link>
        <ChevronRight className="size-3" aria-hidden="true" />
        <Link to="/shop" className="hover:text-foreground">
          Shop
        </Link>
        <ChevronRight className="size-3" aria-hidden="true" />
        <Link
          to={`/shop?category=${encodeURIComponent(product.category)}`}
          className="hover:text-foreground"
        >
          {product.category}
        </Link>
        <ChevronRight className="size-3" aria-hidden="true" />
        <span className="font-medium text-foreground">{product.name}</span>
      </nav>

      <div className="mt-6 grid gap-8 lg:grid-cols-[1.02fr_0.98fr] lg:gap-12">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <div className="relative overflow-hidden rounded-[26px] border border-border/80 bg-secondary">
            <div className="aspect-square">
              <ProductImage
                key={gallery[activeImage]}
                src={gallery[activeImage]}
                alt={`${product.name} — image ${activeImage + 1}`}
                accent={product.accent}
                eager
                className="h-full w-full object-cover"
              />
            </div>
            <div className="absolute left-4 top-4 flex flex-col gap-2">
              {product.discountPercent > 0 && (
                <span className="rounded-full bg-primary px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-primary-foreground">
                  {product.discountPercent}% off
                </span>
              )}
              {product.isNew && (
                <span className="rounded-full bg-background/95 px-3 py-1 text-[11px] font-bold uppercase tracking-wide">
                  New arrival
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={() => void toggleWishlist(product)}
              aria-label={wishlisted ? "Remove from wishlist" : "Save to wishlist"}
              aria-pressed={wishlisted}
              data-testid="detail-wishlist-toggle"
              className={cn(
                "absolute right-4 top-4 grid size-10 place-items-center rounded-full border border-border/70 bg-background/90 backdrop-blur transition-colors hover:bg-background",
                wishlisted && "border-rose-200 bg-rose-50",
              )}
            >
              <Heart
                className={cn("size-[18px]", wishlisted && "fill-rose-500 text-rose-500")}
                aria-hidden="true"
              />
            </button>
          </div>

          {gallery.length > 1 && (
            <div className="mt-3 flex gap-2.5 overflow-x-auto pb-1 no-scrollbar">
              {gallery.map((src, index) => (
                <button
                  key={`${src}-${index}`}
                  type="button"
                  onClick={() => setImageIndex(index)}
                  aria-label={`Show image ${index + 1} of ${product.name}`}
                  aria-current={activeImage === index}
                  className={cn(
                    "size-20 shrink-0 overflow-hidden rounded-xl border-2 transition-colors",
                    activeImage === index ? "border-primary" : "border-transparent opacity-70 hover:opacity-100",
                  )}
                >
                  <ProductImage
                    src={src}
                    alt=""
                    accent={product.accent}
                    className="h-full w-full object-cover"
                  />
                </button>
              ))}
            </div>
          )}

          <div className="mt-5 grid grid-cols-3 gap-2.5">
            {[
              { icon: Truck, label: "Free delivery over ₹999" },
              { icon: Undo2, label: "7-day easy returns" },
              { icon: ShieldCheck, label: "Demo-safe payments" },
            ].map(({ icon: Icon, label }) => (
              <div
                key={label}
                className="flex flex-col items-center gap-1.5 rounded-xl border border-border/70 bg-card px-2 py-3 text-center"
              >
                <Icon className="size-4 text-primary" aria-hidden="true" />
                <span className="text-[10.5px] font-medium leading-4 text-muted-foreground">{label}</span>
              </div>
            ))}
          </div>
        </motion.div>

        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-secondary px-2.5 py-1 text-[11px] font-semibold">
              {product.brand}
            </span>
            <Link
              to={`/shop?category=${encodeURIComponent(product.category)}`}
              className="text-[11px] font-medium text-muted-foreground hover:text-primary"
            >
              {product.category}
            </Link>
            <span className="text-[11px] text-muted-foreground">·</span>
            <span className="text-[11px] text-muted-foreground" data-testid="product-sku">
              ID: {product.slug.toUpperCase()}
            </span>
          </div>

          <h1
            className="mt-3 text-[30px] font-bold leading-[1.12] tracking-tight sm:text-[36px]"
            data-testid="product-title"
          >
            {product.name}
          </h1>

          <div className="mt-3 flex flex-wrap items-center gap-3">
            <Rating value={product.rating} count={product.reviewCount} size="md" />
            <span className="h-3.5 w-px bg-border" aria-hidden="true" />
            <span
              className={cn(
                "inline-flex items-center gap-1.5 text-xs font-semibold",
                outOfStock ? "text-destructive" : "text-emerald-700",
              )}
              data-testid="product-stock"
            >
              <span
                className={cn(
                  "size-1.5 rounded-full",
                  outOfStock ? "bg-destructive" : "bg-emerald-600",
                )}
                aria-hidden="true"
              />
              {outOfStock ? "Out of stock" : `In stock · ${product.stock} available`}
            </span>
            <BadgeCheck className="size-4 text-primary" aria-hidden="true" />
            <a
              href="#reviews"
              className="text-xs font-semibold text-primary underline-offset-4 hover:underline"
            >
              Read customer reviews
            </a>
          </div>

          <div className="mt-5 rounded-2xl border border-border/80 bg-card p-5">
            <div className="flex flex-wrap items-end gap-2.5">
              <span className="text-[32px] font-bold leading-none tracking-tight" data-testid="product-price">
                {formatINR(product.price)}
              </span>
              {product.discountPercent > 0 && (
                <>
                  <span className="text-sm text-muted-foreground line-through" data-testid="product-mrp">
                    {formatINR(product.mrp)}
                  </span>
                  <span className="rounded-full bg-emerald-50 px-2 py-1 text-[11px] font-bold text-emerald-700">
                    Save {formatINR(product.mrp - product.price)}
                  </span>
                </>
              )}
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">
              Inclusive of all taxes. Demo pricing — no payment will be captured.
            </p>
          </div>

          <p className="mt-5 text-sm leading-7 text-muted-foreground">{product.description}</p>

          <ul className="mt-4 space-y-2">
            {product.highlights.map((highlight) => (
              <li key={highlight} className="flex items-start gap-2 text-[13px] leading-5">
                <BadgeCheck className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
                <span>{highlight}</span>
              </li>
            ))}
          </ul>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-3">
              <span className="text-xs font-medium text-muted-foreground">Quantity</span>
              <QuantityStepper
                value={activeQuantity}
                onChange={setQuantity}
                max={maxQuantity}
                disabled={outOfStock}
                label={`Quantity for ${product.name}`}
                testId="detail-quantity"
              />
            </div>
            <span className="text-[11px] text-muted-foreground">
              {outOfStock ? "Unavailable" : `Max ${Math.min(10, product.stock)} per order`}
            </span>
          </div>

          <div className="mt-5 flex flex-col gap-2.5 sm:flex-row">
            <Button
              size="lg"
              disabled={outOfStock || adding}
              onClick={() => void handleAdd()}
              data-testid="detail-add-to-cart"
              aria-label={`Add ${product.name} to cart`}
              className="h-12 flex-1 rounded-full"
            >
              {adding ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <ShoppingBag className="size-4" aria-hidden="true" />
              )}
              Add to cart
            </Button>
            <Button
              size="lg"
              variant="outline"
              disabled={outOfStock || adding}
              onClick={() => void handleAdd("checkout")}
              data-testid="detail-buy-now"
              className="h-12 flex-1 rounded-full border-border bg-card"
            >
              Buy now
            </Button>
          </div>

          <div className="mt-5 rounded-2xl border border-border/80 bg-card p-4">
            <div className="flex items-start gap-3">
              <Truck className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
              <div className="text-[13px] leading-5">
                <p className="font-semibold">
                  Free delivery by {deliveryDate} <span className="font-normal text-muted-foreground">(standard)</span>
                </p>
                <p className="mt-0.5 text-[11.5px] text-muted-foreground">
                  Express delivery available at checkout. Order before 4 PM for the fastest dispatch.
                </p>
              </div>
            </div>
            <div className="mt-3 flex items-start gap-3 border-t border-border/70 pt-3">
              <Boxes className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
              <p className="text-[11.5px] leading-5 text-muted-foreground">
                Sold and dispatched by <span className="font-semibold text-foreground">{product.brand} Official Store</span>.
                7-day return window, demo refunds only.
              </p>
            </div>
          </div>
        </div>
      </div>

      {product.specs.length > 0 && (
        <section className="mt-14" aria-labelledby="specs-heading">
          <h2 id="specs-heading" className="text-xl font-bold tracking-tight">
            Specifications
          </h2>
        <div className="mt-4 grid gap-x-10 overflow-hidden rounded-2xl border border-border/80 bg-card sm:grid-cols-2">
          {product.specs.map((spec, index) => (
            <div
              key={spec.label}
              className={cn(
                "flex items-baseline justify-between gap-6 px-5 py-3.5 text-sm",
                index < product.specs.length - 1 && "border-b border-border/70",
              )}
            >
              <dt className="shrink-0 text-muted-foreground">{spec.label}</dt>
              <dd className="text-right font-medium">{spec.value}</dd>
            </div>
          ))}
        </div>
          <p className="mt-2.5 text-[11px] text-muted-foreground">
            Specifications are synthetic demo content for agent testing.
          </p>
        </section>
      )}

      <ProductReviews product={product} />

      <section className="mt-16">
        <SectionHeading
          eyebrow="Goes well with"
          title="You may also like"
          description={`More from ${product.category.toLowerCase()} and ${product.brand}.`}
          action={`/shop?category=${encodeURIComponent(product.category)}`}
          actionLabel={`All ${product.category}`}
        />
        <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
          {(related ?? []).map((item, index) => (
            <ProductCard key={item._id} product={item} index={index} />
          ))}
        </div>
      </section>
    </div>
  );
}
