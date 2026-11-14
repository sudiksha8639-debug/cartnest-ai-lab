import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import { CartNestMark } from "@/components/shop/Logo";
import { ProductImage } from "@/components/shop/ProductImage";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/use-auth";
import { CATEGORIES, ORDER_STATUS_FLOW, formatDate, formatDateTime, formatINR, statusTone, type OrderStatus } from "@/lib/shop";
import { cn } from "@/lib/utils";
import { useMutation, useQuery } from "convex/react";
import {
  AlertTriangle,
  ArrowUpRight,
  Check,
  ChevronRight,
  IndianRupee,
  LifeBuoy,
  Loader2,
  LayoutDashboard,
  LogOut,
  MessageSquare,
  Package,
  Pencil,
  Plus,
  ShieldCheck,
  ShoppingBag,
  Star,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { toast } from "sonner";

const ADMIN_TABS = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "products", label: "Products", icon: Package },
  { id: "orders", label: "Orders", icon: ShoppingBag },
  { id: "customers", label: "Customers", icon: Users },
  { id: "reviews", label: "Reviews", icon: MessageSquare },
  { id: "support", label: "Support", icon: LifeBuoy },
] as const;

type AdminTab = (typeof ADMIN_TABS)[number]["id"];

type OverviewData = {
  productCount: number;
  orderCount: number;
  customerCount: number;
  pendingReviews: number;
  openTickets: number;
  revenue: number;
  lowStock: { _id: string; name: string; stock: number; brand: string }[];
  recentOrders: {
    _id: string;
    orderNumber: string;
    customerName: string;
    total: number;
    status: string;
    placedAt: number;
  }[];
};

type ProductForm = {
  name: string;
  brand: string;
  category: string;
  description: string;
  price: string;
  mrp: string;
  stock: string;
  image: string;
  featured: boolean;
  trending: boolean;
  bestSeller: boolean;
  isNew: boolean;
};

const emptyProductForm: ProductForm = {
  name: "",
  brand: "",
  category: "Electronics",
  description: "",
  price: "",
  mrp: "",
  stock: "",
  image: "",
  featured: false,
  trending: false,
  bestSeller: false,
  isNew: true,
};

function errorMessage(error: unknown) {
  return error instanceof Error
    ? error.message.replace(/^Uncaught Error:\s*/, "")
    : "Something went wrong. Please try again.";
}

