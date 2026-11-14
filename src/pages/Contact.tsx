import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
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
import { useMutation } from "convex/react";
import { motion } from "framer-motion";
import {
  CheckCircle2,
  Clock,
  Loader2,
  Mail,
  MapPin,
  MessageSquare,
  Package,
  Phone,
  ShieldCheck,
} from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import { toast } from "sonner";

const FAQS = [
  {
    q: "Is CartNest a real store?",
    a: "No. CartNest is a controlled demo storefront built for testing a separate privacy-first browser agent. All products, customers, addresses and orders are synthetic, and no payment gateway is connected.",
  },
  {
    q: "What demo coupon codes can I use?",
    a: "CARTNEST10 gives 10% off up to ₹750 on carts above ₹999. WELCOME200 gives a flat ₹200 off above ₹1,499. FREESHIP removes standard delivery charges. Each code is validated by the backend.",
  },
  {
    q: "How does delivery work in the demo?",
    a: "Standard delivery is free above ₹999 (otherwise ₹49) and takes 3–5 days. Express delivery costs ₹149 and takes 1–2 days. Dates are simulated; nothing is actually shipped.",
  },
  {
    q: "Where can I find my order status?",
    a: "Sign in with a one-time email code, then open My Orders. Demo orders move through Order Placed, Processing, Shipped, Out for Delivery and Delivered, with timestamps and a tracking timeline.",
  },
  {
    q: "Do I need to enter real payment details?",
    a: "Never. Checkout offers Cash on Delivery, a fixed UPI demo handle and a preview demo card. There are no card number, CVV or banking password fields anywhere on CartNest.",
  },
  {
    q: "How is my information stored?",
    a: "Demo profile, cart, wishlist, address and order records are stored in the CartNest Convex database. Sign-in uses one-time email codes, so no password is stored. This storefront does not perform PII detection itself.",
  },
];

const TOPICS = [
  "Order support",
  "Product question",
  "Returns and refunds",
  "Demo account help",
  "Privacy-agent testing",
  "Something else",
];

