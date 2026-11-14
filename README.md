# CartNest

**Everything you love, all in one place.**

CartNest is a complete, full-stack demo e-commerce storefront built as a controlled
testing environment for a separate **Privacy-First Browser AI Agent**. It has real
shopping workflows, real persistence and deliberately realistic synthetic customer
data — and it never processes a real payment.

> This is a demonstration project, not a commercial store. Every person, address,
> phone number, order and product is fictional.

---

## What works end to end

- **Discovery** — homepage sections, 31 seeded products, server-side search, category /
  price / rating filters, six sort orders, product detail pages with galleries, specs,
  related products and recently viewed.
- **Cart & wishlist** — Convex-persisted carts for both guests and signed-in customers,
  quantity updates, removal, wishlist toggle, guest-cart merge on sign-in.
- **Coupons** — database-backed `CARTNEST10` (10% up to ₹750), `WELCOME200` (flat ₹200)
  and `FREESHIP`, validated on the server.
- **Accounts** — email one-time-code sign-in, profile editing, saved addresses (CRUD,
  default address), wishlist, order history and settings.
- **Checkout** — five steps (details → address → delivery → payment → review) with
  validation on both client and server, delivery pricing and a unique demo order ID.
- **Orders** — order confirmation, receipt, and tracking through Order Placed →
  Processing → Shipped → Out for Delivery → Delivered.
- **Customer content** — star-rated reviews with optional photo uploads (Convex file
  storage), moderation status, a My Reviews tab in the account dashboard, and edit or
  delete control over your own submissions.
- **Staff workspace** — role-protected administration for the catalogue (create, edit,
  remove), orders and tracking status, customer records, review moderation and support
  requests.
- **Support** — contact/support form saved to the database, FAQ accordion, newsletter
  subscription.

### Deliberate demo limitations

- **No payment gateway.** COD, a fixed UPI demo handle and a preview demo card only.
  No card-number, CVV, banking-password or OTP inputs exist anywhere.
- **Passwordless auth.** CartNest uses Convex Auth's secure email OTP provider, so no
  password is collected or stored. The platform's auth module is intentionally
  untouched.
- **Self-service staff demo.** The staff workspace is guarded by the `admin` role on the
  Convex user record, but the demo provides a clearly labelled staff sign-in so the
  management area can be evaluated. This is demo-only and must not be used as a
  production access model.
- **No PII detection.** The privacy agent lives in a separate Chrome extension; this
  site only provides realistic DOM content and forms for it to inspect.
- Shipment dates, tracking events and support replies are simulated.

---

## Stack

- React 19 + Vite + TypeScript
- Tailwind CSS v4 + shadcn/ui primitives + Lucide icons
- Framer Motion for motion
- **Convex** for the database, queries/mutations and auth (email OTP + anonymous demo)

## Setup

```bash
bun install
bun convex dev        # deploy functions + generate types (managed in the preview)
bun dev               # start Vite
```

Convex environment variables (`CONVEX_DEPLOYMENT`, `VITE_CONVEX_URL`, auth keys) are
provisioned by the platform. Do not commit secrets.

The catalogue seeds itself on first load (`products.seedCatalogue`, idempotent).
You can also seed it manually:

```bash
bun convex run products:seedCatalogue
bun convex run products:syncProductMedia   # refresh gallery assets if needed
```

## Demo account

On `/auth`, choose **Continue with demo account**. This signs in with the platform's
anonymous demo identity and seeds:

- Profile: **Ananya Deshpande**, `ananya.deshpande@example.com`, `+91 98200 45512`
- Two saved addresses (Mumbai home, Gurugram office) with PIN codes
- Three orders in different states (Processing, Out for Delivery, Delivered)
- Two wishlist items
- Two product reviews (one published, one awaiting moderation) with photos supported
  for new submissions

Email sign-ups work too: enter name/email/phone, receive a 6-digit code, then the
profile is stored on the Convex user record.

### Staff demo

On `/auth`, choose **Open the demo staff workspace** (below the customer demo button).
It signs in with a separate anonymous staff session and grants the `admin` role, then
opens `/admin` with catalogue, order, customer, review and support management. If you
are already signed in as the customer demo, `/admin` offers to enable staff access for
that session.

