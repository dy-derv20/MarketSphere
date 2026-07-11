from fastapi import APIRouter, HTTPException

from app.schemas.scope import ContinentInfo, ScopeConfigResponse
from app.services.scope_service import CONTINENTS, build_scope_config

router = APIRouter(prefix="/scope", tags=["scope"])


@router.get("/continents", response_model=list[ContinentInfo])
async def list_continents():
    return [{"id": id, "label": label} for id, label in CONTINENTS.items()]


@router.get("", response_model=ScopeConfigResponse)
async def get_scope(region: str = "world"):
    level = "world" if region == "world" else "continent"
    try:
        config = build_scope_config(level, region)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    return ScopeConfigResponse(scopeConfig=config)
