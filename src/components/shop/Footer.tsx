import { CATEGORIES } from "@/lib/shop";
import { Facebook, Instagram, Mail, MapPin, Phone, ShieldCheck, Twitter, Youtube } from "lucide-react";
import { Link } from "react-router";
import { Logo } from "./Logo";

const SOCIALS = [
  { label: "CartNest on Instagram", href: "https://www.instagram.com", Icon: Instagram },
  { label: "CartNest on Facebook", href: "https://www.facebook.com", Icon: Facebook },
  { label: "CartNest on X", href: "https://www.x.com", Icon: Twitter },
  { label: "CartNest on YouTube", href: "https://www.youtube.com", Icon: Youtube },
];

export function Footer() {
  return (
    <footer className="mt-20 border-t border-border bg-[oklch(0.975_0.006_265)]">
      <div className="page-shell py-14">
        <div className="grid gap-10 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div>
            <Logo />
            <p className="mt-4 max-w-xs text-sm leading-6 text-muted-foreground">
              Everything you love, all in one place. A considered storefront demonstration built
              for privacy-first browser agent testing.
            </p>
            <ul className="mt-5 space-y-2 text-sm text-muted-foreground">
              <li className="flex items-center gap-2">
                <Mail className="size-4 shrink-0" aria-hidden="true" />
                <a href="mailto:hello@cartnest.example" className="hover:text-foreground">
                  hello@cartnest.example
                </a>
              </li>
              <li className="flex items-center gap-2">
                <Phone className="size-4 shrink-0" aria-hidden="true" />
                <a href="tel:+919820045512" className="hover:text-foreground">
                  +91 98200 45512
                </a>
              </li>
              <li className="flex items-start gap-2">
                <MapPin className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                <span>
                  CartNest Demo Studio, 4th Floor, Sundaram House, Andheri West, Mumbai 400053
                </span>
              </li>
            </ul>
            <div className="mt-5 flex items-center gap-2">
              {SOCIALS.map(({ label, href, Icon }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={label}
                  className="grid size-9 place-items-center rounded-full border border-border bg-card text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
                >
                  <Icon className="size-4" aria-hidden="true" />
                </a>
              ))}
            </div>
          </div>

          <FooterColumn title="Shop">
            <FooterLink to="/shop">All products</FooterLink>
            {CATEGORIES.map((category) => (
              <FooterLink
                key={category.name}
                to={`/shop?category=${encodeURIComponent(category.name)}`}
              >
                {category.name}
              </FooterLink>
            ))}
            <FooterLink to="/deals">Special offers</FooterLink>
          </FooterColumn>

          <FooterColumn title="Help">
            <FooterLink to="/contact">Contact us</FooterLink>
            <FooterLink to="/contact#faq">FAQs</FooterLink>
            <FooterLink to="/orders">Track an order</FooterLink>
            <FooterLink to="/contact#order-support">Order support</FooterLink>
            <FooterLink to="/account?tab=addresses">Saved addresses</FooterLink>
          </FooterColumn>

          <FooterColumn title="Company">
            <FooterLink to="/about">About CartNest</FooterLink>
            <FooterLink to="/privacy">Privacy policy</FooterLink>
            <FooterLink to="/terms">Terms of use</FooterLink>
            <FooterLink to="/about#demo">Demo data notice</FooterLink>
            <FooterLink to="/auth?mode=register">Create an account</FooterLink>
          </FooterColumn>
        </div>

        <div className="mt-12 flex flex-col gap-4 border-t border-border pt-6 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>© 2026 CartNest. A synthetic demo project — not a commercial store.</p>
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1">
              <ShieldCheck className="size-3.5" aria-hidden="true" /> DEMO MODE ONLY
            </span>
            <span className="rounded-full border border-border bg-card px-2.5 py-1">COD</span>
            <span className="rounded-full border border-border bg-card px-2.5 py-1">UPI demo</span>
            <span className="rounded-full border border-border bg-card px-2.5 py-1">Card demo</span>
          </div>
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="text-[11px] font-bold uppercase tracking-[0.18em] text-foreground">{title}</h2>
      <ul className="mt-4 space-y-2.5">{children}</ul>
    </div>
  );
}

function FooterLink({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <li>
      <Link
        to={to}
        className="text-sm text-muted-foreground transition-colors hover:text-primary"
      >
        {children}
      </Link>
    </li>
  );
}
