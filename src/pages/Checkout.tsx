import { api } from "@/convex/_generated/api";
import { EmptyState } from "@/components/shop/EmptyState";
import { ProductImage } from "@/components/shop/ProductImage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useShop } from "@/context/ShopProvider";
import { useAuth } from "@/hooks/use-auth";
import { readStoredCoupon, storeCoupon, totalsFor, type AppliedCoupon } from "@/lib/coupons";
import { formatINR } from "@/lib/shop";
import { cn } from "@/lib/utils";
import { useMutation, useQuery } from "convex/react";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  Banknote,
  Check,
  CreditCard,
  Loader2,
  MapPin,
  Package,
  ShieldCheck,
  Smartphone,
  Truck,
  UserRound,
  Zap,
} from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { toast } from "sonner";

const STEPS = [
  { id: 1, label: "Your details" },
  { id: 2, label: "Delivery address" },
  { id: 3, label: "Delivery options" },
  { id: 4, label: "Payment" },
  { id: 5, label: "Review order" },
] as const;

type PaymentMethod = "cod" | "upi" | "card";

const PAYMENT_OPTIONS: {
  value: PaymentMethod;
  title: string;
  copy: string;
  icon: typeof Banknote;
}[] = [
  {
    value: "cod",
    title: "Cash on Delivery",
    copy: "Pay the demo courier when the order arrives.",
    icon: Banknote,
  },
  {
    value: "upi",
    title: "UPI (demo)",
    copy: "Simulated UPI handle demo@cartnest — no real transfer.",
    icon: Smartphone,
  },
  {
    value: "card",
    title: "Card (demo)",
    copy: "Preview a saved demo card. No card fields are collected.",
    icon: CreditCard,
  },
];