export default function Admin() {
  const { user, signOut } = useAuth();
  const profile = useQuery(api.profiles.me, {});
  const navigate = useNavigate();
  const claimStaff = useMutation(api.profiles.claimDemoStaff);
  const [tab, setTab] = useState<AdminTab>("overview");
  const [claiming, setClaiming] = useState(false);

  const isAdmin = profile?.role === "admin";

  const overview = useQuery(api.admin.overview, isAdmin ? {} : "skip");
  const products = useQuery(
    api.admin.listProducts,
    isAdmin && tab === "products" ? {} : "skip",
  );
  const orders = useQuery(api.admin.listOrders, isAdmin && tab === "orders" ? {} : "skip");
  const customers = useQuery(
    api.admin.listCustomers,
    isAdmin && tab === "customers" ? {} : "skip",
  );
  const reviews = useQuery(api.admin.listReviews, isAdmin && tab === "reviews" ? {} : "skip");
  const tickets = useQuery(api.admin.listSupport, isAdmin && tab === "support" ? {} : "skip");

  const createProduct = useMutation(api.admin.createProduct);
  const updateProduct = useMutation(api.admin.updateProduct);
  const deleteProduct = useMutation(api.admin.deleteProduct);
  const updateOrderStatus = useMutation(api.admin.updateOrderStatus);
  const setReviewStatus = useMutation(api.admin.setReviewStatus);
  const deleteReview = useMutation(api.admin.deleteReview);
  const updateSupportStatus = useMutation(api.admin.updateSupportStatus);

  const [productDialogOpen, setProductDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Doc<"products"> | null>(null);
  const [productForm, setProductForm] = useState<ProductForm>(emptyProductForm);
  const [savingProduct, setSavingProduct] = useState(false);
  const [productError, setProductError] = useState<string | null>(null);

  async function handleSignOut() {
    await signOut();
    navigate("/");
  }

  async function enableStaff() {
    setClaiming(true);
    try {
      await claimStaff({});
      toast.success("Staff workspace unlocked", {
        description: "This demo session now has administrator access.",
      });
    } catch (error) {
      toast.error("Could not enable staff access", { description: errorMessage(error) });
    } finally {
      setClaiming(false);
    }
  }

  function openCreateProduct() {
    setEditingProduct(null);
    setProductForm(emptyProductForm);
    setProductError(null);
    setProductDialogOpen(true);
  }

  function openEditProduct(product: Doc<"products">) {
    setEditingProduct(product);
    setProductForm({
      name: product.name,
      brand: product.brand,
      category: product.category,
      description: product.description,
      price: String(product.price),
      mrp: String(product.mrp),
      stock: String(product.stock),
      image: product.image,
      featured: product.featured,
      trending: product.trending,
      bestSeller: product.bestSeller,
      isNew: product.isNew,
    });
    setProductError(null);
    setProductDialogOpen(true);
  }

  async function handleProductSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setProductError(null);
    setSavingProduct(true);
    const payload = {
      name: productForm.name,
      brand: productForm.brand,
      category: productForm.category,
      description: productForm.description,
      price: Number(productForm.price),
      mrp: Number(productForm.mrp),
      stock: Number(productForm.stock),
      image: productForm.image,
      featured: productForm.featured,
      trending: productForm.trending,
      bestSeller: productForm.bestSeller,
      isNew: productForm.isNew,
    };
    try {
      if (editingProduct) {
        await updateProduct({ productId: editingProduct._id, ...payload });
        toast.success("Product updated", { description: payload.name });
      } else {
        const result = await createProduct(payload);
        toast.success("Product created", { description: `${payload.name} is now in the catalogue.` });
        if (result?.slug) {
          setTab("products");
        }
      }
      setProductDialogOpen(false);
    } catch (error) {
      setProductError(errorMessage(error));
    } finally {
      setSavingProduct(false);
    }
  }

  async function handleDeleteProduct(product: Doc<"products">) {
    if (!window.confirm(`Remove ${product.name} from the catalogue? This cannot be undone.`)) {
      return;
    }
    try {
      await deleteProduct({ productId: product._id });
      toast.success("Product removed", { description: product.name });
    } catch (error) {
      toast.error("Could not remove product", { description: errorMessage(error) });
    }
  }

  async function handleStatusChange(orderId: Doc<"orders">["_id"], status: OrderStatus) {
    try {
      await updateOrderStatus({ orderId, status });
      toast.success("Order status updated", { description: `Moved to ${status}.` });
    } catch (error) {
      toast.error("Could not update order", { description: errorMessage(error) });
    }
  }

  async function handleReviewStatus(
    reviewId: Doc<"reviews">["_id"],
    status: "approved" | "rejected",
  ) {
    try {
      await setReviewStatus({ reviewId, status });
      toast.success(status === "approved" ? "Review published" : "Review hidden");
    } catch (error) {
      toast.error("Could not update review", { description: errorMessage(error) });
    }
  }

  async function handleDeleteReview(reviewId: Doc<"reviews">["_id"]) {
    if (!window.confirm("Permanently delete this review and its photo?")) return;
    try {
      await deleteReview({ reviewId });
      toast.success("Review deleted");
    } catch (error) {
      toast.error("Could not delete review", { description: errorMessage(error) });
    }
  }

  async function handleSupportStatus(
    ticketId: Doc<"supportRequests">["_id"],
    status: "open" | "resolved",
  ) {
    try {
      await updateSupportStatus({ ticketId, status });
      toast.success(status === "resolved" ? "Request resolved" : "Request reopened");
    } catch (error) {
      toast.error("Could not update request", { description: errorMessage(error) });
    }
  }

  if (profile === undefined || profile === null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="size-6 animate-spin text-muted-foreground" aria-hidden="true" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[oklch(0.978_0.005_265)] p-6">
        <div className="w-full max-w-md rounded-3xl border border-border/80 bg-card p-7 text-center">
          <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-primary/10 text-primary">
            <ShieldCheck className="size-6" aria-hidden="true" />
          </span>
          <h1 className="mt-4 text-xl font-bold tracking-tight">Staff workspace</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            This area is restricted to store administrators. Signed-in customers can continue
            shopping and manage their own account as usual.
          </p>

          {profile.isAnonymous ? (
            <>
              <p className="mt-4 rounded-xl bg-secondary px-3.5 py-3 text-[11.5px] leading-5 text-muted-foreground">
                You are signed in with a demo session. Demo staff access can be enabled for this
                session so every management feature can be tested.
              </p>
              <Button
                className="mt-4 w-full rounded-full"
                onClick={() => void enableStaff()}
                disabled={claiming}
                data-testid="enable-staff"
              >
                {claiming ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />}
                Enable demo staff access
              </Button>
            </>
          ) : (
            <>
              <p className="mt-4 rounded-xl bg-secondary px-3.5 py-3 text-[11.5px] leading-5 text-muted-foreground">
                You are signed in as a registered customer. Sign out and use the staff demo on the
                sign-in page to explore the management tools.
              </p>
              <Button
                className="mt-4 w-full rounded-full"
                onClick={() => {
                  void signOut().then(() => navigate("/auth"));
                }}
                variant="outline"
              >
                <LogOut className="size-4" /> Switch to the staff demo
              </Button>
            </>
          )}

          <Link
            to="/"
            className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-foreground"
          >
            Return to the storefront
          </Link>
        </div>
      </div>
    );
  }

  const activeTab = ADMIN_TABS.find((item) => item.id === tab) ?? ADMIN_TABS[0];

  return (
    <div className="min-h-screen bg-[oklch(0.978_0.005_265)]">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex h-16 max-w-[1400px] items-center justify-between gap-4 px-5 sm:px-8">
          <Link to="/admin" className="flex items-center gap-2.5" aria-label="CartNest staff workspace">
            <CartNestMark className="size-9" />
            <span className="flex flex-col leading-none">
              <span className="text-[15px] font-extrabold tracking-[-0.02em]">CartNest</span>
              <span className="mt-1 text-[9px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Staff workspace
              </span>
            </span>
          </Link>

          <div className="flex items-center gap-2">
            <Link
              to="/"
              className="hidden items-center gap-1 rounded-full border border-border px-3 py-1.5 text-[11px] font-semibold transition-colors hover:border-primary/40 hover:text-primary sm:inline-flex"
            >
              View storefront <ArrowUpRight className="size-3" aria-hidden="true" />
            </Link>
            <span className="hidden max-w-36 truncate rounded-full bg-secondary px-3 py-1.5 text-[11px] font-semibold md:inline">
              {profile.name ?? user?.name ?? "Store staff"}
            </span>
            <Button variant="ghost" size="sm" className="rounded-full" onClick={() => void handleSignOut()}>
              <LogOut className="size-4" /> <span className="hidden sm:inline">Sign out</span>
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1400px] gap-7 px-5 py-7 sm:px-8 lg:grid-cols-[218px_1fr]">
        <aside>
          <nav
            aria-label="Administration sections"
            className="flex gap-1.5 overflow-x-auto rounded-2xl border border-border/80 bg-card p-2 no-scrollbar lg:sticky lg:top-6 lg:flex-col"
          >
            {ADMIN_TABS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                aria-current={tab === item.id ? "page" : undefined}
                data-testid={`admin-tab-${item.id}`}
                className={cn(
                  "flex shrink-0 items-center gap-2 rounded-xl px-3 py-2.5 text-left text-xs font-semibold transition-colors",
                  tab === item.id
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                )}
              >
                <item.icon className="size-4" aria-hidden="true" />
                {item.label}
                {item.id === "reviews" && (overview?.pendingReviews ?? 0) > 0 && (
                  <span className="ml-auto rounded-full bg-amber-400 px-1.5 text-[10px] font-bold text-amber-950">
                    {overview?.pendingReviews}
                  </span>
                )}
                {item.id === "support" && (overview?.openTickets ?? 0) > 0 && (
                  <span className="ml-auto rounded-full bg-amber-400 px-1.5 text-[10px] font-bold text-amber-950">
                    {overview?.openTickets}
                  </span>
                )}
              </button>
            ))}
          </nav>
        </aside>

        <main>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="eyebrow">Store administration</p>
              <h1 className="mt-1.5 text-[26px] font-bold tracking-tight sm:text-[30px]">
                {activeTab.label}
              </h1>
            </div>
            {tab === "products" && (
              <Button size="sm" className="rounded-full" onClick={openCreateProduct} data-testid="admin-add-product">
                <Plus className="size-4" /> Add product
              </Button>
            )}
          </div>

          {tab === "overview" && (
            <OverviewPanel data={overview} onOpenTab={setTab} />
          )}

          {tab === "products" && (
            <div className="mt-5 overflow-hidden rounded-2xl border border-border/80 bg-card">
              {products === undefined ? (
                <TableLoader />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[820px] border-collapse text-left text-xs">
                    <thead>
                      <tr className="border-b border-border bg-secondary/40 text-[10px] uppercase tracking-wider text-muted-foreground">
                        <th className="px-4 py-3 font-semibold">Product</th>
                        <th className="px-4 py-3 font-semibold">Category</th>
                        <th className="px-4 py-3 font-semibold">Price</th>
                        <th className="px-4 py-3 font-semibold">Stock</th>
                        <th className="px-4 py-3 font-semibold">Merchandising</th>
                        <th className="px-4 py-3 text-right font-semibold">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {products.map((product) => (
                        <tr key={product._id} className="align-middle" data-testid={`admin-product-${product.slug}`}>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <div className="size-10 shrink-0 overflow-hidden rounded-lg bg-secondary">
                                <ProductImage
                                  src={product.image}
                                  alt={product.name}
                                  accent={product.accent}
                                  className="h-full w-full object-cover"
                                />
                              </div>
                              <div className="min-w-0">
                                <p className="max-w-56 truncate font-semibold">{product.name}</p>
                                <p className="text-[10.5px] text-muted-foreground">{product.brand}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">{product.category}</td>
                          <td className="px-4 py-3">
                            <p className="font-semibold">{formatINR(product.price)}</p>
                            <p className="text-[10px] text-muted-foreground line-through">
                              {formatINR(product.mrp)}
                            </p>
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={cn(
                                "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold",
                                product.stock === 0
                                  ? "bg-destructive/10 text-destructive"
                                  : product.stock <= 8
                                    ? "bg-amber-50 text-amber-700"
                                    : "bg-secondary text-foreground",
                              )}
                            >
                              {product.stock === 0 ? "Out of stock" : `${product.stock} units`}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex flex-wrap gap-1">
                              {product.featured && <Flag>Featured</Flag>}
                              {product.trending && <Flag>Trending</Flag>}
                              {product.bestSeller && <Flag>Best seller</Flag>}
                              {product.isNew && <Flag>New</Flag>}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-end gap-1">
                              <Button size="icon-sm" variant="ghost" aria-label={`Edit ${product.name}`} onClick={() => openEditProduct(product)}>
                                <Pencil className="size-3.5" />
                              </Button>
                              <Button
                                size="icon-sm"
                                variant="ghost"
                                aria-label={`Remove ${product.name}`}
                                className="text-muted-foreground hover:text-destructive"
                                onClick={() => void handleDeleteProduct(product)}
                              >
                                <Trash2 className="size-3.5" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {tab === "orders" && (
            <div className="mt-5 overflow-hidden rounded-2xl border border-border/80 bg-card">
              {orders === undefined ? (
                <TableLoader />
              ) : orders.length === 0 ? (
                <AdminEmpty title="No orders yet" copy="Orders will appear here as soon as customers check out." />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[860px] border-collapse text-left text-xs">
                    <thead>
                      <tr className="border-b border-border bg-secondary/40 text-[10px] uppercase tracking-wider text-muted-foreground">
                        <th className="px-4 py-3 font-semibold">Order</th>
                        <th className="px-4 py-3 font-semibold">Customer</th>
                        <th className="px-4 py-3 font-semibold">Delivery</th>
                        <th className="px-4 py-3 font-semibold">Total</th>
                        <th className="px-4 py-3 font-semibold">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {orders.map((order) => (
                        <tr key={order._id} data-testid={`admin-order-${order.orderNumber}`}>
                          <td className="px-4 py-3">
                            <p className="font-mono font-semibold">{order.orderNumber}</p>
                            <p className="mt-0.5 text-[10px] text-muted-foreground">
                              {formatDate(order.placedAt)} ·{" "}
                              {order.items.reduce((sum, item) => sum + item.quantity, 0)} items
                            </p>
                          </td>
                          <td className="px-4 py-3">
                            <p className="font-semibold">{order.customerName}</p>
                            <p className="text-[10px] text-muted-foreground">{order.customerEmail}</p>
                            <p className="text-[10px] text-muted-foreground">{order.customerPhone}</p>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">
                            <p className="font-medium text-foreground">
                              {order.address.city}, {order.address.state}
                            </p>
                            <p className="text-[10px]">{order.address.postalCode}</p>
                            <p className="text-[10px] capitalize">{order.deliveryMethod} delivery</p>
                          </td>
                          <td className="px-4 py-3 font-semibold">{formatINR(order.total)}</td>
                          <td className="px-4 py-3">
                            <Select
                              value={order.status}
                              onValueChange={(value) =>
                                void handleStatusChange(order._id, value as OrderStatus)
                              }
                            >
                              <SelectTrigger
                                className={cn("h-8 w-[150px] text-[11px] font-semibold", statusTone(order.status))}
                                aria-label={`Status for order ${order.orderNumber}`}
                              >
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {ORDER_STATUS_FLOW.map((status) => (
                                  <SelectItem key={status} value={status}>
                                    {status}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {tab === "customers" && (
            <div className="mt-5 overflow-hidden rounded-2xl border border-border/80 bg-card">
              {customers === undefined ? (
                <TableLoader />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[760px] border-collapse text-left text-xs">
                    <thead>
                      <tr className="border-b border-border bg-secondary/40 text-[10px] uppercase tracking-wider text-muted-foreground">
                        <th className="px-4 py-3 font-semibold">Customer</th>
                        <th className="px-4 py-3 font-semibold">Contact</th>
                        <th className="px-4 py-3 font-semibold">Orders</th>
                        <th className="px-4 py-3 font-semibold">Lifetime value</th>
                        <th className="px-4 py-3 font-semibold">Access</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {customers.map((customer) => (
                        <tr key={customer._id}>
                          <td className="px-4 py-3">
                            <p className="font-semibold">{customer.name}</p>
                            <p className="text-[10px] text-muted-foreground">
                              Joined {formatDate(customer.joinedAt)}
                            </p>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">
                            <p>{customer.email ?? "No email on file"}</p>
                            <p className="text-[10px]">{customer.phone ?? "No phone on file"}</p>
                          </td>
                          <td className="px-4 py-3">{customer.orderCount}</td>
                          <td className="px-4 py-3 font-semibold">{formatINR(customer.totalSpend)}</td>
                          <td className="px-4 py-3">
                            <span
                              className={cn(
                                "rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize",
                                customer.role === "admin"
                                  ? "bg-primary/10 text-primary"
                                  : "bg-secondary text-muted-foreground",
                              )}
                            >
                              {customer.role}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {tab === "reviews" && (
            <div className="mt-5 space-y-3">
              {reviews === undefined ? (
                <div className="rounded-2xl border border-border/80 bg-card">
                  <TableLoader />
                </div>
              ) : reviews.length === 0 ? (
                <div className="rounded-2xl border border-border/80 bg-card">
                  <AdminEmpty
                    title="No customer reviews yet"
                    copy="Reviews submitted from product pages will appear here for moderation."
                  />
                </div>
              ) : (
                reviews.map((review) => (
                  <article
                    key={review._id}
                    data-testid={`admin-review-${review._id}`}
                    className="rounded-2xl border border-border/80 bg-card p-4 sm:p-5"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold">{review.title}</p>
                        <p className="mt-0.5 text-[11px] text-muted-foreground">
                          {review.authorName} ·{" "}
                          {review.product ? (
                            <Link to={`/product/${review.product.slug}`} className="hover:text-primary">
                              {review.product.name}
                            </Link>
                          ) : (
                            "Product removed"
                          )}{" "}
                          · {formatDateTime(review.createdAt)}
                        </p>
                      </div>
                      <span
                        className={cn(
                          "rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide",
                          review.status === "approved"
                            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                            : review.status === "pending"
                              ? "border-amber-200 bg-amber-50 text-amber-700"
                              : "border-border bg-secondary text-muted-foreground",
                        )}
                      >
                        {review.status}
                      </span>
                    </div>
                    <div className="mt-2 flex items-center gap-1">
                      {[1, 2, 3, 4, 5].map((value) => (
                        <Star
                          key={value}
                          className={cn(
                            "size-3.5",
                            value <= review.rating
                              ? "fill-amber-400 text-amber-400"
                              : "fill-transparent text-muted-foreground/30",
                          )}
                          aria-hidden="true"
                        />
                      ))}
                      <span className="ml-1 text-[11px] font-semibold">{review.rating}.0</span>
                    </div>
                    <p className="mt-2 text-[12.5px] leading-6 text-muted-foreground">{review.body}</p>
                    {review.photoUrl && (
                      <div className="mt-3 w-28 overflow-hidden rounded-lg border border-border bg-secondary">
                        <img
                          src={review.photoUrl}
                          alt={`Photo from ${review.authorName}`}
                          className="aspect-square w-full object-cover"
                        />
                      </div>
                    )}
                    <div className="mt-3 flex flex-wrap gap-2 border-t border-border pt-3">
                      {review.status !== "approved" && (
                        <Button
                          size="sm"
                          className="h-8 rounded-full text-[11px]"
                          onClick={() => void handleReviewStatus(review._id, "approved")}
                        >
                          <Check className="size-3.5" /> Approve
                        </Button>
                      )}
                      {review.status !== "rejected" && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 rounded-full text-[11px]"
                          onClick={() => void handleReviewStatus(review._id, "rejected")}
                        >
                          <X className="size-3.5" /> Hide
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 rounded-full text-[11px] text-muted-foreground hover:text-destructive"
                        onClick={() => void handleDeleteReview(review._id)}
                      >
                        <Trash2 className="size-3.5" /> Delete
                      </Button>
                    </div>
                  </article>
                ))
              )}
            </div>
          )}

          {tab === "support" && (
            <div className="mt-5 space-y-3">
              {tickets === undefined ? (
                <div className="rounded-2xl border border-border/80 bg-card">
                  <TableLoader />
                </div>
              ) : tickets.length === 0 ? (
                <div className="rounded-2xl border border-border/80 bg-card">
                  <AdminEmpty
                    title="No support requests"
                    copy="Messages submitted through the contact form will appear here."
                  />
                </div>
              ) : (
                tickets.map((ticket) => (
                  <article
                    key={ticket._id}
                    data-testid={`admin-ticket-${ticket._id}`}
                    className="rounded-2xl border border-border/80 bg-card p-4 sm:p-5"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold">{ticket.topic}</p>
                        <p className="mt-0.5 text-[11px] text-muted-foreground">
                          {ticket.name} · {formatDateTime(ticket.createdAt)}
                          {ticket.orderNumber ? ` · ${ticket.orderNumber}` : ""}
                        </p>
                      </div>
                      <span
                        className={cn(
                          "rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide",
                          ticket.status === "open"
                            ? "border-amber-200 bg-amber-50 text-amber-700"
                            : "border-emerald-200 bg-emerald-50 text-emerald-700",
                        )}
                      >
                        {ticket.status}
                      </span>
                    </div>
                    <p className="mt-2 text-[12.5px] leading-6 text-muted-foreground">{ticket.message}</p>
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
                      <p className="text-[10.5px] text-muted-foreground">
                        {ticket.email} · {ticket.phone}
                      </p>
                      <Button
                        size="sm"
                        variant={ticket.status === "open" ? "default" : "outline"}
                        className="h-8 rounded-full text-[11px]"
                        onClick={() =>
                          void handleSupportStatus(
                            ticket._id,
                            ticket.status === "open" ? "resolved" : "open",
                          )
                        }
                      >
                        {ticket.status === "open" ? "Mark resolved" : "Reopen"}
                      </Button>
                    </div>
                  </article>
                ))
              )}
            </div>
          )}
        </main>
      </div>

      <Dialog open={productDialogOpen} onOpenChange={setProductDialogOpen}>
        <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingProduct ? "Edit product" : "Add a product"}</DialogTitle>
            <DialogDescription>
              Changes appear in the storefront catalogue immediately.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleProductSubmit} className="grid gap-4 sm:grid-cols-2" data-testid="admin-product-form">
            <div className="sm:col-span-2">
              <Label htmlFor="admin_product_name" className="text-xs font-semibold">Product name</Label>
              <Input
                id="admin_product_name"
                name="product_name"
                className="mt-1.5"
                value={productForm.name}
                onChange={(event) => setProductForm((current) => ({ ...current, name: event.target.value }))}
                placeholder="Aurora Wireless Headphones"
                required
              />
            </div>
            <div>
              <Label htmlFor="admin_product_brand" className="text-xs font-semibold">Brand</Label>
              <Input
                id="admin_product_brand"
                name="brand"
                className="mt-1.5"
                value={productForm.brand}
                onChange={(event) => setProductForm((current) => ({ ...current, brand: event.target.value }))}
                required
              />
            </div>
            <div>
              <Label htmlFor="admin_product_category" className="text-xs font-semibold">Category</Label>
              <Select
                value={productForm.category}
                onValueChange={(value) => setProductForm((current) => ({ ...current, category: value }))}
              >
                <SelectTrigger id="admin_product_category" className="mt-1.5" data-testid="admin-product-category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((category) => (
                    <SelectItem key={category.name} value={category.name}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="admin_product_price" className="text-xs font-semibold">Selling price (₹)</Label>
              <Input
                id="admin_product_price"
                name="price"
                type="number"
                min={1}
                className="mt-1.5"
                value={productForm.price}
                onChange={(event) => setProductForm((current) => ({ ...current, price: event.target.value }))}
                required
              />
            </div>
            <div>
              <Label htmlFor="admin_product_mrp" className="text-xs font-semibold">List price (₹)</Label>
              <Input
                id="admin_product_mrp"
                name="mrp"
                type="number"
                min={1}
                className="mt-1.5"
                value={productForm.mrp}
                onChange={(event) => setProductForm((current) => ({ ...current, mrp: event.target.value }))}
                required
              />
            </div>
            <div>
              <Label htmlFor="admin_product_stock" className="text-xs font-semibold">Stock units</Label>
              <Input
                id="admin_product_stock"
                name="stock"
                type="number"
                min={0}
                className="mt-1.5"
                value={productForm.stock}
                onChange={(event) => setProductForm((current) => ({ ...current, stock: event.target.value }))}
                required
              />
            </div>
            <div>
              <Label htmlFor="admin_product_image" className="text-xs font-semibold">Image URL</Label>
              <Input
                id="admin_product_image"
                name="image"
                className="mt-1.5"
                value={productForm.image}
                onChange={(event) => setProductForm((current) => ({ ...current, image: event.target.value }))}
                placeholder="https://images.unsplash.com/..."
                required
              />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="admin_product_description" className="text-xs font-semibold">Description</Label>
              <Textarea
                id="admin_product_description"
                name="description"
                className="mt-1.5 min-h-24"
                value={productForm.description}
                onChange={(event) => setProductForm((current) => ({ ...current, description: event.target.value }))}
                required
              />
            </div>
            <fieldset className="sm:col-span-2">
              <legend className="text-xs font-semibold">Merchandising</legend>
              <div className="mt-2 flex flex-wrap gap-4">
                {([
                  ["featured", "Featured"],
                  ["trending", "Trending"],
                  ["bestSeller", "Best seller"],
                  ["isNew", "New arrival"],
                ] as const).map(([key, label]) => (
                  <label key={key} className="flex items-center gap-2 text-xs">
                    <input
                      type="checkbox"
                      name={key}
                      checked={productForm[key]}
                      onChange={(event) =>
                        setProductForm((current) => ({ ...current, [key]: event.target.checked }))
                      }
                      className="accent-[var(--primary)]"
                    />
                    {label}
                  </label>
                ))}
              </div>
            </fieldset>

            {productError && (
              <p role="alert" className="rounded-lg bg-destructive/5 px-3 py-2 text-xs font-medium text-destructive sm:col-span-2">
                {productError}
              </p>
            )}

            <DialogFooter className="sm:col-span-2">
              <Button type="button" variant="ghost" onClick={() => setProductDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={savingProduct}>
                {savingProduct && <Loader2 className="size-4 animate-spin" />}
                {editingProduct ? "Save changes" : "Create product"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function OverviewPanel({
  data,
  onOpenTab,
}: {
  data: OverviewData | undefined;
  onOpenTab: (tab: AdminTab) => void;
}) {
  if (data === undefined) {
    return (
      <div className="mt-5 rounded-2xl border border-border/80 bg-card">
        <TableLoader />
      </div>
    );
  }

  const stats = [
    { label: "Gross revenue", value: formatINR(data.revenue), icon: IndianRupee },
    { label: "Orders", value: data.orderCount, icon: ShoppingBag },
    { label: "Products", value: data.productCount, icon: Package },
    { label: "Accounts", value: data.customerCount, icon: Users },
  ];

  return (
    <div className="mt-5 space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.label} className="rounded-2xl border border-border/80 bg-card p-4">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {stat.label}
              </p>
              <stat.icon className="size-4 text-primary" aria-hidden="true" />
            </div>
            <p className="mt-2 text-xl font-bold tracking-tight">{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => onOpenTab("reviews")}
          className="flex items-center justify-between gap-3 rounded-2xl border border-border/80 bg-card p-4 text-left transition-colors hover:border-primary/40"
        >
          <div className="flex items-center gap-3">
            <span className="grid size-9 place-items-center rounded-xl bg-amber-50 text-amber-700">
              <MessageSquare className="size-4" aria-hidden="true" />
            </span>
            <div>
              <p className="text-xs font-semibold">Reviews awaiting moderation</p>
              <p className="text-[11px] text-muted-foreground">
                {data.pendingReviews === 0 ? "Everything is reviewed" : "Publish or hide customer content"}
              </p>
            </div>
          </div>
          <span className="text-lg font-bold">{data.pendingReviews}</span>
        </button>

        <button
          type="button"
          onClick={() => onOpenTab("support")}
          className="flex items-center justify-between gap-3 rounded-2xl border border-border/80 bg-card p-4 text-left transition-colors hover:border-primary/40"
        >
          <div className="flex items-center gap-3">
            <span className="grid size-9 place-items-center rounded-xl bg-sky-50 text-sky-700">
              <LifeBuoy className="size-4" aria-hidden="true" />
            </span>
            <div>
              <p className="text-xs font-semibold">Open support requests</p>
              <p className="text-[11px] text-muted-foreground">Respond and resolve customer issues</p>
            </div>
          </div>
          <span className="text-lg font-bold">{data.openTickets}</span>
        </button>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        <div className="overflow-hidden rounded-2xl border border-border/80 bg-card">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <h2 className="text-xs font-bold">Recent orders</h2>
            <button
              type="button"
              onClick={() => onOpenTab("orders")}
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline"
            >
              Manage orders <ChevronRight className="size-3" aria-hidden="true" />
            </button>
          </div>
          {data.recentOrders.length === 0 ? (
            <p className="px-4 py-8 text-center text-xs text-muted-foreground">No orders yet.</p>
          ) : (
            <ul className="divide-y divide-border">
              {data.recentOrders.map((order) => (
                <li key={order._id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                  <div>
                    <p className="font-mono text-[11px] font-semibold">{order.orderNumber}</p>
                    <p className="text-[10.5px] text-muted-foreground">
                      {order.customerName} · {formatDate(order.placedAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-semibold">{formatINR(order.total)}</span>
                    <span
                      className={cn(
                        "rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide",
                        statusTone(order.status),
                      )}
                    >
                      {order.status}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-2xl border border-border/80 bg-card">
          <div className="flex items-center gap-2 border-b border-border px-4 py-3">
            <AlertTriangle className="size-3.5 text-amber-600" aria-hidden="true" />
            <h2 className="text-xs font-bold">Low stock</h2>
          </div>
          {data.lowStock.length === 0 ? (
            <p className="px-4 py-8 text-center text-xs text-muted-foreground">
              All products are comfortably stocked.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {data.lowStock.map((product) => (
                <li key={product._id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <p className="min-w-0 truncate text-[11.5px] font-medium">{product.name}</p>
                  <span
                    className={cn(
                      "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold",
                      product.stock === 0
                        ? "bg-destructive/10 text-destructive"
                        : "bg-amber-50 text-amber-700",
                    )}
                  >
                    {product.stock} left
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function TableLoader() {
  return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="size-5 animate-spin text-muted-foreground" aria-hidden="true" />
      <span className="ml-2 text-xs text-muted-foreground">Loading…</span>
    </div>
  );
}

function AdminEmpty({ title, copy }: { title: string; copy: string }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      <span className="mb-3 grid size-11 place-items-center rounded-xl bg-secondary text-muted-foreground">
        <Package className="size-5" aria-hidden="true" />
      </span>
      <p className="text-sm font-bold">{title}</p>
      <p className="mt-1 max-w-sm text-xs leading-5 text-muted-foreground">{copy}</p>
    </div>
  );
}

function Flag({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full bg-secondary px-2 py-0.5 text-[9.5px] font-medium text-muted-foreground">
      {children}
    </span>
  );
}
