import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useShop } from "@/context/ShopProvider";
import { useAuth } from "@/hooks/use-auth";
import { CATEGORIES } from "@/lib/shop";
import { cn } from "@/lib/utils";
import {
  ChevronDown,
  Heart,
  LayoutGrid,
  LogOut,
  Menu,
  Package,
  Search,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  UserRound,
} from "lucide-react";
import { useState } from "react";
import { Link, NavLink, useNavigate, useSearchParams } from "react-router";
import { toast } from "sonner";
import { CategoryIcon } from "./CategoryIcon";
import { Logo } from "./Logo";

const NAV_LINKS = [
  { to: "/", label: "Home", end: true },
  { to: "/shop", label: "Shop" },
  { to: "/deals", label: "Deals" },
  { to: "/orders", label: "My Orders" },
  { to: "/account", label: "My Account" },
  { to: "/contact", label: "Support" },
];

export function Navbar() {
  const { cartCount, wishlistCount } = useShop();
  const { user, isAuthenticated, signOut } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [query, setQuery] = useState(searchParams.get("q") ?? "");
  const [mobileOpen, setMobileOpen] = useState(false);

  function submitSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = query.trim();
    navigate(trimmed ? `/shop?q=${encodeURIComponent(trimmed)}` : "/shop");
  }

  async function handleSignOut() {
    await signOut();
    toast.success("Signed out", { description: "See you next time." });
    navigate("/");
  }

  return (
    <header className="sticky top-0 z-40 w-full">
      <div className="bg-[oklch(0.22_0.033_264)] text-white/75">
        <div className="page-shell flex h-8 items-center justify-between gap-3 text-[11px]">
          <p className="flex items-center gap-1.5">
            <ShieldCheck className="size-3.5 text-emerald-300" aria-hidden="true" />
            Demo storefront — synthetic data only, no real payments are processed.
          </p>
          <Link
            to="/about"
            className="hidden shrink-0 font-semibold text-white/90 underline-offset-4 hover:underline sm:block"
          >
            About this demo
          </Link>
        </div>
      </div>

      <div className="border-b border-border/80 bg-background/92 backdrop-blur-md supports-[backdrop-filter]:bg-background/80">
        <div className="page-shell flex h-16 items-center gap-3 sm:h-[72px] sm:gap-5">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="lg:hidden"
                aria-label="Open navigation menu"
                data-testid="mobile-menu-button"
              >
                <Menu className="size-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[310px] overflow-y-auto">
              <SheetHeader>
                <SheetTitle className="text-left">
                  <Logo />
                </SheetTitle>
                <SheetDescription className="sr-only">
                  CartNest navigation and categories
                </SheetDescription>
              </SheetHeader>
              <nav aria-label="Mobile navigation" className="mt-4 flex flex-col gap-1 px-4">
                {NAV_LINKS.map((link) => (
                  <SheetClose asChild key={link.to}>
                    <Link
                      to={link.to}
                      className="rounded-lg px-2 py-2.5 text-sm font-semibold hover:bg-secondary"
                    >
                      {link.label}
                    </Link>
                  </SheetClose>
                ))}
                {user?.role === "admin" && (
                  <SheetClose asChild>
                    <Link
                      to="/admin"
                      className="flex items-center gap-2 rounded-lg bg-primary/5 px-2 py-2.5 text-sm font-semibold text-primary"
                    >
                      <ShieldCheck className="size-4" aria-hidden="true" /> Staff workspace
                    </Link>
                  </SheetClose>
                )}
                <div className="my-3 border-t border-border" />
                <p className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                  Shop by category
                </p>
                {CATEGORIES.map((category) => (
                  <SheetClose asChild key={category.name}>
                    <Link
                      to={`/shop?category=${encodeURIComponent(category.name)}`}
                      className="flex items-center gap-2 rounded-lg px-2 py-2 text-sm text-muted-foreground hover:bg-secondary hover:text-foreground"
                    >
                      <CategoryIcon category={category.name} className="size-4" />
                      {category.name}
                    </Link>
                  </SheetClose>
                ))}
              </nav>
              <div className="mt-6 px-4">
                {isAuthenticated ? (
                  <Button variant="outline" className="w-full" onClick={() => void handleSignOut()}>
                    <LogOut className="size-4" /> Sign out
                  </Button>
                ) : (
                  <Button asChild className="w-full">
                    <Link to="/auth">Sign in / Create account</Link>
                  </Button>
                )}
              </div>
            </SheetContent>
          </Sheet>

          <Logo />

          <form
            role="search"
            onSubmit={submitSearch}
            data-testid="product-search-form"
            className="relative hidden flex-1 items-center rounded-full border border-border bg-card pl-4 transition-colors focus-within:border-primary/60 focus-within:ring-4 focus-within:ring-primary/10 md:flex"
          >
            <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <label htmlFor="product-search-input" className="sr-only">
              Search products
            </label>
            <input
              id="product-search-input"
              name="product_search"
              data-testid="product-search-input"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search for headphones, skincare, bags…"
              autoComplete="off"
              className="h-10 w-full bg-transparent px-3 text-sm outline-none placeholder:text-muted-foreground/80"
            />
            <Button
              type="submit"
              size="sm"
              data-testid="product-search-submit"
              aria-label="Search products"
              className="mr-1 h-8 rounded-full px-4"
            >
              Search
            </Button>
          </form>

          <div className="ml-auto flex items-center gap-1 sm:gap-1.5">
            <Link
              to="/account?tab=wishlist"
              data-testid="wishlist-link"
              aria-label={`Wishlist with ${wishlistCount} saved items`}
              className="relative grid size-10 place-items-center rounded-full text-foreground transition-colors hover:bg-secondary"
            >
              <Heart className="size-5" aria-hidden="true" />
              {wishlistCount > 0 && (
                <span className="absolute right-1 top-1 grid min-w-4 place-items-center rounded-full bg-rose-500 px-1 text-[10px] font-bold leading-4 text-white">
                  {wishlistCount}
                </span>
              )}
            </Link>

            <div className="mx-0.5 hidden h-6 w-px bg-border sm:block" aria-hidden="true" />

            {isAuthenticated ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    data-testid="account-menu-button"
                    className="hidden items-center gap-2 rounded-full border border-transparent px-2 py-1.5 text-left transition-colors hover:bg-secondary sm:flex"
                    aria-label="Open account menu"
                  >
                    <span className="grid size-8 place-items-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                      {(user?.name ?? "CN").slice(0, 2).toUpperCase()}
                    </span>
                    <span className="hidden max-w-24 flex-col leading-tight lg:flex">
                      <span className="truncate text-xs font-semibold">
                        {user?.name ?? "My account"}
                      </span>
                      <span className="text-[10px] text-muted-foreground">Track & manage</span>
                    </span>
                    <ChevronDown className="hidden size-3.5 text-muted-foreground lg:block" aria-hidden="true" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel className="text-xs text-muted-foreground">
                    {user?.email ?? "Demo customer"}
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link to="/account" className="cursor-pointer">
                      <UserRound className="size-4" /> My account
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/orders" className="cursor-pointer">
                      <Package className="size-4" /> My orders
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/account?tab=wishlist" className="cursor-pointer">
                      <Heart className="size-4" /> Wishlist
                    </Link>
                  </DropdownMenuItem>
                  {user?.role === "admin" && (
                    <DropdownMenuItem asChild>
                      <Link to="/admin" className="cursor-pointer">
                        <ShieldCheck className="size-4" /> Staff workspace
                      </Link>
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => void handleSignOut()} className="cursor-pointer">
                    <LogOut className="size-4" /> Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <div className="hidden items-center gap-2 sm:flex">
                <Button asChild variant="ghost" size="sm" data-testid="nav-signin">
                  <Link to="/auth">Sign in</Link>
                </Button>
                <Button asChild size="sm" data-testid="nav-register" className="rounded-full">
                  <Link to="/auth?mode=register">Create account</Link>
                </Button>
              </div>
            )}

            <Link
              to="/cart"
              data-testid="cart-link"
              aria-label={`Shopping cart with ${cartCount} item${cartCount === 1 ? "" : "s"}`}
              className="relative ml-0.5 flex items-center gap-2 rounded-full bg-primary px-3 py-2.5 text-primary-foreground transition-colors hover:bg-primary/90 sm:px-4"
            >
              <ShoppingBag className="size-[18px]" aria-hidden="true" />
              <span className="hidden text-xs font-semibold sm:block">Cart</span>
              <span
                data-testid="cart-count"
                className="grid min-w-5 place-items-center rounded-full bg-primary-foreground/20 px-1.5 text-[11px] font-bold leading-5"
              >
                {cartCount}
              </span>
            </Link>
          </div>
        </div>

        <div className="page-shell md:hidden">
          <form
            role="search"
            onSubmit={submitSearch}
            data-testid="product-search-form-mobile"
            className="mb-3 flex items-center rounded-full border border-border bg-card pl-3"
          >
            <Search className="size-4 text-muted-foreground" aria-hidden="true" />
            <label htmlFor="mobile-product-search" className="sr-only">
              Search products
            </label>
            <input
              id="mobile-product-search"
              name="product_search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search products, brands and more"
              autoComplete="off"
              className="h-10 w-full bg-transparent px-2.5 text-sm outline-none"
            />
            <Button type="submit" size="sm" className="mr-1 h-8 rounded-full px-3">
              Go
            </Button>
          </form>
        </div>

        <div className="hidden border-t border-border/70 lg:block">
          <div className="page-shell flex h-11 items-center gap-1">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  data-testid="categories-dropdown"
                  className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors hover:bg-secondary"
                >
                  <LayoutGrid className="size-3.5" aria-hidden="true" />
                  Categories
                  <ChevronDown className="size-3.5 text-muted-foreground" aria-hidden="true" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-64">
                <DropdownMenuItem asChild>
                  <Link to="/shop" className="cursor-pointer font-medium">
                    <Sparkles className="size-4" /> All products
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {CATEGORIES.map((category) => (
                  <DropdownMenuItem key={category.name} asChild>
                    <Link
                      to={`/shop?category=${encodeURIComponent(category.name)}`}
                      data-testid={`category-link-${category.name.toLowerCase().replace(/[^a-z]+/g, "-")}`}
                      className="cursor-pointer"
                    >
                      <CategoryIcon category={category.name} className="size-4" />
                      <span className="flex-1">{category.name}</span>
                    </Link>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <nav aria-label="Primary" className="flex items-center gap-0.5">
              {NAV_LINKS.map((link) => (
                <NavLink
                  key={link.to}
                  to={link.to}
                  end={link.end}
                  data-testid={`nav-link-${link.label.toLowerCase().replace(/\s+/g, "-")}`}
                  className={({ isActive }) =>
                    cn(
                      "rounded-full px-3 py-1.5 text-xs font-medium transition-colors hover:bg-secondary",
                      isActive ? "text-primary" : "text-muted-foreground hover:text-foreground",
                    )
                  }
                >
                  {link.label}
                </NavLink>
              ))}
            </nav>

            <div className="ml-auto flex items-center gap-2 text-[11px] text-muted-foreground">
              <ShieldCheck className="size-3.5" aria-hidden="true" />
              Privacy-agent test environment
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
