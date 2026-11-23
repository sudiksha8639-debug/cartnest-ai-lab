import type { PIIType } from "../../src/shared/schema";

export interface PIIFixture {
  id: string;
  text: string;
  context?: string;
  expected: { type: PIIType; value: string }[];
}

export const PII_DATASET: PIIFixture[] = [
  {
    id: "email-basic",
    text: "Write to synthetic.user@example.com for a demo receipt.",
    expected: [{ type: "EMAIL", value: "synthetic.user@example.com" }],
  },
  {
    id: "email-uppercase",
    text: "DEMO.CUSTOMER@EXAMPLE.ORG",
    expected: [{ type: "EMAIL", value: "DEMO.CUSTOMER@EXAMPLE.ORG" }],
  },
  {
    id: "phone-india-plus91",
    text: "Call +91 98765 43210 before delivery.",
    expected: [{ type: "PHONE", value: "+91 98765 43210" }],
  },
  {
    id: "phone-india-plain",
    text: "Mobile: 9876543210",
    expected: [{ type: "PHONE", value: "9876543210" }],
  },
  {
    id: "phone-india-hyphen",
    text: "Alternate contact 98765-43210.",
    expected: [{ type: "PHONE", value: "98765-43210" }],
  },
  {
    id: "name-labelled",
    text: "Name: Ananya Deshpande",
    expected: [{ type: "PERSON", value: "Ananya Deshpande" }],
  },
  {
    id: "name-customer",
    text: "Customer name: Rohan Mehta",
    expected: [{ type: "PERSON", value: "Rohan Mehta" }],
  },
  {
    id: "address-labelled",
    text: "Delivery address: 14 Marine Drive, Mumbai 400001",
    expected: [
      { type: "ADDRESS", value: "14 Marine Drive, Mumbai 400001" },
      { type: "PIN", value: "400001" },
    ],
  },
  {
    id: "address-lines",
    text: "Flat 4B, Palm Grove, Juhu Road\nMumbai 400049",
    context: "Saved delivery address",
    expected: [
      { type: "ADDRESS", value: "Flat 4B, Palm Grove, Juhu Road" },
      { type: "PIN", value: "400049" },
    ],
  },
  {
    id: "pin-code",
    text: "PIN code: 400001",
    expected: [{ type: "PIN", value: "400001" }],
  },
  {
    id: "pan",
    text: "PAN ABCDE1234F on file.",
    expected: [{ type: "GOVT_ID", value: "ABCDE1234F" }],
  },
  {
    id: "aadhaar",
    text: "Aadhaar 1234 5678 9012",
    expected: [{ type: "GOVT_ID", value: "1234 5678 9012" }],
  },
  {
    id: "card",
    text: "Demo card 4111 1111 1111 1111",
    expected: [{ type: "CARD", value: "4111 1111 1111 1111" }],
  },
  {
    id: "upi",
    text: "Pay via ananya@okhdfcbank",
    expected: [{ type: "UPI", value: "ananya@okhdfcbank" }],
  },
  {
    id: "bank-account",
    text: "Account number: 123456789012",
    expected: [{ type: "BANK", value: "123456789012" }],
  },
  {
    id: "multiple",
    text: "Email a@b.co or call 9876543210.",
    expected: [
      { type: "EMAIL", value: "a@b.co" },
      { type: "PHONE", value: "9876543210" },
    ],
  },
  {
    id: "negative-price",
    text: "Save ₹2,499 on the Pulse Buds Mini.",
    expected: [],
  },
  {
    id: "negative-rating",
    text: "Rated 4.3 from 874 reviews.",
    expected: [],
  },
  {
    id: "negative-order",
    text: "Order CN-2026-FSMR4A is out for delivery.",
    expected: [],
  },
  {
    id: "negative-product-name",
    text: "Product name: Airwave Pro ANC Headphones",
    expected: [],
  },
  {
    id: "negative-adjective",
    text: "Only 8 left in stock. Free delivery over ₹999.",
    expected: [],
  },
  {
    id: "negative-short-number",
    text: "Max 10 per order.",
    expected: [],
  },
];
