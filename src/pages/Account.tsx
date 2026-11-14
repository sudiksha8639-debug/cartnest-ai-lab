import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import { EmptyState } from "@/components/shop/EmptyState";
import { ProductCard } from "@/components/shop/ProductCard";
import { Rating } from "@/components/shop/Rating";
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
import { messageOf, useShop } from "@/context/ShopProvider";
import { useAuth } from "@/hooks/use-auth";
import { DEMO_ACCOUNT, formatDate, formatINR, statusTone } from "@/lib/shop";
import { cn } from "@/lib/utils";
import { useMutation, useQuery } from "convex/react";
import {
  Check,
  Heart,
  LayoutDashboard,
  Loader2,
  LogOut,
  MapPin,
  MessageSquare,
  Package,
  Pencil,
  Plus,
  Settings,
  ShieldCheck,
  Star,
  Trash2,
  UserRound,
} from "lucide-react";
import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { toast } from "sonner";

const TABS = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "profile", label: "Personal info", icon: UserRound },
  { id: "addresses", label: "Saved addresses", icon: MapPin },
  { id: "wishlist", label: "Wishlist", icon: Heart },
  { id: "reviews", label: "My reviews", icon: MessageSquare },
  { id: "settings", label: "Account settings", icon: Settings },
] as const;

type TabId = (typeof TABS)[number]["id"];

const emptyAddress = {
  fullName: "",
  phone: "",
  house: "",
  street: "",
  city: "",
  state: "",
  postalCode: "",
  country: "India",
  addressType: "Home" as "Home" | "Office",
};

