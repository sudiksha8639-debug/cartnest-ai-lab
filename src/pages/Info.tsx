import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  BadgeCheck,
  Database,
  Fingerprint,
  Package,
  ShieldCheck,
  ShoppingBag,
} from "lucide-react";
import { Link } from "react-router";

type Variant = "about" | "privacy" | "terms";

type Section = { heading: string; body: string[]; bullets?: string[] };

const CONTENT: Record<
  Variant,
  { eyebrow: string; title: string; lede: string; sections: Section[] }
> = {
  about: {
    eyebrow: "About CartNest",
    title: "A storefront built for the agent that will browse it.",
    lede: "CartNest is a complete, realistic e-commerce demo — and the controlled testing environment for a separate Privacy-First Browser AI Agent. It is deliberately rich in synthetic customer information so that agent has something meaningful to inspect.",
    sections: [
      {
        heading: "What this is",
        body: [
          "A full-stack demo store with 30 curated products across electronics, fashion, home, beauty and accessories. You can search, filter, open product pages, build a cart, apply real (database-validated) coupons and complete a five-step simulated checkout.",
          "Accounts use secure one-time email codes instead of passwords. Profiles, saved addresses, carts, wishlists, orders and support requests are persisted in a Convex database.",
        ],
        bullets: [
          "Search → product page → cart → checkout → order tracking works end to end.",
          "Payment is simulated only: Cash on Delivery, a fixed UPI demo handle and a preview demo card.",
          "Demo orders advance through five realistic statuses with timestamped tracking.",
        ],
      },
      {
        heading: "Why it exists",
        body: [
          "Browser automation agents are hard to evaluate on real shopping sites: sessions break, data is private and pages change. CartNest provides a stable, ethical playground with the same kinds of forms and personal information a real store shows.",
          "The storefront itself does not implement PII detection, redaction or AI reasoning. Those belong to the external Chrome extension that visits this site.",
        ],
      },
      {
        heading: "Built for inspection",
        body: [
          "Pages use semantic HTML — nav, main, section, form, label, button — with labelled inputs and stable identifiers. Every important action has a descriptive data-testid, and content is live text in the DOM rather than canvas or images.",
        ],
        bullets: [
          "Stable field names such as customer_name, customer_email, customer_phone, postal_code and payment_method.",
          "Confirmation messages for adding to cart, saving addresses, submitting support requests and placing orders.",
          "No DOM-inspection blocking, no randomised selectors between loads.",
        ],
      },
      {
        heading: "Demo data notice",
        body: [
          "Every person, address, phone number, email, order and review in this project is fictional. Do not enter real personal data. There is no connection to Stripe, Razorpay, a bank, a courier or an email marketing platform.",
          "The demo account (Ananya Deshpande) comes with synthetic saved addresses and three sample orders in different states so privacy testing can start immediately.",
        ],
      },
    ],
  },
  privacy: {
    eyebrow: "Privacy policy",
    title: "Demo privacy, stated plainly.",
    lede: "CartNest stores only the synthetic shopping information you type into it. There is no analytics pipeline, no advertising tracker and no payment gateway — just a demo database.",
    sections: [
      {
        heading: "What we store",
        body: [
          "When you use the storefront we save the information needed to make shopping workflows work: an account profile (name, email, phone), saved addresses, cart and wishlist rows, orders with their delivery snapshots, newsletter emails and support messages.",
        ],
        bullets: [
          "Guest sessions are identified by a random key stored in your browser.",
          "Recently viewed products and an applied coupon are stored locally in your browser, not on the server.",
          "No passwords are collected or stored: sign-in uses one-time email codes.",
        ],
      },
      {
        heading: "Payment information",
        body: [
          "CartNest does not request, transmit or store card numbers, CVVs, banking passwords or OTPs. Checkout offers Cash on Delivery, a fixed demo UPI handle and a visual demo card that has no input fields. Every order is marked as a demo transaction.",
        ],
      },
      {
        heading: "Third-party requests",
        body: [
          "The interface loads product photography from Unsplash and the Plus Jakarta Sans / Instrument Serif typefaces from Google Fonts. Those requests are subject to those providers' own policies. No other third-party scripts are loaded.",
        ],
      },
      {
        heading: "Your control",
        body: [
          "Signed-in customers can edit their profile, manage addresses, remove wishlist items and sign out. Account settings includes an option to clear locally stored browsing data. Support requests to remove a demo account can be sent through the contact form.",
        ],
      },
      {
        heading: "A note on the agent",
        body: [
          "This storefront is visited by a separate privacy-first browser agent for testing. CartNest does not analyse, score or redact the personal information it displays — it simply provides realistic DOM content for that external tool.",
        ],
      },
    ],
  },
  terms: {
    eyebrow: "Terms of use",
    title: "A demo store, with demo rules.",
    lede: "By using CartNest you agree that this is a non-commercial testing environment. Nothing you do here creates a real purchase, delivery or payment obligation.",
    sections: [
      {
        heading: "Demo-only service",
        body: [
          "CartNest exists for demonstrations, coursework and browser-agent testing. Products, prices, availability, delivery dates and order IDs are synthetic. No real goods are sold or shipped, and no real money changes hands.",
        ],
      },
      {
        heading: "Acceptable use",
        body: [
          "Use clearly fictional information in every form. Do not enter real names, real phone numbers, real addresses or any financial credentials. Do not attempt to connect this demo to a live payment provider or use it to mislead anyone into a purchase.",
        ],
      },
      {
        heading: "Accounts and access",
        body: [
          "Accounts are secured with one-time email codes. You are responsible for activity under your demo session. We may reset demo data, catalogue content or accounts at any time without notice.",
        ],
      },
      {
        heading: "Content and availability",
        body: [
          "Product names, brands and descriptions are fictional. Photography is licensed from Unsplash for demonstration purposes. The service is provided as-is, with no guarantee of availability or fitness for a particular purpose.",
        ],
      },
      {
        heading: "Limitation of liability",
        body: [
          "Because this is a simulation, CartNest accepts no liability for losses arising from reliance on demo prices, stock, orders or delivery estimates. Privacy testing should use synthetic data only.",
        ],
      },
    ],
  },
};

