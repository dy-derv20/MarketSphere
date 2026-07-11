from fastapi import APIRouter

from app.schemas.regions import RegionInfo
from app.services.scope_service import REGIONS

router = APIRouter(prefix="/regions", tags=["regions"])


@router.get("", response_model=list[RegionInfo])
async def list_regions():
    return REGIONS
