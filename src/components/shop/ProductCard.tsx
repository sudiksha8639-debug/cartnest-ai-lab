import type { Doc } from "@/convex/_generated/dataModel";
import { useShop } from "@/context/ShopProvider";
import { formatINR } from "@/lib/shop";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { Heart, Plus } from "lucide-react";
import { Link } from "react-router";
import { ProductImage } from "./ProductImage";
import { Rating } from "./Rating";

export type ProductLike = Doc<"products"> & { discountPercent?: number };

export function ProductCard({
  product,
  index = 0,
  compact = false,
}: {
  product: ProductLike;
  index?: number;
  compact?: boolean;
}) {
  const { addToCart, toggleWishlist, isWishlisted } = useShop();
  const discount =
    product.discountPercent ??
    Math.max(0, Math.round(((product.mrp - product.price) / product.mrp) * 100));
  const wishlisted = isWishlisted(product._id);
  const outOfStock = product.stock <= 0;

  return (
    <motion.article
      initial={{ opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.4, delay: Math.min(index * 0.04, 0.24) }}
      data-testid={`product-card-${product.slug}`}
      data-product-id={product._id}
      className="group relative flex flex-col overflow-hidden rounded-2xl border border-border/80 bg-card transition-all duration-300 hover:-translate-y-1 hover:border-border hover:soft-card"
    >
      <div className="relative aspect-4/5 overflow-hidden bg-secondary">
        <Link
          to={`/product/${product.slug}`}
          data-testid={`product-link-${product.slug}`}
          aria-label={`View ${product.name}`}
          className="block h-full w-full"
        >
          <ProductImage
            src={product.image}
            alt={product.name}
            accent={product.accent}
            className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.05]"
          />
        </Link>

        <div className="pointer-events-none absolute left-3 top-3 flex flex-col items-start gap-1.5">
          {discount > 0 && (
            <span className="rounded-full bg-primary px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-primary-foreground">
              {discount}% off
            </span>
          )}
          {product.isNew && !outOfStock && (
            <span className="rounded-full bg-background/95 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-foreground">
              New
            </span>
          )}
          {outOfStock && (
            <span className="rounded-full bg-foreground px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-background">
              Sold out
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={() => void toggleWishlist(product)}
          aria-label={wishlisted ? `Remove ${product.name} from wishlist` : `Save ${product.name} to wishlist`}
          aria-pressed={wishlisted}
          data-testid={`wishlist-toggle-${product.slug}`}
          className={cn(
            "absolute right-3 top-3 grid size-9 place-items-center rounded-full border border-border/70 bg-background/90 text-foreground backdrop-blur transition-colors hover:bg-background",
            wishlisted && "border-rose-200 bg-rose-50 text-rose-600",
          )}
        >
          <Heart className={cn("size-4", wishlisted && "fill-rose-500 text-rose-500")} aria-hidden="true" />
        </button>
      </div>

      <div className={cn("flex flex-1 flex-col gap-1.5", compact ? "p-3.5" : "p-4")}>
        <p className="eyebrow">
          {product.brand} · {product.category}
        </p>
        <h3 className="line-clamp-2 text-[14.5px] font-semibold leading-snug">
          <Link
            to={`/product/${product.slug}`}
            className="transition-colors hover:text-primary"
            data-testid={`product-title-${product.slug}`}
          >
            {product.name}
          </Link>
        </h3>
        <Rating value={product.rating} count={product.reviewCount} />

        <div className="mt-auto flex items-baseline gap-2 pt-2">
          <span className="text-[17px] font-bold tracking-tight">{formatINR(product.price)}</span>
          {discount > 0 && (
            <span className="text-xs text-muted-foreground line-through">{formatINR(product.mrp)}</span>
          )}
        </div>

        <button
          type="button"
          onClick={() => void addToCart(product)}
          disabled={outOfStock}
          data-testid={`add-to-cart-${product.slug}`}
          aria-label={`Add ${product.name} to cart`}
          className="mt-2.5 inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-full border border-border bg-background text-xs font-semibold transition-colors hover:border-primary hover:bg-primary hover:text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Plus className="size-3.5" aria-hidden="true" />
          {outOfStock ? "Out of stock" : "Add to cart"}
        </button>

        {!outOfStock && product.stock <= 8 && (
          <p className="pt-0.5 text-[11px] font-medium text-amber-700">
            Only {product.stock} left in stock
          </p>
        )}
      </div>
    </motion.article>
  );
}
