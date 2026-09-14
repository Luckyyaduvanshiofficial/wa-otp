from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

from ..core.config import get_settings
from ..core.errors import UpstreamUnavailable, error_responses
from ..services.pocketbase import wa_collection

router = APIRouter(tags=["meta"])


@router.get("/v1/health", responses=error_responses(UpstreamUnavailable))
async def health(request: Request):
    try:
        await request.app.state.pb.list(wa_collection("settings"), per_page=1)
    except Exception:
        # Uptime monitors alert on the status code — a dead PocketBase must
        # never look healthy.
        return JSONResponse(
            status_code=503, content={"ok": False, "error": "upstream_unavailable"}
        )
    return {
        "ok": True,
        "pb": True,
        "mock_delivery": get_settings().waotp_mock_delivery,
    }