export default function Checkout() {
  const { cart, guestKey } = useShop();
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const createOrder = useMutation(api.orders.create);
  const saveAddress = useMutation(api.addresses.save);
  const addresses = useQuery(api.addresses.list, { guestKey });
  const profile = useQuery(api.profiles.me, {});

  const [step, setStep] = useState(1);
  const [customer, setCustomer] = useState(() => ({
    name: user?.name ?? profile?.name ?? "",
    email: user?.email ?? profile?.email ?? "",
    phone: user?.phone ?? profile?.phone ?? "",
  }));
  const [address, setAddress] = useState({
    fullName: "",
    phone: "",
    house: "",
    street: "",
    city: "",
    state: "",
    postalCode: "",
    country: "India",
    addressType: "Home" as "Home" | "Office",
  });
  const [deliveryMethod, setDeliveryMethod] = useState<"standard" | "express">("standard");
  const [instructions, setInstructions] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cod");
  const [saveAddressForLater, setSaveAddressForLater] = useState(true);
  const [demoAcknowledged, setDemoAcknowledged] = useState(false);
  const [coupon] = useState<AppliedCoupon | null>(readStoredCoupon);
  const [error, setError] = useState<string | null>(null);
  const [placing, setPlacing] = useState(false);
  const [placedOrderNumber, setPlacedOrderNumber] = useState<string | null>(null);

  const subtotal = cart?.subtotal ?? 0;
  const totals = totalsFor(subtotal, deliveryMethod, coupon);

  function validateCustomer() {
    if (customer.name.trim().length < 3) return "Enter your full name (at least 3 characters).";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(customer.email.trim()))
      return "Enter a valid email address so the demo receipt can be shown.";
    if (!/^(\+91[\s-]?)?[6-9]\d{9}$/.test(customer.phone.replace(/[\s-]/g, "")))
      return "Enter a valid 10-digit Indian mobile number.";
    return null;
  }

  function validateAddress() {
    if (address.fullName.trim().length < 3) return "Enter the recipient's full name.";
    if (!/^(\+91[\s-]?)?[6-9]\d{9}$/.test(address.phone.replace(/[\s-]/g, "")))
      return "Enter the recipient's 10-digit mobile number.";
    if (address.house.trim().length < 2) return "Enter the house or building number.";
    if (address.street.trim().length < 3) return "Enter the street or area.";
    if (address.city.trim().length < 2) return "Enter the city.";
    if (address.state.trim().length < 2) return "Enter the state.";
    if (!/^\d{6}$/.test(address.postalCode.trim())) return "Enter a valid 6-digit PIN code.";
    return null;
  }

  function goNext() {
    setError(null);
    if (step === 1) {
      const issue = validateCustomer();
      if (issue) {
        setError(issue);
        return;
      }
      setAddress((current) => ({
        ...current,
        fullName: current.fullName || customer.name,
        phone: current.phone || customer.phone,
      }));
    }
    if (step === 2) {
      const issue = validateAddress();
      if (issue) {
        setError(issue);
        return;
      }
    }
    setStep((current) => Math.min(5, current + 1));
  }

  function goBack() {
    setError(null);
    setStep((current) => Math.max(1, current - 1));
  }

  function applySavedAddress(saved: NonNullable<typeof addresses>[number]) {
    setAddress({
      fullName: saved.fullName,
      phone: saved.phone,
      house: saved.house,
      street: saved.street,
      city: saved.city,
      state: saved.state,
      postalCode: saved.postalCode,
      country: saved.country,
      addressType: saved.addressType,
    });
    toast.success("Address filled from your saved addresses", {
      description: `${saved.addressType} · ${saved.city}, ${saved.state} ${saved.postalCode}`,
    });
  }

  function handleStepSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (step < 5) {
      goNext();
      return;
    }
    void placeOrder();
  }

  async function placeOrder() {
    setError(null);
    if (!demoAcknowledged) {
      setError("Please confirm you understand this is a demo order.");
      return;
    }
    const issue = validateCustomer() ?? validateAddress();
    if (issue) {
      setError(issue);
      return;
    }
    setPlacing(true);
    try {
      if (saveAddressForLater) {
        try {
          await saveAddress({ guestKey, address, isDefault: true });
        } catch (saveError) {
          console.warn("Address could not be saved", saveError);
        }
      }

      const result = await createOrder({
        guestKey,
        customerName: customer.name,
        customerEmail: customer.email,
        customerPhone: customer.phone,
        address,
        deliveryMethod,
        deliveryInstructions: instructions || undefined,
        paymentMethod,
        couponCode: coupon?.code,
      });

      storeCoupon(null);
      setPlacedOrderNumber(result.orderNumber);
      toast.success("Demo order placed", {
        description: `Order ${result.orderNumber} has been created. No payment was captured.`,
      });
      navigate(`/order/${result.orderNumber}?new=1`, { replace: true });
    } catch (orderError) {
      setError(
        orderError instanceof Error
          ? orderError.message.replace(/^Uncaught Error:\s*/, "")
          : "The demo order could not be placed. Please try again.",
      );
      setPlacing(false);
    }
  }

  if (cart === undefined) {
    return (
      <div className="page-shell flex min-h-[50vh] items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" aria-hidden="true" />
        <span className="ml-3 text-sm text-muted-foreground">Preparing checkout…</span>
      </div>
    );
  }

  if (cart.items.length === 0 && !placedOrderNumber) {
    return (
      <div className="page-shell py-12">
        <EmptyState
          icon={<Package className="size-6" aria-hidden="true" />}
          title="Nothing to check out yet"
          description="Add a product to your cart first, then come back to walk through the demo checkout."
          action={
            <Button asChild className="rounded-full">
              <Link to="/shop">Browse products</Link>
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="page-shell py-8 sm:py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Demo checkout · no real payment</p>
          <h1 className="mt-1.5 text-[30px] font-bold tracking-tight sm:text-[36px]">Checkout</h1>
        </div>
        <p className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-[11px] font-semibold text-amber-800">
          <ShieldCheck className="size-3.5" aria-hidden="true" /> DEMO MODE — synthetic data only
        </p>
      </div>

      <ol className="mt-6 flex gap-1.5 overflow-x-auto pb-1 no-scrollbar" aria-label="Checkout steps">
        {STEPS.map((item) => {
          const state = item.id < step ? "done" : item.id === step ? "current" : "upcoming";
          return (
            <li key={item.id} className="flex-1 min-w-[120px]">
              <button
                type="button"
                onClick={() => item.id < step && setStep(item.id)}
                disabled={item.id > step}
                aria-current={state === "current" ? "step" : undefined}
                data-testid={`checkout-step-${item.id}`}
                className={cn(
                  "w-full rounded-xl border px-3 py-2.5 text-left transition-colors",
                  state === "current" && "border-primary bg-primary/5",
                  state === "done" && "border-border bg-card hover:border-primary/40",
                  state === "upcoming" && "border-border/60 bg-transparent",
                )}
              >
                <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  {state === "done" ? (
                    <Check className="size-3 text-emerald-600" aria-hidden="true" />
                  ) : (
                    <span>{item.id}</span>
                  )}
                  Step {item.id}
                </span>
                <span
                  className={cn(
                    "mt-0.5 block text-xs font-semibold",
                    state === "upcoming" ? "text-muted-foreground" : "text-foreground",
                  )}
                >
                  {item.label}
                </span>
              </button>
            </li>
          );
        })}
      </ol>

      <div className="mt-7 grid gap-8 lg:grid-cols-[1.5fr_0.85fr]">
        <div>
          <motion.form
            key={step}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
            onSubmit={handleStepSubmit}
            data-testid="checkout-form"
            className="rounded-2xl border border-border/80 bg-card p-5 sm:p-6"
          >
            {step === 1 && (
              <section aria-labelledby="step-details">
                <StepHeader
                  icon={<UserRound className="size-4" />}
                  title="Your details"
                  copy="Used for the demo receipt and order updates. Nothing is sent by email."
                  id="step-details"
                />
                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                  <Field label="Full name" htmlFor="customer_name" className="sm:col-span-2">
                    <Input
                      id="customer_name"
                      name="customer_name"
                      data-testid="customer-name"
                      autoComplete="name"
                      value={customer.name}
                      onChange={(event) =>
                        setCustomer((current) => ({ ...current, name: event.target.value }))
                      }
                      placeholder="Ananya Deshpande"
                      required
                    />
                  </Field>
                  <Field label="Email address" htmlFor="customer_email">
                    <Input
                      id="customer_email"
                      name="customer_email"
                      type="email"
                      data-testid="customer-email"
                      autoComplete="email"
                      value={customer.email}
                      onChange={(event) =>
                        setCustomer((current) => ({ ...current, email: event.target.value }))
                      }
                      placeholder="ananya.deshpande@example.com"
                      required
                    />
                  </Field>
                  <Field label="Phone number" htmlFor="customer_phone">
                    <Input
                      id="customer_phone"
                      name="customer_phone"
                      type="tel"
                      data-testid="customer-phone"
                      autoComplete="tel"
                      value={customer.phone}
                      onChange={(event) =>
                        setCustomer((current) => ({ ...current, phone: event.target.value }))
                      }
                      placeholder="+91 98200 45512"
                      required
                    />
                  </Field>
                </div>
                {!isAuthenticated && (
                  <p className="mt-4 rounded-xl bg-secondary px-3.5 py-2.5 text-[11.5px] leading-5 text-muted-foreground">
                    Checking out as a guest.{" "}
                    <Link to="/auth?returnTo=/checkout" className="font-semibold text-primary hover:underline">
                      Sign in
                    </Link>{" "}
                    to use saved addresses and keep this order in your history.
                  </p>
                )}
              </section>
            )}

            {step === 2 && (
              <section aria-labelledby="step-address">
                <StepHeader
                  icon={<MapPin className="size-4" />}
                  title="Delivery address"
                  copy="Synthetic demo addresses are encouraged. All fields are stored in the CartNest demo database."
                  id="step-address"
                />

                {addresses && addresses.length > 0 && (
                  <div className="mt-5">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                      Use a saved address
                    </p>
                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                      {addresses.map((saved) => (
                        <button
                          key={saved._id}
                          type="button"
                          onClick={() => applySavedAddress(saved)}
                          data-testid={`saved-address-${saved._id}`}
                          className="rounded-xl border border-border bg-background p-3 text-left text-xs transition-colors hover:border-primary/50 hover:bg-accent/40"
                        >
                          <span className="flex items-center gap-1.5 font-semibold">
                            {saved.addressType}
                            {saved.isDefault && (
                              <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[9px] font-bold uppercase text-primary">
                                Default
                              </span>
                            )}
                          </span>
                          <span className="mt-1 block leading-5 text-muted-foreground">
                            {saved.house}, {saved.street}, {saved.city}, {saved.state} {saved.postalCode}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                  <Field label="Recipient name" htmlFor="delivery_full_name">
                    <Input
                      id="delivery_full_name"
                      name="delivery_full_name"
                      data-testid="delivery-full-name"
                      value={address.fullName}
                      onChange={(event) =>
                        setAddress((current) => ({ ...current, fullName: event.target.value }))
                      }
                      required
                    />
                  </Field>
                  <Field label="Contact phone" htmlFor="delivery_phone">
                    <Input
                      id="delivery_phone"
                      name="delivery_phone"
                      type="tel"
                      data-testid="delivery-phone"
                      value={address.phone}
                      onChange={(event) =>
                        setAddress((current) => ({ ...current, phone: event.target.value }))
                      }
                      required
                    />
                  </Field>
                  <Field label="House / building number" htmlFor="house_number">
                    <Input
                      id="house_number"
                      name="house_number"
                      data-testid="address-house"
                      value={address.house}
                      onChange={(event) =>
                        setAddress((current) => ({ ...current, house: event.target.value }))
                      }
                      placeholder="Flat 704, B Wing, Sundaram Residency"
                      required
                    />
                  </Field>
                  <Field label="Street / area" htmlFor="street_address">
                    <Input
                      id="street_address"
                      name="street_address"
                      data-testid="address-street"
                      value={address.street}
                      onChange={(event) =>
                        setAddress((current) => ({ ...current, street: event.target.value }))
                      }
                      placeholder="Off Link Road, Andheri West"
                      required
                    />
                  </Field>
                  <Field label="City" htmlFor="city">
                    <Input
                      id="city"
                      name="city"
                      data-testid="address-city"
                      value={address.city}
                      onChange={(event) =>
                        setAddress((current) => ({ ...current, city: event.target.value }))
                      }
                      placeholder="Mumbai"
                      required
                    />
                  </Field>
                  <Field label="State" htmlFor="state">
                    <Input
                      id="state"
                      name="state"
                      data-testid="address-state"
                      value={address.state}
                      onChange={(event) =>
                        setAddress((current) => ({ ...current, state: event.target.value }))
                      }
                      placeholder="Maharashtra"
                      required
                    />
                  </Field>
                  <Field label="PIN code" htmlFor="postal_code">
                    <Input
                      id="postal_code"
                      name="postal_code"
                      inputMode="numeric"
                      data-testid="address-postal-code"
                      value={address.postalCode}
                      onChange={(event) =>
                        setAddress((current) => ({
                          ...current,
                          postalCode: event.target.value.replace(/\D/g, "").slice(0, 6),
                        }))
                      }
                      placeholder="400053"
                      required
                    />
                  </Field>
                  <Field label="Country" htmlFor="country">
                    <Input
                      id="country"
                      name="country"
                      data-testid="address-country"
                      value={address.country}
                      onChange={(event) =>
                        setAddress((current) => ({ ...current, country: event.target.value }))
                      }
                      required
                    />
                  </Field>
                </div>

                <fieldset className="mt-5">
                  <legend className="text-xs font-semibold">Address type</legend>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {(["Home", "Office"] as const).map((type) => (
                      <label
                        key={type}
                        className={cn(
                          "flex cursor-pointer items-center gap-2 rounded-full border px-4 py-2 text-xs font-medium transition-colors",
                          address.addressType === type
                            ? "border-primary bg-primary/5 text-primary"
                            : "border-border text-muted-foreground hover:border-primary/40",
                        )}
                      >
                        <input
                          type="radio"
                          name="address_type"
                          value={type}
                          checked={address.addressType === type}
                          onChange={() => setAddress((current) => ({ ...current, addressType: type }))}
                          data-testid={`address-type-${type.toLowerCase()}`}
                          className="accent-[var(--primary)]"
                        />
                        {type}
                      </label>
                    ))}
                  </div>
                </fieldset>

                <label className="mt-4 flex items-start gap-2 text-[11.5px] text-muted-foreground">
                  <input
                    type="checkbox"
                    name="save_address"
                    checked={saveAddressForLater}
                    onChange={(event) => setSaveAddressForLater(event.target.checked)}
                    className="mt-0.5 accent-[var(--primary)]"
                  />
                  Save this address to my account for faster demo checkouts.
                </label>
              </section>
            )}

            {step === 3 && (
              <section aria-labelledby="step-delivery">
                <StepHeader
                  icon={<Truck className="size-4" />}
                  title="Delivery options"
                  copy="Both options are simulated. Standard is free above ₹999."
                  id="step-delivery"
                />
                <fieldset className="mt-5 space-y-2.5">
                  <legend className="sr-only">Delivery method</legend>
                  {[
                    {
                      value: "standard" as const,
                      title: "Standard delivery",
                      copy: "3–5 business days · free above ₹999",
                      price: subtotal >= 999 || coupon?.kind === "shipping" ? "Free" : "₹49",
                      icon: Truck,
                    },
                    {
                      value: "express" as const,
                      title: "Express delivery",
                      copy: "1–2 business days · priority dispatch",
                      price: "₹149",
                      icon: Zap,
                    },
                  ].map((option) => (
                    <label
                      key={option.value}
                      className={cn(
                        "flex cursor-pointer items-center gap-3 rounded-xl border p-4 transition-colors",
                        deliveryMethod === option.value
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-primary/40",
                      )}
                    >
                      <input
                        type="radio"
                        name="delivery_method"
                        value={option.value}
                        checked={deliveryMethod === option.value}
                        onChange={() => setDeliveryMethod(option.value)}
                        data-testid={`delivery-${option.value}`}
                        className="accent-[var(--primary)]"
                      />
                      <span className="grid size-9 place-items-center rounded-full bg-secondary text-primary">
                        <option.icon className="size-4" aria-hidden="true" />
                      </span>
                      <span className="flex-1">
                        <span className="block text-sm font-semibold">{option.title}</span>
                        <span className="block text-[11.5px] text-muted-foreground">{option.copy}</span>
                      </span>
                      <span className="text-sm font-bold">{option.price}</span>
                    </label>
                  ))}
                </fieldset>

                <div className="mt-5">
                  <Label htmlFor="delivery_instructions" className="text-xs font-semibold">
                    Preferred delivery instructions <span className="font-normal text-muted-foreground">(optional)</span>
                  </Label>
                  <Textarea
                    id="delivery_instructions"
                    name="delivery_instructions"
                    data-testid="delivery-instructions"
                    value={instructions}
                    onChange={(event) => setInstructions(event.target.value.slice(0, 400))}
                    placeholder="e.g. Call on arrival, leave with the security desk, avoid the morning slot."
                    className="mt-2 min-h-24 resize-none"
                  />
                  <p className="mt-1 text-right text-[10px] text-muted-foreground">
                    {instructions.length}/400
                  </p>
                </div>
              </section>
            )}

            {step === 4 && (
              <section aria-labelledby="step-payment">
                <StepHeader
                  icon={<ShieldCheck className="size-4" />}
                  title="Payment simulation"
                  copy="Never enter real card numbers, CVVs, bank passwords or OTPs here. Nothing is charged."
                  id="step-payment"
                />
                <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-[11.5px] leading-5 text-amber-900">
                  <strong>DEMO MODE.</strong> This storefront is not connected to any payment
                  gateway. Payment details below are fixed synthetic examples.
                </div>

                <fieldset className="mt-5 space-y-2.5">
                  <legend className="sr-only">Payment method</legend>
                  {PAYMENT_OPTIONS.map((option) => (
                    <label
                      key={option.value}
                      className={cn(
                        "flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-colors",
                        paymentMethod === option.value
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-primary/40",
                      )}
                    >
                      <input
                        type="radio"
                        name="payment_method"
                        value={option.value}
                        checked={paymentMethod === option.value}
                        onChange={() => setPaymentMethod(option.value)}
                        data-testid={`payment-${option.value}`}
                        className="mt-1 accent-[var(--primary)]"
                      />
                      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-secondary text-primary">
                        <option.icon className="size-4" aria-hidden="true" />
                      </span>
                      <span className="flex-1">
                        <span className="flex flex-wrap items-center gap-2 text-sm font-semibold">
                          {option.title}
                          <span className="rounded-full bg-foreground px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-background">
                            Demo
                          </span>
                        </span>
                        <span className="mt-0.5 block text-[11.5px] leading-5 text-muted-foreground">
                          {option.copy}
                        </span>
                      </span>
                    </label>
                  ))}
                </fieldset>

                {paymentMethod === "upi" && (
                  <div className="mt-4 rounded-xl border border-border bg-secondary/60 p-4">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                      Demo UPI handle
                    </p>
                    <p className="mt-1 font-mono text-sm font-semibold">demo@cartnest</p>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      A real UPI app is never opened. The order will simply record “UPI (DEMO)”.
                    </p>
                  </div>
                )}

                {paymentMethod === "card" && (
                  <div className="mt-4 overflow-hidden rounded-2xl bg-[oklch(0.235_0.035_264)] p-5 text-white">
                    <div className="flex items-start justify-between">
                      <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/60">
                        Demo card · not chargeable
                      </span>
                      <CreditCard className="size-5 text-white/70" aria-hidden="true" />
                    </div>
                    <p className="mt-5 font-mono text-lg tracking-[0.18em]">4242 4242 4242 4242</p>
                    <div className="mt-4 flex items-end justify-between text-[11px] text-white/65">
                      <span className="uppercase tracking-wider">Ananya Demo</span>
                      <span>12 / 30</span>
                    </div>
                    <p className="mt-4 text-[10px] leading-4 text-white/50">
                      Card number inputs are intentionally not present. No card data is requested,
                      transmitted or stored.
                    </p>
                  </div>
                )}
              </section>
            )}

            {step === 5 && (
              <section aria-labelledby="step-review">
                <StepHeader
                  icon={<Check className="size-4" />}
                  title="Review and place your demo order"
                  copy="Check the synthetic information below, then confirm. A unique order ID is generated instantly."
                  id="step-review"
                />
                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <ReviewBlock title="Contact details">
                    <p className="font-medium text-foreground" data-testid="review-customer-name">
                      {customer.name}
                    </p>
                    <p>{customer.email}</p>
                    <p>{customer.phone}</p>
                  </ReviewBlock>
                  <ReviewBlock title="Delivery address">
                    <p className="font-medium text-foreground">{address.fullName}</p>
                    <p>
                      {address.house}, {address.street}
                    </p>
                    <p>
                      {address.city}, {address.state} — {address.postalCode}
                    </p>
                    <p>{address.country}</p>
                    <p className="text-[10px] uppercase tracking-wide">{address.addressType}</p>
                  </ReviewBlock>
                  <ReviewBlock title="Delivery method">
                    <p className="font-medium text-foreground">
                      {deliveryMethod === "express" ? "Express delivery" : "Standard delivery"}
                    </p>
                    <p>
                      {deliveryMethod === "express"
                        ? "Priority dispatch · 1–2 business days"
                        : "Standard dispatch · 3–5 business days"}
                    </p>
                    {instructions && <p className="italic">“{instructions}”</p>}
                  </ReviewBlock>
                  <ReviewBlock title="Payment method">
                    <p className="font-medium text-foreground">
                      {paymentMethod === "cod"
                        ? "Cash on Delivery (DEMO)"
                        : paymentMethod === "upi"
                          ? "UPI — demo@cartnest (DEMO)"
                          : "Demo Card ending 4242"}
                    </p>
                    <p>No payment will be captured.</p>
                  </ReviewBlock>
                </div>

                <div className="mt-4 divide-y divide-border rounded-xl border border-border">
                  {cart.items.map((item) => (
                    <div key={item._id} className="flex items-center gap-3 p-3">
                      <div className="size-12 shrink-0 overflow-hidden rounded-lg bg-secondary">
                        <ProductImage
                          src={item.product.image}
                          alt={item.product.name}
                          accent={item.product.accent}
                          className="h-full w-full object-cover"
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-semibold">{item.product.name}</p>
                        <p className="text-[11px] text-muted-foreground">
                          Qty {item.quantity} · {formatINR(item.product.price)} each
                        </p>
                      </div>
                      <p className="text-xs font-bold">
                        {formatINR(item.product.price * item.quantity)}
                      </p>
                    </div>
                  ))}
                </div>

                <label className="mt-4 flex items-start gap-2 rounded-xl bg-secondary px-3.5 py-3 text-[11.5px] leading-5">
                  <input
                    type="checkbox"
                    name="demo_acknowledgement"
                    checked={demoAcknowledged}
                    onChange={(event) => setDemoAcknowledged(event.target.checked)}
                    data-testid="demo-acknowledgement"
                    className="mt-0.5 accent-[var(--primary)]"
                    required
                  />
                  <span>
                    I understand this is a simulated demo order for testing. No real payment will be
                    taken and no real delivery will be made.
                  </span>
                </label>
              </section>
            )}

            {error && (
              <p
                role="alert"
                data-testid="checkout-error"
                className="mt-4 rounded-xl border border-destructive/25 bg-destructive/5 px-3.5 py-2.5 text-xs font-medium text-destructive"
              >
                {error}
              </p>
            )}

            <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-5">
              {step > 1 ? (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={goBack}
                  className="rounded-full"
                  data-testid="checkout-back"
                >
                  <ArrowLeft className="size-4" /> Back
                </Button>
              ) : (
                <Button type="button" variant="ghost" asChild className="rounded-full">
                  <Link to="/cart">
                    <ArrowLeft className="size-4" /> Back to cart
                  </Link>
                </Button>
              )}

              {step < 5 ? (
                <Button type="submit" className="rounded-full px-6" data-testid="checkout-next">
                  Continue <ArrowRight className="size-4" />
                </Button>
              ) : (
                <Button
                  type="submit"
                  disabled={placing || !demoAcknowledged}
                  className="rounded-full px-6"
                  data-testid="place-order"
                >
                  {placing ? <Loader2 className="size-4 animate-spin" /> : <Package className="size-4" />}
                  Place demo order
                </Button>
              )}
            </div>
          </motion.form>

          <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 rounded-xl border border-border/70 bg-card px-4 py-3 text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck className="size-3.5 text-emerald-600" aria-hidden="true" /> No gateway integration
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Package className="size-3.5" aria-hidden="true" /> Unique demo order ID
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Truck className="size-3.5" aria-hidden="true" /> Simulated tracking
            </span>
          </div>
        </div>

        <aside className="lg:sticky lg:top-32 lg:self-start">
          <div className="rounded-2xl border border-border/80 bg-card p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold">Order summary</h2>
              <Link to="/cart" className="text-[11px] font-semibold text-primary hover:underline">
                Edit cart
              </Link>
            </div>

            <ul className="mt-4 space-y-3">
              {cart.items.map((item) => (
                <li key={item._id} className="flex items-center gap-3">
                  <div className="relative size-11 shrink-0 overflow-hidden rounded-lg bg-secondary">
                    <ProductImage
                      src={item.product.image}
                      alt={item.product.name}
                      accent={item.product.accent}
                      className="h-full w-full object-cover"
                    />
                    <span className="absolute -right-0 -top-0 grid size-4 place-items-center rounded-full bg-foreground text-[9px] font-bold text-background">
                      {item.quantity}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[11.5px] font-medium">{item.product.name}</p>
                    <p className="text-[10.5px] text-muted-foreground">{item.product.brand}</p>
                  </div>
                  <p className="text-[11.5px] font-semibold">
                    {formatINR(item.product.price * item.quantity)}
                  </p>
                </li>
              ))}
            </ul>

            <dl className="mt-4 space-y-2 border-t border-border pt-4 text-xs">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Subtotal</dt>
                <dd className="font-medium">{formatINR(totals.subtotal)}</dd>
              </div>
              {totals.discount > 0 && coupon && (
                <div className="flex justify-between text-emerald-700">
                  <dt>Coupon {coupon.code}</dt>
                  <dd>− {formatINR(totals.discount)}</dd>
                </div>
              )}
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Delivery</dt>
                <dd className="font-medium">
                  {totals.deliveryFee === 0 ? "Free" : formatINR(totals.deliveryFee)}
                </dd>
              </div>
              <div className="flex items-baseline justify-between border-t border-border pt-3">
                <dt className="text-sm font-semibold">Total payable</dt>
                <dd className="text-lg font-bold" data-testid="checkout-total">
                  {formatINR(totals.total)}
                </dd>
              </div>
            </dl>

            <p className="mt-3 text-[10.5px] leading-4 text-muted-foreground">
              Demo totals are recalculated by the CartNest backend when the order is created.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}

function StepHeader({
  icon,
  title,
  copy,
  id,
}: {
  icon: React.ReactNode;
  title: string;
  copy: string;
  id: string;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 text-primary">
        <span className="grid size-7 place-items-center rounded-lg bg-primary/10">{icon}</span>
        <h2 id={id} className="text-lg font-bold tracking-tight text-foreground">
          {title}
        </h2>
      </div>
      <p className="mt-2 text-[12.5px] leading-5 text-muted-foreground">{copy}</p>
    </div>
  );
}

function Field({
  label,
  htmlFor,
  children,
  className,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <Label htmlFor={htmlFor} className="text-xs font-semibold">
        {label}
      </Label>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}

function ReviewBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-background p-3.5">
      <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
        {title}
      </p>
      <div className="mt-1.5 space-y-0.5 text-xs leading-5 text-muted-foreground">{children}</div>
    </div>
  );
}
