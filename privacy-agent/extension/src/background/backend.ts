import type { PlanRequest, PlanResponse } from "../shared/schema";
import { BACKEND_TIMEOUT_MS, PlanResponseSchema } from "../shared/schema";
import type { PlanEnvelope } from "../shared/messages";

export async function requestPlan(
  backendUrl: string,
  request: PlanRequest,
): Promise<PlanEnvelope> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), BACKEND_TIMEOUT_MS);
  try {
    const response = await fetch(`${backendUrl.replace(/\/+$/, "")}/v1/plan`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
      signal: controller.signal,
    });
    if (!response.ok) {
      let detail = `Backend returned HTTP ${response.status}`;
      if (response.status === 422) detail = "The backend privacy tripwire rejected the payload";
      if (response.status === 413) detail = "The payload exceeded the backend size limit";
      if (response.status === 502) detail = "The AI planner was unavailable";
      return { accepted: false, error: detail };
    }
    const json = await response.json();
    const parsed = PlanResponseSchema.safeParse(json);
    if (!parsed.success) {
      return { accepted: false, error: "The backend returned a plan outside the allowed schema" };
    }
    return { accepted: true, plan: parsed.data, mode: parsed.data.mode };
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      return { accepted: false, error: "The backend request timed out" };
    }
    return {
      accepted: false,
      error: "Could not reach the backend. Check that it is running and the endpoint is allowed.",
    };
  } finally {
    clearTimeout(timer);
  }
}
