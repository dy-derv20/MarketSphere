from pydantic import BaseModel


class RegionInfo(BaseModel):
    region: str
    country_fips: str | None
    yf_ticker: str
    tv_symbol: str
