"""Server-side privacy tripwire.

The backend never trusts the extension's gate flag. Every string in the incoming
payload is inspected independently. Error responses never echo the payload.
"""

from __future__ import annotations

import re
from typing import Any, Iterable

PLACEHOLDER_RE = re.compile(r"\[[A-Z_]+_\d+\]")
EMAIL_RE = re.compile(r"\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b", re.I)
UPI_RE = re.compile(
    r"\b[A-Z0-9._-]{2,}@(?:okhdfcbank|oksbi|okaxis|okicici|paytm|ybl|upi|apl)\b", re.I
)
PHONE_RE = re.compile(
    r"(?:\+91[\s-]?)?(?:0)?[6-9]\d{4}[\s-]?\d{5}\b|\+\d{1,3}[\s-]?\d{3,4}[\s-]?\d{3,4}[\s-]?\d{3,4}\b"
)
CARD_RE = re.compile(r"\b(?:\d[ -]?){13,19}\b")
PAN_RE = re.compile(r"\b[A-Z]{5}\d{4}[A-Z]\b")
AADHAAR_RE = re.compile(r"\b\d{4}[\s-]\d{4}[\s-]\d{4}\b")
BANK_LABEL_RE = re.compile(
    r"\b(?:account number|a/c no|account no|bank account)\b\s*[:\-]?\s*[0-9][0-9 -]{7,22}",
    re.I,
)
NAME_LABEL_RE = re.compile(
    r"\b(?:full name|customer name|recipient name|name)\b\s*[:\-]\s*[A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3}"
)
ADDRESS_LABEL_RE = re.compile(
    r"\b(?:address|delivery address|shipping address)\b\s*[:\-]\s*[^\n|]{10,140}", re.I
)


class PrivacyTripwireError(Exception):
    """Raised when residual personal data is detected. Do not attach the payload."""


def _luhn(value: str) -> bool:
    digits = re.sub(r"\D", "", value)
    if not 13 <= len(digits) <= 19:
        return False
    total = 0
    double = False
    for char in reversed(digits):
        digit = int(char)
        if double:
            digit *= 2
            if digit > 9:
                digit -= 9
        total += digit
        double = not double
    return total % 10 == 0


def scan_text(text: str) -> list[str]:
    cleaned = PLACEHOLDER_RE.sub(" ", text)
    findings: list[str] = []
    if EMAIL_RE.search(cleaned) or UPI_RE.search(cleaned):
        findings.append("EMAIL")
    if PHONE_RE.search(cleaned):
        findings.append("PHONE")
    for match in CARD_RE.finditer(cleaned):
        if _luhn(match.group(0)):
            findings.append("CARD")
            break
    if PAN_RE.search(cleaned):
        findings.append("GOVT_ID")
    if AADHAAR_RE.search(cleaned) or (
        re.search(r"\b(aadhaar|aadhar|uidai)\b", cleaned, re.I)
        and re.search(r"\b\d{12}\b", cleaned)
    ):
        findings.append("GOVT_ID")
    if NAME_LABEL_RE.search(cleaned):
        findings.append("PERSON")
    if ADDRESS_LABEL_RE.search(cleaned):
        findings.append("ADDRESS")
    if BANK_LABEL_RE.search(cleaned):
        findings.append("BANK")
    return sorted(set(findings))


def _strings(value: Any) -> Iterable[str]:
    if isinstance(value, str):
        yield value
    elif isinstance(value, dict):
        for key, item in value.items():
            if isinstance(key, str):
                yield key
            yield from _strings(item)
    elif isinstance(value, (list, tuple)):
        for item in value:
            yield from _strings(item)


def inspect_payload(payload: Any) -> list[str]:
    findings: set[str] = set()
    for text in _strings(payload):
        if len(text) > 2_000:
            raise PrivacyTripwireError("oversized field")
        findings.update(scan_text(text))
    return sorted(findings)


def assert_safe(payload: Any) -> None:
    if inspect_payload(payload):
        raise PrivacyTripwireError("residual personal data")