export default function Account() {
  const { user, signOut } = useAuth();
  const { guestKey, wishlist } = useShop();
  const profile = useQuery(api.profiles.me, {});
  const summary = useQuery(api.orders.summary, { guestKey });
  const orders = useQuery(api.orders.listMine, { guestKey });
  const addresses = useQuery(api.addresses.list, { guestKey });
  const myReviews = useQuery(api.reviews.listMine, {});
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = (searchParams.get("tab") ?? "overview") as TabId;
  const tab = TABS.some((item) => item.id === tabParam) ? tabParam : "overview";

  const updateProfile = useMutation(api.profiles.updateProfile);
  const saveAddress = useMutation(api.addresses.save);
  const removeAddress = useMutation(api.addresses.remove);
  const setDefaultAddress = useMutation(api.addresses.setDefault);
  const deleteReview = useMutation(api.reviews.deleteMine);

  const [savingProfile, setSavingProfile] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAddress, setEditingAddress] = useState<Doc<"addresses"> | null>(null);
  const [addressForm, setAddressForm] = useState(emptyAddress);
  const [savingAddress, setSavingAddress] = useState(false);

  const displayName = profile?.name ?? user?.name ?? "Demo customer";
  const displayEmail = profile?.email ?? user?.email ?? DEMO_ACCOUNT.email;
  const displayPhone = profile?.phone ?? user?.phone ?? DEMO_ACCOUNT.phone;
  const initials = displayName
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  function changeTab(next: TabId) {
    const params = new URLSearchParams(searchParams);
    if (next === "overview") params.delete("tab");
    else params.set("tab", next);
    setSearchParams(params, { replace: true });
  }

  async function handleProfileSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setSavingProfile(true);
    try {
      await updateProfile({
        name: String(data.get("name") ?? ""),
        phone: String(data.get("phone") ?? ""),
      });
      toast.success("Profile updated", { description: "Your demo details were saved." });
    } catch (error) {
      toast.error("Could not save profile", { description: messageOf(error) });
    } finally {
      setSavingProfile(false);
    }
  }

  function openNewAddress() {
    setEditingAddress(null);
    setAddressForm({
      ...emptyAddress,
      fullName: displayName,
      phone: displayPhone,
    });
    setDialogOpen(true);
  }

  function openEditAddress(address: Doc<"addresses">) {
    setEditingAddress(address);
    setAddressForm({
      fullName: address.fullName,
      phone: address.phone,
      house: address.house,
      street: address.street,
      city: address.city,
      state: address.state,
      postalCode: address.postalCode,
      country: address.country,
      addressType: address.addressType,
    });
    setDialogOpen(true);
  }

  async function handleAddressSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingAddress(true);
    try {
      await saveAddress({
        guestKey,
        address: addressForm,
        isDefault: editingAddress?.isDefault ?? (addresses?.length ?? 0) === 0,
        addressId: editingAddress?._id,
      });
      toast.success(editingAddress ? "Address updated" : "Address saved", {
        description: "Synthetic address stored in the demo database.",
      });
      setDialogOpen(false);
    } catch (error) {
      toast.error("Could not save address", { description: messageOf(error) });
    } finally {
      setSavingAddress(false);
    }
  }

  async function handleRemoveAddress(addressId: Doc<"addresses">["_id"]) {
    try {
      await removeAddress({ guestKey, addressId });
      toast.success("Address removed");
    } catch (error) {
      toast.error("Could not remove address", { description: messageOf(error) });
    }
  }

  async function handleDefaultAddress(addressId: Doc<"addresses">["_id"]) {
    try {
      await setDefaultAddress({ guestKey, addressId });
      toast.success("Default address updated");
    } catch (error) {
      toast.error("Could not update address", { description: messageOf(error) });
    }
  }

  async function handleDeleteReview(reviewId: Doc<"reviews">["_id"]) {
    try {
      await deleteReview({ reviewId });
      toast.success("Review deleted", { description: "It has been removed from your account." });
    } catch (error) {
      toast.error("Could not delete review", { description: messageOf(error) });
    }
  }

  async function handleSignOut() {
    await signOut();
    toast.success("Signed out");
    navigate("/");
  }

  return (
    <div className="page-shell py-8 sm:py-10">
      <div className="flex flex-col gap-4 rounded-3xl border border-border/80 bg-card p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div className="flex items-center gap-4">
          <span className="grid size-14 place-items-center rounded-2xl bg-primary/10 text-lg font-bold text-primary">
            {initials}
          </span>            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                Customer dashboard
              </p>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight" data-testid="account-name">
                  {displayName}
                </h1>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-700">
                <ShieldCheck className="size-3" aria-hidden="true" /> Demo account
              </span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground" data-testid="account-email">
              {displayEmail}
            </p>
            <p className="text-xs text-muted-foreground" data-testid="account-phone">
              {displayPhone}
            </p>
          </div>
        </div>
        <Button variant="outline" className="rounded-full self-start" onClick={() => void handleSignOut()}>
          <LogOut className="size-4" /> Sign out
        </Button>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[220px_1fr]">
        <aside>
          <nav
            aria-label="Account sections"
            className="flex gap-1.5 overflow-x-auto rounded-2xl border border-border/80 bg-card p-2 no-scrollbar lg:flex-col"
          >
            {TABS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => changeTab(item.id)}
                aria-current={tab === item.id ? "page" : undefined}
                data-testid={`account-tab-${item.id}`}
                className={cn(
                  "flex shrink-0 items-center gap-2 rounded-xl px-3 py-2.5 text-left text-xs font-semibold transition-colors",
                  tab === item.id
                    ? "bg-primary/8 text-primary"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                )}
              >
                <item.icon className="size-4" aria-hidden="true" />
                {item.label}
                {item.id === "wishlist" && wishlist.length > 0 && (
                  <span className="ml-auto rounded-full bg-secondary px-1.5 text-[10px]">
                    {wishlist.length}
                  </span>
                )}
              </button>
            ))}
            <Link
              to="/orders"
              className="flex shrink-0 items-center gap-2 rounded-xl px-3 py-2.5 text-xs font-semibold text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              <Package className="size-4" aria-hidden="true" /> My orders
            </Link>
          </nav>
        </aside>

        <div className="min-w-0">
          {tab === "overview" && (
            <div className="space-y-5">
              <div className="grid gap-3 sm:grid-cols-3">
                {[
                  { label: "Demo orders", value: summary?.orderCount ?? 0, icon: Package },
                  { label: "Delivered", value: summary?.deliveredCount ?? 0, icon: Check },
                  {
                    label: "Total spend",
                    value: formatINR(summary?.totalSpend ?? 0),
                    icon: Star,
                  },
                ].map((stat) => (
                  <div key={stat.label} className="rounded-2xl border border-border/80 bg-card p-4">
                    <div className="flex items-center justify-between">
                      <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                        {stat.label}
                      </p>
                      <stat.icon className="size-4 text-primary" aria-hidden="true" />
                    </div>
                    <p className="mt-2 text-xl font-bold">{stat.value}</p>
                  </div>
                ))}
              </div>

              <div className="rounded-2xl border border-border/80 bg-card p-5">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-bold">Profile snapshot</h2>
                  <Button variant="ghost" size="sm" onClick={() => changeTab("profile")}>
                    Edit <Pencil className="size-3.5" />
                  </Button>
                </div>
                <dl className="mt-3 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl bg-secondary/60 px-3.5 py-3">
                    <dt className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      Full name
                    </dt>
                    <dd className="mt-1 text-sm font-medium">{displayName}</dd>
                  </div>
                  <div className="rounded-xl bg-secondary/60 px-3.5 py-3">
                    <dt className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      Email address
                    </dt>
                    <dd className="mt-1 break-all text-sm font-medium" data-testid="profile-email">
                      {displayEmail}
                    </dd>
                  </div>
                  <div className="rounded-xl bg-secondary/60 px-3.5 py-3">
                    <dt className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      Phone number
                    </dt>
                    <dd className="mt-1 text-sm font-medium" data-testid="profile-phone">
                      {displayPhone}
                    </dd>
                  </div>
                  <div className="rounded-xl bg-secondary/60 px-3.5 py-3">
                    <dt className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      Default address
                    </dt>
                    <dd className="mt-1 text-sm font-medium" data-testid="profile-default-address">
                      {addresses && addresses.length > 0
                        ? `${addresses[0].city}, ${addresses[0].state} ${addresses[0].postalCode}`
                        : "No saved address yet"}
                    </dd>
                  </div>
                </dl>
                <p className="mt-3 text-[11px] leading-5 text-muted-foreground">
                  This page deliberately displays synthetic personal information so an external
                  privacy agent can detect it. CartNest itself performs no PII detection.
                </p>
              </div>

              <div className="rounded-2xl border border-border/80 bg-card">
                <div className="flex items-center justify-between border-b border-border px-5 py-4">
                  <h2 className="text-sm font-bold">Recent orders</h2>
                  <Link to="/orders" className="text-[11px] font-semibold text-primary hover:underline">
                    View all
                  </Link>
                </div>
                {orders === undefined ? (
                  <div className="flex items-center justify-center py-10">
                    <Loader2 className="size-5 animate-spin text-muted-foreground" aria-hidden="true" />
                  </div>
                ) : orders.length === 0 ? (
                  <p className="px-5 py-8 text-center text-xs text-muted-foreground">
                    No demo orders yet.{" "}
                    <Link to="/shop" className="font-semibold text-primary hover:underline">
                      Start shopping
                    </Link>
                  </p>
                ) : (
                  <ul className="divide-y divide-border">
                    {orders.slice(0, 3).map((order) => (
                      <li key={order._id}>
                        <Link
                          to={`/orders/${order.orderNumber}`}
                          className="flex flex-wrap items-center justify-between gap-2 px-5 py-3.5 transition-colors hover:bg-secondary/40"
                        >
                          <div>
                            <p className="font-mono text-xs font-semibold">{order.orderNumber}</p>
                            <p className="mt-0.5 text-[11px] text-muted-foreground">
                              {formatDate(order.placedAt)} · {order.itemCount} items ·{" "}
                              {formatINR(order.total)}
                            </p>
                          </div>
                          <span
                            className={cn(
                              "rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide",
                              statusTone(order.status),
                            )}
                          >
                            {order.status}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}

          {tab === "profile" && (
            <div className="rounded-2xl border border-border/80 bg-card p-5 sm:p-6">
              <h2 className="text-lg font-bold tracking-tight">Personal information</h2>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                Keep your demo profile realistic — synthetic name, email and Indian mobile number.
              </p>
              <form
                key={profile?._id ?? "profile-loading"}
                onSubmit={handleProfileSave}
                className="mt-5 grid gap-4 sm:grid-cols-2"
              >
                <div className="sm:col-span-2">
                  <Label htmlFor="profile_name" className="text-xs font-semibold">
                    Full name
                  </Label>
                  <Input
                    id="profile_name"
                    name="name"
                    data-testid="profile-name-input"
                    className="mt-1.5"
                    defaultValue={profile?.name ?? ""}
                    placeholder="Ananya Deshpande"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="profile_email" className="text-xs font-semibold">
                    Email address
                  </Label>
                  <Input
                    id="profile_email"
                    name="customer_email"
                    data-testid="profile-email-input"
                    className="mt-1.5 bg-secondary/60"
                    value={displayEmail}
                    readOnly
                    disabled
                  />
                  <p className="mt-1 text-[10.5px] text-muted-foreground">
                    Managed by secure sign-in — not editable here.
                  </p>
                </div>
                <div>
                  <Label htmlFor="profile_phone" className="text-xs font-semibold">
                    Phone number
                  </Label>
                  <Input
                    id="profile_phone"
                    name="phone"
                    type="tel"
                    data-testid="profile-phone-input"
                    className="mt-1.5"
                    defaultValue={profile?.phone ?? ""}
                    placeholder="+91 98200 45512"
                    required
                  />
                </div>
                <div className="sm:col-span-2">
                  <Button type="submit" disabled={savingProfile} data-testid="save-profile">
                    {savingProfile && <Loader2 className="size-4 animate-spin" />}
                    Save changes
                  </Button>
                </div>
              </form>

              <div className="mt-6 rounded-xl border border-border bg-secondary/40 p-4 text-[11.5px] leading-5 text-muted-foreground">
                <p className="font-semibold text-foreground">Sign-in security</p>
                <p className="mt-1">
                  CartNest uses one-time email codes. No password is ever stored in plain text, and
                  this demo never asks for banking credentials or OTPs from your bank.
                </p>
              </div>
            </div>
          )}

          {tab === "addresses" && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold tracking-tight">Saved addresses</h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Synthetic home and office addresses used during demo checkout.
                  </p>
                </div>
                <Button size="sm" className="rounded-full" onClick={openNewAddress} data-testid="add-address">
                  <Plus className="size-4" /> Add address
                </Button>
              </div>

              {addresses === undefined ? (
                <div className="flex items-center justify-center rounded-2xl border border-border/80 bg-card py-16">
                  <Loader2 className="size-5 animate-spin text-muted-foreground" aria-hidden="true" />
                </div>
              ) : addresses.length === 0 ? (
                <EmptyState
                  icon={<MapPin className="size-6" aria-hidden="true" />}
                  title="No saved addresses"
                  description="Add a synthetic delivery address so it can be reused at checkout."
                  action={
                    <Button className="rounded-full" onClick={openNewAddress}>
                      Add your first address
                    </Button>
                  }
                />
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {addresses.map((address) => (
                    <article
                      key={address._id}
                      data-testid={`address-card-${address._id}`}
                      className="rounded-2xl border border-border/80 bg-card p-4"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="rounded-full bg-secondary px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide">
                          {address.addressType}
                        </span>
                        <div className="flex items-center gap-1">
                          {address.isDefault ? (
                            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold uppercase text-emerald-700">
                              Default
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => void handleDefaultAddress(address._id)}
                              className="rounded-full px-2 py-0.5 text-[10px] font-semibold text-primary hover:bg-accent"
                            >
                              Set default
                            </button>
                          )}
                        </div>
                      </div>
                      <p className="mt-3 text-sm font-semibold">{address.fullName}</p>
                      <address className="mt-1 space-y-0.5 text-xs not-italic leading-5 text-muted-foreground">
                        <p>{address.house}</p>
                        <p>{address.street}</p>
                        <p>
                          {address.city}, {address.state} — {address.postalCode}
                        </p>
                        <p>{address.country}</p>
                        <p>{address.phone}</p>
                      </address>
                      <div className="mt-3 flex gap-2 border-t border-border pt-3">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 rounded-full text-[11px]"
                          onClick={() => openEditAddress(address)}
                        >
                          <Pencil className="size-3" /> Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 rounded-full text-[11px] text-muted-foreground hover:text-destructive"
                          onClick={() => void handleRemoveAddress(address._id)}
                        >
                          <Trash2 className="size-3" /> Remove
                        </Button>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </div>
          )}

          {tab === "wishlist" && (
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-bold tracking-tight">Wishlist</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Saved items persist in the CartNest database for this shopping session.
                </p>
              </div>
              {wishlist.length === 0 ? (
                <EmptyState
                  icon={<Heart className="size-6" aria-hidden="true" />}
                  title="Your wishlist is empty"
                  description="Tap the heart on any product to keep it here for later."
                  action={
                    <Button asChild className="rounded-full">
                      <Link to="/shop">Find something to love</Link>
                    </Button>
                  }
                />
              ) : (
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                  {wishlist.map((item, index) => (
                    <ProductCard key={item.productId} product={item.product} index={index} compact />
                  ))}
                </div>
              )}
            </div>
          )}

          {tab === "reviews" && (
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-bold tracking-tight">My reviews</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Reviews and photos you have submitted. New reviews are published after moderation.
                </p>
              </div>

              {myReviews === undefined ? (
                <div className="flex items-center justify-center rounded-2xl border border-border/80 bg-card py-16">
                  <Loader2 className="size-5 animate-spin text-muted-foreground" aria-hidden="true" />
                </div>
              ) : myReviews.length === 0 ? (
                <EmptyState
                  icon={<MessageSquare className="size-6" aria-hidden="true" />}
                  title="You have not written a review yet"
                  description="Purchase a product, then share your experience and a photo from its product page."
                  action={
                    <Button asChild className="rounded-full">
                      <Link to="/shop">Browse products</Link>
                    </Button>
                  }
                />
              ) : (
                <div className="space-y-3">
                  {myReviews.map((review) => (
                    <article
                      key={review._id}
                      data-testid={`my-review-${review._id}`}
                      className="rounded-2xl border border-border/80 bg-card p-4 sm:p-5"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          {review.product && (
                            <Link
                              to={`/product/${review.product.slug}`}
                              className="size-12 shrink-0 overflow-hidden rounded-xl bg-secondary"
                              aria-label={`View ${review.product.name}`}
                            >
                              <img
                                src={review.product.image}
                                alt={review.product.name}
                                className="h-full w-full object-cover"
                              />
                            </Link>
                          )}
                          <div>
                            {review.product ? (
                              <Link
                                to={`/product/${review.product.slug}`}
                                className="text-sm font-semibold hover:text-primary"
                              >
                                {review.product.name}
                              </Link>
                            ) : (
                              <p className="text-sm font-semibold">Product removed</p>
                            )}
                            <div className="mt-1 flex flex-wrap items-center gap-2">
                              <Rating value={review.rating} />
                              <span className="text-[11px] text-muted-foreground">
                                {formatDate(review.createdAt)}
                              </span>
                            </div>
                          </div>
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
                          {review.status === "approved"
                            ? "Published"
                            : review.status === "pending"
                              ? "Awaiting moderation"
                              : "Not published"}
                        </span>
                      </div>

                      <h3 className="mt-3 text-sm font-bold">{review.title}</h3>
                      <p className="mt-1 text-[13px] leading-6 text-muted-foreground">{review.body}</p>
                      {review.photoUrl && (
                        <div className="mt-3 w-28 overflow-hidden rounded-lg border border-border bg-secondary">
                          <img
                            src={review.photoUrl}
                            alt={`Photo attached to your review of ${review.product?.name ?? "a product"}`}
                            className="aspect-square w-full object-cover"
                          />
                        </div>
                      )}

                      <div className="mt-3 border-t border-border pt-3">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 rounded-full text-[11px] text-muted-foreground hover:text-destructive"
                          onClick={() => void handleDeleteReview(review._id)}
                          data-testid="delete-review"
                        >
                          <Trash2 className="size-3" /> Delete review
                        </Button>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </div>
          )}

          {tab === "settings" && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-border/80 bg-card p-5">
                <h2 className="text-lg font-bold tracking-tight">Account settings</h2>
                <dl className="mt-4 divide-y divide-border text-xs">
                  <div className="flex items-center justify-between gap-4 py-3">
                    <dt className="text-muted-foreground">Sign-in method</dt>
                    <dd className="font-medium">Email one-time code (no password)</dd>
                  </div>
                  <div className="flex items-center justify-between gap-4 py-3">
                    <dt className="text-muted-foreground">Account email</dt>
                    <dd className="font-medium" data-testid="settings-email">
                      {displayEmail}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-4 py-3">
                    <dt className="text-muted-foreground">Demo profile</dt>
                    <dd className="font-medium">Synthetic data only</dd>
                  </div>
                  <div className="flex items-center justify-between gap-4 py-3">
                    <dt className="text-muted-foreground">Payment methods saved</dt>
                    <dd className="font-medium">None — demo payments only</dd>
                  </div>
                </dl>
              </div>

              <div className="rounded-2xl border border-border/80 bg-card p-5">
                <h3 className="text-sm font-bold">Local demo data</h3>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  Clear recently viewed products and any applied coupon stored in this browser.
                  Your account, cart and orders stay in the demo database.
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    className="rounded-full"
                    onClick={() => {
                      try {
                        window.localStorage.removeItem("cartnest:recently-viewed");
                        window.sessionStorage.removeItem("cartnest:coupon");
                      } catch {
                        /* ignore */
                      }
                      toast.success("Local browsing data cleared");
                    }}
                  >
                    Clear local data
                  </Button>
                  <Button variant="destructive" className="rounded-full" onClick={() => void handleSignOut()}>
                    <LogOut className="size-4" /> Sign out
                  </Button>
                </div>
              </div>

              <div className="rounded-2xl border border-border/80 bg-[oklch(0.972_0.012_275)] p-5 text-[11.5px] leading-5 text-muted-foreground">
                <p className="inline-flex items-center gap-1.5 font-semibold text-foreground">
                  <ShieldCheck className="size-3.5 text-emerald-600" aria-hidden="true" /> Demo
                  environment notice
                </p>
                <p className="mt-1.5">
                  This storefront exists to test a separate privacy-first browser agent. All
                  customer data is fictional; do not enter real personal or financial information.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingAddress ? "Edit address" : "Add a demo address"}</DialogTitle>
            <DialogDescription>
              Stored in the CartNest demo database. Use clearly fictional information.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAddressSave} className="grid gap-3.5 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label htmlFor="address_full_name" className="text-xs font-semibold">
                Full name
              </Label>
              <Input
                id="address_full_name"
                name="delivery_full_name"
                className="mt-1.5"
                value={addressForm.fullName}
                onChange={(event) =>
                  setAddressForm((current) => ({ ...current, fullName: event.target.value }))
                }
                required
              />
            </div>
            <div>
              <Label htmlFor="address_phone" className="text-xs font-semibold">
                Phone
              </Label>
              <Input
                id="address_phone"
                name="delivery_phone"
                type="tel"
                className="mt-1.5"
                value={addressForm.phone}
                onChange={(event) =>
                  setAddressForm((current) => ({ ...current, phone: event.target.value }))
                }
                required
              />
            </div>
            <div>
              <Label htmlFor="address_type" className="text-xs font-semibold">
                Address type
              </Label>
              <select
                id="address_type"
                name="address_type"
                value={addressForm.addressType}
                onChange={(event) =>
                  setAddressForm((current) => ({
                    ...current,
                    addressType: event.target.value as "Home" | "Office",
                  }))
                }
                className="mt-1.5 h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
              >
                <option value="Home">Home</option>
                <option value="Office">Office</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="address_house" className="text-xs font-semibold">
                House / building number
              </Label>
              <Input
                id="address_house"
                name="house_number"
                className="mt-1.5"
                value={addressForm.house}
                onChange={(event) =>
                  setAddressForm((current) => ({ ...current, house: event.target.value }))
                }
                required
              />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="address_street" className="text-xs font-semibold">
                Street / area
              </Label>
              <Input
                id="address_street"
                name="street_address"
                className="mt-1.5"
                value={addressForm.street}
                onChange={(event) =>
                  setAddressForm((current) => ({ ...current, street: event.target.value }))
                }
                required
              />
            </div>
            <div>
              <Label htmlFor="address_city" className="text-xs font-semibold">
                City
              </Label>
              <Input
                id="address_city"
                name="city"
                className="mt-1.5"
                value={addressForm.city}
                onChange={(event) =>
                  setAddressForm((current) => ({ ...current, city: event.target.value }))
                }
                required
              />
            </div>
            <div>
              <Label htmlFor="address_state" className="text-xs font-semibold">
                State
              </Label>
              <Input
                id="address_state"
                name="state"
                className="mt-1.5"
                value={addressForm.state}
                onChange={(event) =>
                  setAddressForm((current) => ({ ...current, state: event.target.value }))
                }
                required
              />
            </div>
            <div>
              <Label htmlFor="address_postal" className="text-xs font-semibold">
                PIN code
              </Label>
              <Input
                id="address_postal"
                name="postal_code"
                inputMode="numeric"
                className="mt-1.5"
                value={addressForm.postalCode}
                onChange={(event) =>
                  setAddressForm((current) => ({
                    ...current,
                    postalCode: event.target.value.replace(/\D/g, "").slice(0, 6),
                  }))
                }
                required
              />
            </div>
            <div>
              <Label htmlFor="address_country" className="text-xs font-semibold">
                Country
              </Label>
              <Input
                id="address_country"
                name="country"
                className="mt-1.5"
                value={addressForm.country}
                onChange={(event) =>
                  setAddressForm((current) => ({ ...current, country: event.target.value }))
                }
                required
              />
            </div>
            <DialogFooter className="mt-2 sm:col-span-2">
              <Button type="button" variant="ghost" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={savingAddress}>
                {savingAddress && <Loader2 className="size-4 animate-spin" />}
                {editingAddress ? "Save address" : "Add address"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
