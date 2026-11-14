export const CATEGORIES = [
  {
    name: "Electronics",
    blurb: "Audio, devices and everyday technology",
  },
  {
    name: "Fashion",
    blurb: "Footwear, knitwear and timepieces",
  },
  {
    name: "Home & Living",
    blurb: "Lighting, kitchen and home decor",
  },
  {
    name: "Beauty",
    blurb: "Skincare, fragrance and grooming",
  },
  {
    name: "Accessories",
    blurb: "Bags, wallets and eyewear",
  },
] as const;

export const ORDER_STATUS_FLOW = [
  "Order Placed",
  "Processing",
  "Shipped",
  "Out for Delivery",
  "Delivered",
] as const;

export type OrderStatus = (typeof ORDER_STATUS_FLOW)[number];

export const SORT_OPTIONS = [
  { value: "relevance", label: "Most relevant" },
  { value: "price-asc", label: "Price: low to high" },
  { value: "price-desc", label: "Price: high to low" },
  { value: "rating", label: "Top rated" },
  { value: "discount", label: "Biggest discount" },
  { value: "newest", label: "Newest arrivals" },
] as const;

export const PAYMENT_METHOD_LABELS = {
  cod: "Cash on Delivery",
  upi: "UPI (demo)",
  card: "Demo card",
} as const;

export const DEMO_ACCOUNT = {
  name: "Ananya Deshpande",
  email: "ananya.deshpande@example.com",
  phone: "+91 98200 45512",
};

export function formatINR(value: number) {
  return `₹${Math.round(value).toLocaleString("en-IN")}`;
}

export function formatDate(timestamp: number) {
  return new Date(timestamp).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function formatDateTime(timestamp: number) {
  return new Date(timestamp).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function statusIndex(status: string) {
  const index = ORDER_STATUS_FLOW.indexOf(status as OrderStatus);
  return index < 0 ? 0 : index;
}

export function statusTone(status: string) {
  switch (status) {
    case "Delivered":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "Out for Delivery":
      return "border-amber-200 bg-amber-50 text-amber-700";
    case "Shipped":
      return "border-sky-200 bg-sky-50 text-sky-700";
    case "Processing":
      return "border-indigo-200 bg-indigo-50 text-indigo-700";
    default:
      return "border-border bg-secondary text-secondary-foreground";
  }
}

export function pluralize(count: number, word: string, plural = `${word}s`) {
  return `${count} ${count === 1 ? word : plural}`;
}
