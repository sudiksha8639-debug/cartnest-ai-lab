"""Deterministic mock planner.

This is intentionally a rule engine over sanitized element metadata. It never
reads the live DOM, never receives raw PII and never treats page text as
instructions. It exists so the full browser workflow can be demonstrated and
tested without an API key.
"""

from __future__ import annotations

import re
from typing import Iterable

from app.schemas import (
    ClickAction,
    HistoryEntry,
    NavigateAction,
    PageElement,
    PlanRequest,
    PlanResponse,
    TypeAction,
    VerifyCartAction,
)


def _find(elements: Iterable[PageElement], predicate) -> PageElement | None:
    return next((element for element in elements if predicate(element)), None)


def _label(element: PageElement) -> str:
    return f"{element.name} {element.placeholder or ''} {element.context or ''}".strip()


def _is_search_input(element: PageElement) -> bool:
    return (
        element.role in {"searchbox", "textbox"}
        and element.tag in {"input", "textarea"}
        and bool(re.search(r"search", _label(element), re.I))
        and not element.sensitive
    )


def _is_search_button(element: PageElement) -> bool:
    return element.role == "button" and bool(re.search(r"\bsearch\b", element.name, re.I))


def _price_limit(task: str) -> int | None:
    match = re.search(
        r"(?:under|below|less than|max(?:imum)?|upto|up to)\s*(?:₹|rs\.?|inr)?\s*([\d,]+)",
        task,
        re.I,
    )
    if not match:
        return None
    try:
        return int(match.group(1).replace(",", ""))
    except ValueError:
        return None


def _search_query(task: str) -> str:
    cleaned = re.sub(
        r"(?:under|below|less than|max(?:imum)?|upto|up to)\s*(?:₹|rs\.?|inr)?\s*[\d,]+",
        " ",
        task,
        flags=re.I,
    )
    cleaned = re.sub(
        r"\b(find|search(?:\s+for)?|show|looking\s+for|i\s+want|please|the|a|an|"
        r"best[- ]?rated|best|top[- ]?rated|highest[- ]?rated|rated|"
        r"add(?:\s+them)?(?:\s+to)?(?:\s+my)?(?:\s+cart)?|to\s+my\s+cart|"
        r"my\s+cart|products?|items?)\b",
        " ",
        cleaned,
        flags=re.I,
    )
    words = [word for word in re.split(r"[^a-zA-Z0-9]+", cleaned) if len(word) > 2]
    if not words:
        return ""
    lowered = [word.lower() for word in words]
    # CartNest search is a literal substring match. "wireless headphones" in
    # the task describes the class of product; the useful catalogue term is the
    # adjective that matches the available products.
    if "wireless" in lowered and ("headphones" in lowered or "earbuds" in lowered):
        return "wireless"
    if "headphones" in lowered:
        return "headphones"
    return " ".join(words[:3])


def _selected_from_history(history: list[HistoryEntry]) -> str | None:
    for entry in reversed(history):
        add = re.search(r"Add ([^”\"]+) to cart", entry.note, re.I)
        if add:
            return add.group(1).strip()
        view = re.search(r"View ([^”\"]+)", entry.note)
        if view:
            return view.group(1).strip()
    return None


def _added_from_history(history: list[HistoryEntry]) -> str | None:
    for entry in reversed(history):
        if entry.action_type == "click" and entry.status == "success":
            add = re.search(r"Add ([^”\"]+) to cart", entry.note, re.I)
            if add:
                return add.group(1).strip()
    return None


def _has_verified(history: list[HistoryEntry]) -> bool:
    return any(
        entry.action_type == "verify_cart" and entry.status == "success" for entry in history
    )


def _max_price_input(page_elements: list[PageElement]) -> PageElement | None:
    return _find(
        page_elements,
        lambda element: element.role == "textbox"
        and bool(re.search(r"max", _label(element), re.I))
        and bool(re.search(r"price|₹|amount", _label(element), re.I)),
    )


def _apply_price_button(elements: list[PageElement]) -> PageElement | None:
    return _find(
        elements,
        lambda element: element.role == "button"
        and bool(re.search(r"apply\s+(price|filter)", element.name, re.I)),
    )


