from __future__ import annotations

from typing import Annotated, Literal, Union

from pydantic import BaseModel, ConfigDict, Field, model_validator
from pydantic.alias_generators import to_camel

MAX_ELEMENTS = 70
MAX_BLOCKS = 36
MAX_ACTIONS = 3
MAX_BODY_BYTES = 64_000


class APIModel(BaseModel):
    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        extra="forbid",
        str_strip_whitespace=True,
    )


PIIType = Literal[
    "PERSON",
    "EMAIL",
    "PHONE",
    "ADDRESS",
    "PIN",
    "GOVT_ID",
    "CARD",
    "BANK",
    "UPI",
    "PASSWORD",
    "OTP",
    "OTHER",
]


class CategoryCount(APIModel):
    type: PIIType
    count: int = Field(ge=0)


class ProductInfo(APIModel):
    name: str = Field(min_length=1, max_length=140)
    price: float | None = Field(default=None, ge=0)
    rating: float | None = Field(default=None, ge=0, le=5)
    available: bool | None = None


class OptionInfo(APIModel):
    value: str = Field(max_length=80)
    label: str = Field(max_length=120)


class PageElement(APIModel):
    ref: str = Field(pattern=r"^e\d+$")
    tag: str = Field(max_length=20)
    role: str = Field(max_length=30)
    name: str = Field(max_length=220)
    text: str = Field(default="", max_length=420)
    type: str | None = Field(default=None, max_length=30)
    placeholder: str | None = Field(default=None, max_length=140)
    autocomplete: str | None = Field(default=None, max_length=80)
    disabled: bool | None = None
    sensitive: PIIType | None = None
    value_token: str | None = Field(default=None, max_length=40)
    current_text: str | None = Field(default=None, max_length=180)
    path: str | None = Field(default=None, max_length=220)
    options: list[OptionInfo] | None = Field(default=None, max_length=24)
    context: str | None = Field(default=None, max_length=280)
    product: ProductInfo | None = None


class TextBlock(APIModel):
    ref: str | None = Field(default=None, max_length=12)
    tag: str = Field(max_length=20)
    text: str = Field(max_length=520)
    heading: bool | None = None


class PageContext(APIModel):
    origin: str = Field(max_length=120)
    path: str = Field(max_length=220)
    title: str = Field(max_length=180)
    headings: list[str] = Field(default_factory=list, max_length=10)
    elements: list[PageElement] = Field(default_factory=list, max_length=MAX_ELEMENTS)
    text_blocks: list[TextBlock] = Field(default_factory=list, max_length=MAX_BLOCKS)


class HistoryEntry(APIModel):
    action_type: str = Field(max_length=24)
    status: Literal["success", "failed", "blocked"]
    note: str = Field(max_length=220)


class ClickAction(APIModel):
    type: Literal["click"]
    ref: str = Field(pattern=r"^e\d+$")


class TypeAction(APIModel):
    type: Literal["type"]
    ref: str = Field(pattern=r"^e\d+$")
    text: str | None = Field(default=None, max_length=200)
    placeholder: str | None = Field(default=None, pattern=r"^\[[A-Z_]+_\d+\]$")
    clear: bool | None = None

    @model_validator(mode="after")
    def exactly_one_value(self) -> "TypeAction":
        if bool(self.text) == bool(self.placeholder):
            raise ValueError("exactly one of text or placeholder is required")
        return self


class SelectAction(APIModel):
    type: Literal["select"]
    ref: str = Field(pattern=r"^e\d+$")
    option: str = Field(max_length=120)


class ScrollAction(APIModel):
    type: Literal["scroll"]
    direction: Literal["up", "down"]
    amount: int | None = Field(default=None, ge=100, le=2400)


class NavigateAction(APIModel):
    type: Literal["navigate"]
    path: str = Field(min_length=1, max_length=220)


class WaitAction(APIModel):
    type: Literal["wait"]
    ms: int | None = Field(default=None, ge=0, le=4000)
    ref: str | None = Field(default=None, pattern=r"^e\d+$")
    timeout_ms: int | None = Field(default=None, ge=200, le=8000)


class VerifyAction(APIModel):
    type: Literal["verify"]
    text: str = Field(min_length=1, max_length=160)
    ref: str | None = Field(default=None, pattern=r"^e\d+$")


class VerifyCartAction(APIModel):
    type: Literal["verify_cart"]
    product_name: str = Field(min_length=1, max_length=140)


Action = Annotated[
    Union[
        ClickAction,
        TypeAction,
        SelectAction,
        ScrollAction,
        NavigateAction,
        WaitAction,
        VerifyAction,
        VerifyCartAction,
    ],
    Field(discriminator="type"),
]


class PlanRequest(APIModel):
    task: str = Field(min_length=1, max_length=600)
    page: PageContext
    history: list[HistoryEntry] = Field(default_factory=list, max_length=20)


class PlanResponse(APIModel):
    actions: list[Action] = Field(default_factory=list, max_length=MAX_ACTIONS)
    reasoning: str = Field(max_length=500)
    done: bool = False
    completion: str | None = Field(default=None, max_length=300)
    mode: Literal["mock", "llm"] = "mock"