export default function Contact() {
  const submit = useMutation(api.support.submit);
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    orderNumber: "",
    message: "",
  });
  const [topic, setTopic] = useState("Order support");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ticket, setTicket] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSending(true);
    try {
      const result = await submit({
        name: form.name,
        email: form.email,
        phone: form.phone,
        topic,
        orderNumber: form.orderNumber || undefined,
        message: form.message,
      });
      setTicket(result.ticketNumber);
      toast.success("Support request received", {
        description: `Ticket ${result.ticketNumber} is saved in the demo database. No email is sent.`,
      });
      setForm({ name: "", email: "", phone: "", orderNumber: "", message: "" });
    } catch (submitError) {
      const message =
        submitError instanceof Error
          ? submitError.message.replace(/^Uncaught Error:\s*/, "")
          : "Could not send your request.";
      setError(message);
      toast.error("Could not send request", { description: message });
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="page-shell py-8 sm:py-12">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <p className="eyebrow">Customer support</p>
        <h1 className="mt-2 max-w-2xl text-[34px] font-bold leading-[1.08] tracking-[-0.03em] sm:text-[44px]">
          Customer support,{" "}
          <span className="display-serif italic text-primary">handled with care.</span>
        </h1>
        <p className="mt-3 max-w-xl text-sm leading-7 text-muted-foreground">
          Send us a message and it is recorded in the CartNest support queue. Include an order
          number where relevant so the store team has the full context.
        </p>
      </motion.div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1.35fr_0.65fr]">
        <div className="rounded-2xl border border-border/80 bg-card p-5 sm:p-6">
          <div className="flex items-center gap-2">
            <MessageSquare className="size-4 text-primary" aria-hidden="true" />
            <h2 className="text-lg font-bold tracking-tight" id="order-support">
              Customer support form
            </h2>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            All fields marked with * are required. Use synthetic details only.
          </p>

          {ticket && (
            <div
              role="status"
              data-testid="support-success"
              className="mt-4 flex items-start gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-800"
            >
              <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <span>
                <strong>Ticket {ticket} created.</strong> Your demo request was saved to the support
                table. Expect no reply — this is a testing environment.
              </span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-5 grid gap-4" data-testid="support-form">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="support_name" className="text-xs font-semibold">
                  Full name *
                </Label>
                <Input
                  id="support_name"
                  name="customer_name"
                  data-testid="support-name"
                  className="mt-1.5"
                  value={form.name}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, name: event.target.value }))
                  }
                  placeholder="Ananya Deshpande"
                  required
                />
              </div>
              <div>
                <Label htmlFor="support_email" className="text-xs font-semibold">
                  Email address *
                </Label>
                <Input
                  id="support_email"
                  name="customer_email"
                  type="email"
                  data-testid="support-email"
                  className="mt-1.5"
                  value={form.email}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, email: event.target.value }))
                  }
                  placeholder="ananya.deshpande@example.com"
                  required
                />
              </div>
              <div>
                <Label htmlFor="support_phone" className="text-xs font-semibold">
                  Phone number *
                </Label>
                <Input
                  id="support_phone"
                  name="customer_phone"
                  type="tel"
                  data-testid="support-phone"
                  className="mt-1.5"
                  value={form.phone}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, phone: event.target.value }))
                  }
                  placeholder="+91 98200 45512"
                  required
                />
              </div>
              <div>
                <Label htmlFor="support_topic" className="text-xs font-semibold">
                  What is this about?
                </Label>
                <Select value={topic} onValueChange={setTopic}>
                  <SelectTrigger id="support_topic" className="mt-1.5" data-testid="support-topic">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TOPICS.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label htmlFor="support_order" className="text-xs font-semibold">
                Demo order number <span className="font-normal text-muted-foreground">(optional)</span>
              </Label>
              <Input
                id="support_order"
                name="order_number"
                data-testid="support-order-number"
                className="mt-1.5 uppercase"
                value={form.orderNumber}
                onChange={(event) =>
                  setForm((current) => ({ ...current, orderNumber: event.target.value.toUpperCase() }))
                }
                placeholder="CN-2026-XXXXXX"
              />
            </div>

            <div>
              <Label htmlFor="support_message" className="text-xs font-semibold">
                Message *
              </Label>
              <Textarea
                id="support_message"
                name="message"
                data-testid="support-message"
                className="mt-1.5 min-h-32 resize-y"
                value={form.message}
                onChange={(event) =>
                  setForm((current) => ({ ...current, message: event.target.value.slice(0, 2000) }))
                }
                placeholder="Tell us what happened. Include synthetic order details if relevant."
                required
              />
              <p className="mt-1 text-right text-[10px] text-muted-foreground">
                {form.message.length}/2000
              </p>
            </div>

            {error && (
              <p role="alert" className="rounded-lg bg-destructive/5 px-3 py-2 text-xs font-medium text-destructive">
                {error}
              </p>
            )}

            <div className="flex flex-wrap items-center gap-3">
              <Button type="submit" disabled={sending} data-testid="support-submit">
                {sending ? <Loader2 className="size-4 animate-spin" /> : null}
                Send support request
              </Button>
              <p className="text-[11px] text-muted-foreground">
                Stored in the CartNest database, not emailed.
              </p>
            </div>
          </form>
        </div>

        <aside className="space-y-4">
          <div className="rounded-2xl border border-border/80 bg-card p-5">
            <h2 className="text-sm font-bold">Contact the support desk</h2>
            <ul className="mt-3 space-y-3 text-xs">
              <li className="flex items-start gap-2.5">
                <Mail className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
                <span>
                  <span className="block font-medium">hello@cartnest.example</span>
                  <span className="text-muted-foreground">Fictional support inbox</span>
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <Phone className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
                <span>
                  <span className="block font-medium">+91 98200 45512</span>
                  <span className="text-muted-foreground">Synthetic Indian mobile number</span>
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <MapPin className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
                <span>
                  <span className="block font-medium">CartNest Demo Studio</span>
                  <span className="text-muted-foreground">
                    4th Floor, Sundaram House, Andheri West, Mumbai 400053
                  </span>
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <Clock className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
                <span>
                  <span className="block font-medium">Mon–Sat, 9:00–19:00 IST</span>
                  <span className="text-muted-foreground">Demo hours only</span>
                </span>
              </li>
            </ul>
          </div>

          <div className="rounded-2xl border border-border/80 bg-[oklch(0.972_0.012_275)] p-5 text-[11.5px] leading-5 text-muted-foreground">
            <p className="inline-flex items-center gap-1.5 font-semibold text-foreground">
              <ShieldCheck className="size-3.5 text-emerald-600" aria-hidden="true" /> Privacy notice
            </p>
            <p className="mt-1.5">
              The support form intentionally collects name, email, phone and order details so a
              privacy agent has sensitive fields to inspect. Nothing is shared with third parties.
            </p>
          </div>

          <div className="rounded-2xl border border-border/80 bg-card p-5">
            <p className="inline-flex items-center gap-1.5 text-sm font-bold">
              <Package className="size-4 text-primary" aria-hidden="true" /> Tracking an order?
            </p>
            <p className="mt-1.5 text-[11.5px] leading-5 text-muted-foreground">
              Open My Orders for a live timeline, or include the order ID here so support has the
              context.
            </p>
            <Button asChild variant="outline" size="sm" className="mt-3 rounded-full">
              <Link to="/orders">Go to My Orders</Link>
            </Button>
          </div>
        </aside>
      </div>

      <section id="faq" className="mt-12 scroll-mt-32">
        <h2 className="text-[26px] font-bold tracking-tight sm:text-[30px]">
          Frequently asked questions
        </h2>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Everything about the CartNest demo, in plain language.
        </p>
        <Accordion type="single" collapsible className="mt-5 rounded-2xl border border-border/80 bg-card px-5">
          {FAQS.map((faq, index) => (
            <AccordionItem key={faq.q} value={`faq-${index}`} className="last:border-b-0">
              <AccordionTrigger className="text-left text-sm font-semibold hover:no-underline">
                {faq.q}
              </AccordionTrigger>
              <AccordionContent className="text-[13px] leading-6 text-muted-foreground">
                {faq.a}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </section>
    </div>
  );
}