def _product_candidates(
    elements: list[PageElement], limit: int | None
) -> list[tuple[str, float, PageElement, PageElement | None]]:
    by_name: dict[str, tuple[str, float, PageElement, PageElement | None]] = {}
    for element in elements:
        product = element.product
        if not product or not product.name:
            continue
        if product.available is False:
            continue
        if limit is not None and (product.price is None or product.price > limit):
            continue
        link = _find(
            elements,
            lambda candidate: candidate.role == "link"
            and (
                candidate.name.lower() == f"view {product.name}".lower()
                or (
                    candidate.path is not None
                    and candidate.path.startswith("/product/")
                    and product.name.lower() in candidate.name.lower()
                )
            ),
        )
        add = _find(
            elements,
            lambda candidate: candidate.role == "button"
            and candidate.name.lower() == f"add {product.name} to cart".lower(),
        )
        key = product.name.strip().lower()
        if key not in by_name:
            by_name[key] = (
                product.name.strip(),
                product.rating or 0.0,
                link or add or element,
                add,
            )
    return list(by_name.values())


def _sensitive_task_plan(request: PlanRequest) -> PlanResponse | None:
    task = request.task
    elements = request.page.elements
    if re.search(r"\b(password|otp|one[- ]time|card number|cvv|pin\b)", task, re.I):
        return PlanResponse(
            actions=[],
            reasoning="Password, OTP, card and banking values are never auto-filled.",
            done=True,
            completion="This task requires manual entry. The agent cannot disclose high-risk credentials.",
            mode="mock",
        )

    wants = None
    if re.search(r"\bphone|mobile\b", task, re.I):
        wants = "PHONE"
    elif re.search(r"\be-?mail\b", task, re.I):
        wants = "EMAIL"
    elif re.search(r"\baddress\b", task, re.I):
        wants = "ADDRESS"
    elif re.search(r"\bname\b", task, re.I):
        wants = "PERSON"
    if not wants:
        return None

    if any(
        entry.action_type == "type" and entry.status == "success" for entry in request.history
    ):
        return PlanResponse(
            actions=[],
            reasoning="The sensitive entry already completed after explicit approval.",
            done=True,
            completion="Sensitive value entered once after approval. The approval was not reused.",
            mode="mock",
        )

    field = _find(
        elements,
        lambda element: element.sensitive == wants
        and element.role in {"textbox", "searchbox", "combobox"},
    )
    if not field:
        return PlanResponse(
            actions=[],
            reasoning="No matching sensitive field was found in the minimized page context.",
            done=True,
            completion="No sensitive entry was proposed.",
            mode="mock",
        )

    token_match = re.search(r"\[" + wants + r"_\d+\]", task)
    token = token_match.group(0) if token_match else field.value_token
    if not token:
        return PlanResponse(
            actions=[],
            reasoning="No locally vaulted value is available for this sensitive field.",
            done=True,
            completion="Sensitive entry was not attempted because no approved value was available.",
            mode="mock",
        )
    return PlanResponse(
        actions=[TypeAction(type="type", ref=field.ref, placeholder=token)],
        reasoning="A sensitive value is available locally. Proposing it requires one-time user approval.",
        done=False,
        mode="mock",
    )


