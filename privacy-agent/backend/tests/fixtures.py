from __future__ import annotations

from typing import Any


def element(
    ref: str,
    name: str,
    *,
    role: str = "button",
    tag: str = "button",
    text: str = "",
    path: str | None = None,
    product: dict[str, Any] | None = None,
    current_text: str | None = None,
    sensitive: str | None = None,
    value_token: str | None = None,
    disabled: bool = False,
) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "ref": ref,
        "tag": tag,
        "role": role,
        "name": name,
        "text": text,
    }
    if path:
        payload["path"] = path
    if product:
        payload["product"] = product
    if current_text is not None:
        payload["currentText"] = current_text
    if sensitive:
        payload["sensitive"] = sensitive
    if value_token:
        payload["valueToken"] = value_token
    if disabled:
        payload["disabled"] = True
    return payload


def page(path: str, elements: list[dict[str, Any]], blocks: list[dict[str, Any]] | None = None) -> dict[str, Any]:
    return {
        "origin": "http://localhost:5173",
        "path": path,
        "title": "CartNest",
        "headings": [],
        "elements": elements,
        "textBlocks": blocks or [],
    }


def home_page(has_icons: bool = True) -> dict[str, Any]:
    return page(
        "/",
        [
            element(
                "e1",
                "Search products",
                role="searchbox",
                tag="input",
                current_text="",
            ),
            element("e2", "Search products", role="button", text="Search"),
            element("e5", "Shopping cart with 0 items", role="link", tag="a", path="/cart"),
        ],
        [{"tag": "h1", "text": "Considered essentials, delivered with care.", "heading": True}],
    )


def shop_page(max_price: str = "") -> dict[str, Any]:
    return page(
        "/shop?q=wireless",
        [
            element("e10", "Max (₹)", role="textbox", tag="input", current_text=max_price),
            element("e11", "Apply price", role="button"),
            element(
                "e12",
                "View Pulse Buds Mini",
                role="link",
                tag="a",
                path="/product/pulse-buds-mini",
                product={"name": "Pulse Buds Mini", "price": 2499, "rating": 4.3, "available": True},
            ),
            element(
                "e13",
                "Add Pulse Buds Mini to cart",
                product={"name": "Pulse Buds Mini", "price": 2499, "rating": 4.3, "available": True},
            ),
            element(
                "e14",
                "View Airwave Pro ANC Headphones",
                role="link",
                tag="a",
                path="/product/airwave-pro-anc-headphones",
                product={
                    "name": "Airwave Pro ANC Headphones",
                    "price": 8999,
                    "rating": 4.7,
                    "available": True,
                },
            ),
        ],
        [
            {"tag": "h1", "text": "Results for “wireless”", "heading": True},
            {"tag": "p", "text": "2 products found for your search"},
        ],
    )


def product_page() -> dict[str, Any]:
    return page(
        "/product/pulse-buds-mini",
        [
            element("e20", "Add Pulse Buds Mini to cart"),
            element("e21", "Buy now"),
        ],
        [
            {"tag": "h1", "text": "Pulse Buds Mini", "heading": True},
            {"tag": "p", "text": "₹2,499"},
        ],
    )


def cart_page() -> dict[str, Any]:
    return page(
        "/cart",
        [
            element("e30", "Pulse Buds Mini", role="link", tag="a", path="/product/pulse-buds-mini"),
            element("e31", "Proceed to checkout", role="link", tag="a", path="/checkout"),
        ],
        [
            {"tag": "h1", "text": "Your cart", "heading": True},
            {"tag": "p", "text": "Pulse Buds Mini · Electronics · In stock"},
            {"tag": "p", "text": "₹2,499"},
        ],
    )


def checkout_page() -> dict[str, Any]:
    return page(
        "/checkout",
        [
            element(
                "e40",
                "Phone number",
                role="textbox",
                tag="input",
                sensitive="PHONE",
                value_token="[PHONE_1]",
            ),
            element(
                "e41",
                "Card number",
                role="textbox",
                tag="input",
                sensitive="CARD",
                value_token="[CARD_1]",
            ),
            element("e42", "Place order"),
        ],
    )
