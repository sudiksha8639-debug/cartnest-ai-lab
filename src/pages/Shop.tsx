import { api } from "@/convex/_generated/api";
import { EmptyState } from "@/components/shop/EmptyState";
import { ProductCard } from "@/components/shop/ProductCard";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CATEGORIES, SORT_OPTIONS, pluralize } from "@/lib/shop";
import { cn } from "@/lib/utils";
import { useQuery } from "convex/react";
import { ChevronRight, Loader2, SearchX, SlidersHorizontal, Star, X } from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router";

type SortValue = (typeof SORT_OPTIONS)[number]["value"];

const RATING_OPTIONS = [4.5, 4, 3.5];

export default function Shop() {
  const [searchParams, setSearchParams] = useSearchParams();
  const query = searchParams.get("q") ?? "";
  const category = searchParams.get("category") ?? "";
  const sortParam = searchParams.get("sort") ?? "relevance";
  const sort: SortValue = SORT_OPTIONS.some((option) => option.value === sortParam)
    ? (sortParam as SortValue)
    : "relevance";
  const minPrice = Number(searchParams.get("min") ?? "") || undefined;
  const maxPrice = Number(searchParams.get("max") ?? "") || undefined;
  const minRating = Number(searchParams.get("rating") ?? "") || undefined;

  const products = useQuery(api.products.list, {
    search: query || undefined,
    category: category || undefined,
    sort,
    minPrice,
    maxPrice,
    minRating,
  });

  const [priceDraft, setPriceDraft] = useState({
    min: searchParams.get("min") ?? "",
    max: searchParams.get("max") ?? "",
  });

  const heading = query
    ? `Results for “${query}”`
    : category
      ? category
      : "All products";

  const activeFilterCount = [category, minPrice, maxPrice, minRating].filter(Boolean).length;

  function updateParam(key: string, value: string | null) {
    const next = new URLSearchParams(searchParams);
    if (!value) next.delete(key);
    else next.set(key, value);
    setSearchParams(next, { replace: true });
  }

  function applyPrice(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next = new URLSearchParams(searchParams);
    const min = priceDraft.min.trim();
    const max = priceDraft.max.trim();
    if (min) next.set("min", min);
    else next.delete("min");
    if (max) next.set("max", max);
    else next.delete("max");
    setSearchParams(next, { replace: true });
  }

  function clearFilters() {
    const next = new URLSearchParams();
    if (query) next.set("q", query);
    setPriceDraft({ min: "", max: "" });
    setSearchParams(next, { replace: true });
  }

  const filterPanel = (
    <div className="space-y-7">
      <div>
        <h3 className="text-xs font-bold uppercase tracking-[0.16em] text-foreground">
          Category
        </h3>
        <div className="mt-3 space-y-1">
          <FilterButton active={!category} onClick={() => updateParam("category", null)}>
            All categories
          </FilterButton>
          {CATEGORIES.map((item) => (
            <FilterButton
              key={item.name}
              active={category === item.name}
              onClick={() => updateParam("category", item.name)}
            >
              {item.name}
            </FilterButton>
          ))}
        </div>
      </div>

      <div className="border-t border-border pt-6">
        <h3 className="text-xs font-bold uppercase tracking-[0.16em] text-foreground">Price</h3>
        <form onSubmit={applyPrice} className="mt-3 space-y-2">
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <Label htmlFor="filter-min-price" className="text-[11px] text-muted-foreground">
                Min (₹)
              </Label>
              <Input
                id="filter-min-price"
                name="min_price"
                inputMode="numeric"
                value={priceDraft.min}
                onChange={(event) => setPriceDraft((d) => ({ ...d, min: event.target.value }))}
                placeholder="0"
                className="mt-1 h-9"
              />
            </div>
            <span className="mt-5 text-muted-foreground">–</span>
            <div className="flex-1">
              <Label htmlFor="filter-max-price" className="text-[11px] text-muted-foreground">
                Max (₹)
              </Label>
              <Input
                id="filter-max-price"
                name="max_price"
                inputMode="numeric"
                value={priceDraft.max}
                onChange={(event) => setPriceDraft((d) => ({ ...d, max: event.target.value }))}
                placeholder="100000"
                className="mt-1 h-9"
              />
            </div>
          </div>
          <Button type="submit" variant="outline" size="sm" className="w-full" data-testid="apply-price-filter">
            Apply price
          </Button>
        </form>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {[
            { label: "Under ₹1,000", min: "", max: "1000" },
            { label: "₹1,000–₹5,000", min: "1000", max: "5000" },
            { label: "₹5,000+", min: "5000", max: "" },
          ].map((band) => (
            <button
              key={band.label}
              type="button"
              onClick={() => {
                setPriceDraft({ min: band.min, max: band.max });
                const next = new URLSearchParams(searchParams);
                if (band.min) next.set("min", band.min);
                else next.delete("min");
                if (band.max) next.set("max", band.max);
                else next.delete("max");
                setSearchParams(next, { replace: true });
              }}
              className="rounded-full border border-border px-2.5 py-1 text-[11px] text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
            >
              {band.label}
            </button>
          ))}
        </div>
      </div>

      <div className="border-t border-border pt-6">
        <h3 className="text-xs font-bold uppercase tracking-[0.16em] text-foreground">
          Customer rating
        </h3>
        <div className="mt-3 space-y-1">
          {RATING_OPTIONS.map((rating) => (
            <FilterButton
              key={rating}
              active={minRating === rating}
              onClick={() => updateParam("rating", minRating === rating ? null : String(rating))}
            >
              <span className="flex items-center gap-1.5">
                <Star className="size-3.5 fill-amber-400 text-amber-400" aria-hidden="true" />
                {rating} & above
              </span>
            </FilterButton>
          ))}
        </div>
      </div>

      {activeFilterCount > 0 && (
        <Button variant="ghost" size="sm" className="w-full" onClick={clearFilters}>
          <X className="size-3.5" /> Clear all filters
        </Button>
      )}
    </div>
  );

  const chips = useMemo(
    () =>
      [
        category && { key: "category", label: category },
        minPrice && { key: "min", label: `Min ₹${minPrice}` },
        maxPrice && { key: "max", label: `Max ₹${maxPrice}` },
        minRating && { key: "rating", label: `${minRating}★ & above` },
      ].filter(Boolean) as { key: string; label: string }[],
    [category, minPrice, maxPrice, minRating],
  );

  return (
    <div className="page-shell py-8 sm:py-10">
      <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-xs text-muted-foreground">
        <Link to="/" className="hover:text-foreground">
          Home
        </Link>
        <ChevronRight className="size-3" aria-hidden="true" />
        <Link to="/shop" className="hover:text-foreground">
          Shop
        </Link>
        {category && (
          <>
            <ChevronRight className="size-3" aria-hidden="true" />
            <span className="font-medium text-foreground">{category}</span>
          </>
        )}
      </nav>

      <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[30px] font-bold tracking-tight sm:text-[36px]" data-testid="shop-heading">
            {heading}
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground" data-testid="results-count">
            {products === undefined
              ? "Loading the catalogue…"
              : `${pluralize(products.length, "product")} found${query ? " for your search" : ""}`}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="rounded-full lg:hidden" data-testid="open-filters">
                <SlidersHorizontal className="size-4" /> Filters
                {activeFilterCount > 0 && (
                  <span className="ml-1 rounded-full bg-primary px-1.5 text-[10px] text-primary-foreground">
                    {activeFilterCount}
                  </span>
                )}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Filter products</DialogTitle>
                <DialogDescription>Narrow the catalogue by category, price and rating.</DialogDescription>
              </DialogHeader>
              {filterPanel}
              <Button variant="ghost" onClick={clearFilters}>
                Clear all filters
              </Button>
            </DialogContent>
          </Dialog>

          <div className="flex items-center gap-2">
            <Label htmlFor="sort-products" className="hidden text-xs text-muted-foreground sm:block">
              Sort by
            </Label>
            <Select value={sort} onValueChange={(value) => updateParam("sort", value)}>
              <SelectTrigger
                id="sort-products"
                className="h-9 w-[190px] rounded-full bg-card text-xs"
                data-testid="sort-products"
                aria-label="Sort products"
              >
                <SelectValue placeholder="Sort" />
              </SelectTrigger>
              <SelectContent align="end">
                {SORT_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-1.5">
        <CategoryChip
          active={!category}
          onClick={() => updateParam("category", null)}
          testId="chip-all"
        >
          All
        </CategoryChip>
        {CATEGORIES.map((item) => (
          <CategoryChip
            key={item.name}
            active={category === item.name}
            onClick={() => updateParam("category", item.name)}
            testId={`chip-${item.name.toLowerCase().replace(/[^a-z]+/g, "-")}`}
          >
            {item.name}
          </CategoryChip>
        ))}
      </div>

      {chips.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {chips.map((chip) => (
            <button
              key={chip.key}
              type="button"
              onClick={() => updateParam(chip.key, null)}
              className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-accent px-2.5 py-1 text-[11px] font-medium text-accent-foreground"
            >
              {chip.label}
              <X className="size-3" aria-hidden="true" />
              <span className="sr-only">Remove filter</span>
            </button>
          ))}
          <button
            type="button"
            onClick={clearFilters}
            className="text-[11px] font-semibold text-primary underline-offset-4 hover:underline"
          >
            Clear all
          </button>
        </div>
      )}

      <div className="mt-7 grid gap-8 lg:grid-cols-[230px_1fr]">
        <aside className="hidden lg:block">
          <div className="sticky top-36 rounded-2xl border border-border/80 bg-card p-5">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-sm font-bold">Filters</h2>
              <SlidersHorizontal className="size-4 text-muted-foreground" aria-hidden="true" />
            </div>
            {filterPanel}
          </div>
        </aside>

        <div>
          {products === undefined ? (
            <div className="flex items-center justify-center rounded-2xl border border-border/70 bg-card py-24">
              <Loader2 className="size-6 animate-spin text-muted-foreground" aria-hidden="true" />
              <span className="ml-3 text-sm text-muted-foreground">Loading products…</span>
            </div>
          ) : products.length === 0 ? (
            <EmptyState
              icon={<SearchX className="size-6" aria-hidden="true" />}
              title="No products matched"
              description="Try a broader search term or clear a filter. The catalogue has electronics, fashion, home, beauty and accessories."
              action={
                <div className="flex flex-wrap justify-center gap-2">
                  <Button onClick={clearFilters} variant="outline" className="rounded-full">
                    Clear filters
                  </Button>
                  <Button asChild className="rounded-full">
                    <Link to="/shop">Browse all products</Link>
                  </Button>
                </div>
              }
            />
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
              {products.map((product, index) => (
                <ProductCard key={product._id} product={product} index={index} compact />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function FilterButton({
  active,
  onClick,
  children,
}: {
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-[13px] transition-colors",
        active
          ? "bg-accent font-semibold text-accent-foreground"
          : "text-muted-foreground hover:bg-secondary hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function CategoryChip({
  active,
  onClick,
  children,
  testId,
}: {
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
  testId?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      data-testid={testId}
      className={cn(
        "rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}