def plan(request: PlanRequest) -> PlanResponse:
    page = request.page
    path = page.path
    elements = page.elements
    history = request.history
    task = request.task

    if re.search(r"\b(summarize|summarise|inspect|review this page|privacy check)\b", task, re.I) and not re.search(
        r"\b(add|cart|buy|search|find)\b", task, re.I
    ):
        return PlanResponse(
            actions=[],
            reasoning="The task only requires local inspection; no browser actions are necessary.",
            done=True,
            completion="Page inspected locally. No personal data was transmitted and no actions were required.",
            mode="mock",
        )

    sensitive = _sensitive_task_plan(request)
    if sensitive is not None:
        return sensitive

    if _has_verified(history):
        selected = _selected_from_history(history) or "the selected product"
        return PlanResponse(
            actions=[],
            reasoning="The cart was verified after the add-to-cart action.",
            done=True,
            completion=f"Verified that {selected} is in your cart. Checkout was not attempted.",
            mode="mock",
        )

    limit = _price_limit(task)
    query = _search_query(task)
    lowered_task = task.lower()
    shopping_task = bool(
        re.search(r"\b(add|cart|buy|find|search|product|price|headphones?|earbuds?)\b", lowered_task)
    )
    if not shopping_task:
        return PlanResponse(
            actions=[],
            reasoning="The task did not map to a supported shopping action.",
            done=True,
            completion="No browser action was required. Nothing was transmitted beyond the minimized page context.",
            mode="mock",
        )

    if path == "/" or not path.startswith(("/shop", "/product", "/cart")):
        search = _find(elements, _is_search_input)
        if search and query:
            if (search.current_text or "").strip().lower() != query.lower():
                return PlanResponse(
                    actions=[TypeAction(type="type", ref=search.ref, text=query, clear=True)],
                    reasoning=f"Enter “{query}” into the catalogue search field.",
                    done=False,
                    mode="mock",
                )
            submit = _find(elements, _is_search_button)
            if submit:
                return PlanResponse(
                    actions=[ClickAction(type="click", ref=submit.ref)],
                    reasoning="Run the catalogue search with the local query.",
                    done=False,
                    mode="mock",
                )
        if query:
            return PlanResponse(
                actions=[NavigateAction(type="navigate", path=f"/shop?q={query}")],
                reasoning="Open the catalogue results for the local query.",
                done=False,
                mode="mock",
            )

    if path.startswith("/shop"):
        max_input = _max_price_input(elements)
        if limit is not None and max_input:
            current = (max_input.current_text or "").replace(",", "").strip()
            if current != str(limit):
                return PlanResponse(
                    actions=[
                        TypeAction(type="type", ref=max_input.ref, text=str(limit), clear=True)
                    ],
                    reasoning=f"Apply the price ceiling of ₹{limit:,}.",
                    done=False,
                    mode="mock",
                )
            apply_button = _apply_price_button(elements)
            already_applied = any(
                entry.action_type == "click" and re.search(r"apply price", entry.note, re.I)
                for entry in history
            )
            if apply_button and not already_applied:
                return PlanResponse(
                    actions=[ClickAction(type="click", ref=apply_button.ref)],
                    reasoning="Apply the local price filter.",
                    done=False,
                    mode="mock",
                )

        candidates = _product_candidates(elements, limit)
        if candidates:
            best = max(candidates, key=lambda item: item[1])
            name, rating, target, _add = best
            return PlanResponse(
                actions=[ClickAction(type="click", ref=target.ref)],
                reasoning=f"Selected {name} with a rating of {rating:.1f} and a price within the stated budget.",
                done=False,
                mode="mock",
            )

        if query and not any(entry.action_type == "navigate" for entry in history):
            return PlanResponse(
                actions=[NavigateAction(type="navigate", path="/shop?q=audio")],
                reasoning="No matching product appeared in the literal search results; trying the broader audio category.",
                done=False,
                mode="mock",
            )
        return PlanResponse(
            actions=[],
            reasoning="No product in the minimized context matched the stated budget.",
            done=True,
            completion="No matching product was found. No cart action was taken.",
            mode="mock",
        )

    if path.startswith("/product/"):
        added = _added_from_history(history)
        if added:
            return PlanResponse(
                actions=[NavigateAction(type="navigate", path="/cart")],
                reasoning="Open the cart to verify the add-to-cart result.",
                done=False,
                mode="mock",
            )
        add_button = _find(
            elements,
            lambda element: element.role == "button"
            and bool(re.search(r"add\b.*\bto cart", element.name, re.I))
            and not element.disabled,
        )
        if add_button:
            return PlanResponse(
                actions=[ClickAction(type="click", ref=add_button.ref)],
                reasoning="Add the selected product to the cart. Checkout remains blocked.",
                done=False,
                mode="mock",
            )
        return PlanResponse(
            actions=[],
            reasoning="The add-to-cart control was not present in the minimized context.",
            done=True,
            completion="The product could not be added because the control was unavailable.",
            mode="mock",
        )

    if path.startswith("/cart"):
        selected = _added_from_history(history) or _selected_from_history(history)
        if not selected:
            links = [
                element
                for element in elements
                if element.role == "link" and (element.path or "").startswith("/product/")
            ]
            selected = links[0].name if links else None
        if selected:
            return PlanResponse(
                actions=[VerifyCartAction(type="verify_cart", product_name=selected)],
                reasoning="Verify that the selected product is present in the cart.",
                done=False,
                mode="mock",
            )
        return PlanResponse(
            actions=[],
            reasoning="No product reference was available for cart verification.",
            done=True,
            completion="The cart could not be verified.",
            mode="mock",
        )

    if shopping_task:
        return PlanResponse(
            actions=[
                NavigateAction(
                    type="navigate",
                    path=f"/shop?q={query}" if query else "/shop",
                )
            ],
            reasoning="Leave the non-shopping page and continue the task in the catalogue.",
            done=False,
            mode="mock",
        )

    return PlanResponse(
        actions=[],
        reasoning="No supported action was found for this page.",
        done=True,
        completion="The page did not contain a supported shopping action.",
        mode="mock",
    )
