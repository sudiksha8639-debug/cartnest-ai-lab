from __future__ import annotations

import logging
from typing import Any

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import settings
from app.llm.mock import plan as mock_plan
from app.llm.openai_compat import LLMError, plan_with_llm
from app.schemas import MAX_BODY_BYTES, PlanRequest, PlanResponse
from app.security.tripwire import PrivacyTripwireError, assert_safe, inspect_payload

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger("privacy_agent")

app = FastAPI(
    title="CartNest Privacy Agent Backend",
    version="1.0.0",
    description="Minimized-page planner. Rejects raw personal data independently of the client.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=list(settings.allowed_origins),
    allow_origin_regex=r"^chrome-extension://[a-p]{32}$",
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
    max_age=600,
)


@app.get("/health")
async def health() -> dict[str, Any]:
    mode = settings.effective_mode
    return {
        "status": "ok",
        "mode": mode,
        "llmConfigured": bool(settings.llm_api_key),
        "tripwire": "enabled",
    }


@app.post("/v1/plan")
async def create_plan(request: Request) -> JSONResponse:
    raw = await request.body()
    if len(raw) > MAX_BODY_BYTES:
        return JSONResponse(
            status_code=413,
            content={"detail": "Payload is too large."},
        )

    try:
        payload = PlanRequest.model_validate_json(raw)
    except ValueError:
        return JSONResponse(
            status_code=422,
            content={"detail": "The request did not match the expected schema."},
        )

    try:
        assert_safe(payload.model_dump(by_alias=True, mode="json"))
    except PrivacyTripwireError:
        # Never log page text, paths or the rejected values.
        logger.warning("privacy_tripwire_rejected elements=%d", len(payload.page.elements))
        return JSONResponse(
            status_code=422,
            content={"detail": "Request rejected by the privacy tripwire."},
        )

    try:
        if settings.effective_mode == "llm":
            plan = plan_with_llm(payload, settings)
        else:
            plan = mock_plan(payload)
    except LLMError:
        logger.error("llm_planner_failed elements=%d", len(payload.page.elements))
        return JSONResponse(
            status_code=502,
            content={"detail": "The configured AI planner is unavailable."},
        )

    response = plan.model_dump(by_alias=True, mode="json", exclude_none=True)
    try:
        if inspect_payload(response):
            logger.warning("privacy_tripwire_rejected_response elements=%d", len(payload.page.elements))
            return JSONResponse(
                status_code=502,
                content={"detail": "The planner returned unsafe content and was blocked."},
            )
    except PrivacyTripwireError:
        return JSONResponse(
            status_code=502,
            content={"detail": "The planner returned unsafe content and was blocked."},
        )

    logger.info(
        "plan_ok mode=%s actions=%d done=%s elements=%d",
        plan.mode,
        len(plan.actions),
        plan.done,
        len(payload.page.elements),
    )
    return JSONResponse(content=response)


@app.exception_handler(Exception)
async def unhandled_error(_request: Request, _error: Exception) -> JSONResponse:
    # Never include exception text or tracebacks, which could contain payload fragments.
    logger.error("unhandled_backend_error")
    return JSONResponse(status_code=500, content={"detail": "Internal planner error."})