const META: Record<Variant, { icon: typeof ShoppingBag; points: string[] }> = {
  about: {
    icon: ShoppingBag,
    points: ["30 demo products", "5 shopping categories", "5 tracking statuses"],
  },
  privacy: {
    icon: Fingerprint,
    points: ["Synthetic data only", "No payment gateway", "No analytics scripts"],
  },
  terms: {
    icon: BadgeCheck,
    points: ["Non-commercial demo", "Fictional products", "Reset at any time"],
  },
};

export default function Info({ variant }: { variant: Variant }) {
  const content = CONTENT[variant];
  const meta = META[variant];
  const Icon = meta.icon;

  return (
    <div className="page-shell py-8 sm:py-12">
      <Link
        to="/"
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" aria-hidden="true" /> Back to CartNest
      </Link>

      <div className="mt-6 grid gap-10 lg:grid-cols-[1fr_260px]">
        <article>
          <p className="eyebrow">{content.eyebrow}</p>
          <h1 className="mt-2 max-w-2xl text-[34px] font-bold leading-[1.07] tracking-[-0.03em] sm:text-[44px]">
            {content.title}
          </h1>
          <p className="mt-4 max-w-2xl text-[15px] leading-7 text-muted-foreground">{content.lede}</p>

          <div className="mt-9 space-y-8">
            {content.sections.map((section) => (
              <section
                key={section.heading}
                id={section.heading.toLowerCase().replace(/[^a-z]+/g, "-")}
                className="scroll-mt-32"
              >
                <h2 className="text-lg font-bold tracking-tight">{section.heading}</h2>
                {section.body.map((paragraph) => (
                  <p key={paragraph} className="mt-2 text-[13.5px] leading-7 text-muted-foreground">
                    {paragraph}
                  </p>
                ))}
                {section.bullets && (
                  <ul className="mt-3 space-y-1.5">
                    {section.bullets.map((bullet) => (
                      <li key={bullet} className="flex items-start gap-2 text-[13px] leading-6">
                        <BadgeCheck className="mt-1 size-3.5 shrink-0 text-primary" aria-hidden="true" />
                        <span className="text-muted-foreground">{bullet}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            ))}
          </div>

          <div className="mt-10 flex flex-wrap gap-2">
            <Button asChild className="rounded-full">
              <Link to="/shop">Browse the catalogue</Link>
            </Button>
            <Button asChild variant="outline" className="rounded-full">
              <Link to="/contact">Contact support</Link>
            </Button>
          </div>
        </article>

        <aside className="lg:sticky lg:top-36 lg:self-start">
          <div className="rounded-2xl border border-border/80 bg-card p-5">
            <span className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary">
              <Icon className="size-5" aria-hidden="true" />
            </span>
            <p className="mt-3 text-sm font-bold">Demo snapshot</p>
            <ul className="mt-2 space-y-1.5 text-[11.5px] text-muted-foreground">
              {meta.points.map((point) => (
                <li key={point} className="flex items-center gap-1.5">
                  <span className="size-1 rounded-full bg-primary" aria-hidden="true" />
                  {point}
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-4 rounded-2xl border border-border/80 bg-[oklch(0.972_0.012_275)] p-5">
            <p className="inline-flex items-center gap-1.5 text-xs font-bold">
              <ShieldCheck className="size-4 text-emerald-600" aria-hidden="true" /> Synthetic PII
            </p>
            <p className="mt-1.5 text-[11px] leading-5 text-muted-foreground">
              Names, Indian phone numbers, PIN codes and order IDs on this site are fictional and
              exist for privacy-agent testing.
            </p>
          </div>

          <div className="mt-4 rounded-2xl border border-border/80 bg-card p-5">
            <p className="inline-flex items-center gap-1.5 text-xs font-bold">
              <Database className="size-4 text-primary" aria-hidden="true" /> Stack
            </p>
            <p className="mt-1.5 text-[11px] leading-5 text-muted-foreground">
              React 19 · Vite · Tailwind CSS · shadcn/ui · Convex database and auth.
            </p>
            <p className="mt-3 inline-flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground">
              <Package className="size-3.5" aria-hidden="true" /> Not a commercial store
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