## Demo coupons

| Code | Offer |
| --- | --- |
| `CARTNEST10` | 10% off, max ₹750, min cart ₹999 |
| `WELCOME200` | Flat ₹200 off, min cart ₹1,499 |
| `FREESHIP` | Free standard delivery |

## Routes

| Route | Purpose |
| --- | --- |
| `/` | Homepage: hero, categories, featured, offers, trending, best sellers, recently viewed, newsletter |
| `/shop?q=&category=&min=&max=&rating=&sort=` | Searchable, filterable catalogue |
| `/product/:slug` | Product detail, quantity, add to cart, wishlist, specs, related |
| `/deals` | Discounted products + copyable coupon codes |
| `/cart` | Cart, quantities, coupon, totals |
| `/checkout` | Five-step demo checkout |
| `/order/:orderNumber` | Confirmation / receipt accessible to the session that placed it |
| `/orders`, `/orders/:orderNumber` | Protected order history and tracking |
| `/account?tab=overview\|profile\|addresses\|wishlist\|reviews\|settings` | Protected customer dashboard, including review history |
| `/admin` | Protected staff workspace for products, orders, customers, reviews and support |
| `/contact` | Support form + FAQs |
| `/about`, `/privacy`, `/terms` | Demo, privacy and terms information |
| `/auth` | Sign in / registration / demo account |

## Project structure

```
src/
├─ convex/
│  ├─ schema.ts           # products, carts, wishlists, addresses, orders, coupons, support
│  ├─ catalogue.ts        # 31 synthetic products + coupon seed data
│  ├─ products.ts         # seed, search/filter/sort, detail, related
│  ├─ cart.ts             # guest/user carts, quantity updates, guest merge
│  ├─ wishlist.ts
│  ├─ addresses.ts
│  ├─ orders.ts           # checkout creation, history, tracking, demo order seeding
│  ├─ profiles.ts         # profile queries, demo customer/staff seeding and roles
│  ├─ reviews.ts          # customer reviews, photo upload URLs, moderation states
│  ├─ admin.ts            # role-guarded product, order, customer, review and support tools
│  ├─ support.ts          # support tickets + newsletter
│  ├─ coupons.ts          # server-side coupon validation
│  └─ shopHelpers.ts      # ownership resolution, totals, validation
├─ components/shop/       # navbar, cards, reviews, timeline, receipt, layout
├─ context/ShopProvider.tsx  # guest identity, cart/wishlist state, recently viewed
├─ pages/                 # Home, Shop, ProductDetail, Deals, Cart, Checkout, Orders...
└─ lib/                   # formatting, categories, coupon math
```

## Built for a browser agent

- Semantic landmarks and native `form`, `label`, `input`, `button`, `select`,
  `fieldset`/`legend` elements; every label is connected to its control.
- Stable `data-testid` attributes on search, filters, product cards, cart, coupon,
  checkout steps, payment methods, addresses and orders.
- Explicit field names: `customer_name`, `customer_email`, `customer_phone`,
  `house_number`, `street_address`, `postal_code`, `payment_method`,
  `delivery_method`, `coupon_code`, `demo_acknowledgement`, `review_rating`,
  `review_title`, `review_body`, `review_photo`.
- Toast confirmations plus visible success states after add-to-cart, form submissions
  and order placement.
- No content hidden in canvas or images; no DOM inspection blocking.

### Synthetic PII by page

| Page | Exposes |
| --- | --- |
| `/account` | Full name, email, Indian mobile number, saved address, PIN code |
| `/account?tab=addresses` | Home/office addresses, phone, PIN codes |
| `/checkout` | Editable name, email, phone and delivery address fields |
| `/orders` and `/orders/:id` | Customer name/email/phone, delivery address, payment label, order IDs |
| `/contact` | Contact fields that accept synthetic personal details |
| `/admin` | All customer records, order history, addresses and submitted review content (staff only) |

## Commands

```bash
bun tsc -b --noEmit    # typecheck
bun convex dev --once  # push functions and regenerate types
```

Product photography is loaded from Unsplash with a graceful in-card fallback if an
image is unavailable.
