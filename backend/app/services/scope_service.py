from app.schemas.panel import MarketParams, NewsParams, Panel, PanelConfig, PanelType, new_panel_id

CONTINENTS = {
    "africa": "Africa",
    "asia": "Asia",
    "europe": "Europe",
    "north-america": "North America",
    "oceania": "Oceania",
    "south-america": "South America",
}

REGIONS = [
    {"region": "United States (S&P 500)", "country_fips": "US", "yf_ticker": "^GSPC", "tv_symbol": "SP:SPX"},
    {"region": "France (CAC 40)", "country_fips": "FR", "yf_ticker": "^FCHI", "tv_symbol": "EURONEXT:PX1"},
    {"region": "Germany (DAX)", "country_fips": "GM", "yf_ticker": "^GDAXI", "tv_symbol": "XETR:DAX"},
    {"region": "United Kingdom (FTSE 100)", "country_fips": "UK", "yf_ticker": "^FTSE", "tv_symbol": "TVC:UKX"},
    {"region": "Japan (Nikkei 225)", "country_fips": "JA", "yf_ticker": "^N225", "tv_symbol": "TVC:NI225"},
    {"region": "Europe (Euro Stoxx 50)", "country_fips": None, "yf_ticker": "^STOXX50E", "tv_symbol": "TVC:SX5E"},
    {"region": "Hong Kong (Hang Seng)", "country_fips": "HK", "yf_ticker": "^HSI", "tv_symbol": "TVC:HSI"},
    {"region": "Brazil (Bovespa)", "country_fips": "BR", "yf_ticker": "^BVSP", "tv_symbol": "BMFBOVESPA:IBOV"},
    {"region": "Canada (TSX)", "country_fips": "CA", "yf_ticker": "^GSPTSE", "tv_symbol": "TSX:TSX"},
    {"region": "Australia (ASX 200)", "country_fips": "AS", "yf_ticker": "^AXJO", "tv_symbol": "ASX:XJO"},
    # Verified live against yfinance before adding — ^J203.JO (FTSE/JSE All Share
    # Index, Johannesburg Stock Exchange) returns real daily OHLCV, unlike several
    # other African-index tickers tried first (^EGX30, ^NGSEINDX both 404/delisted
    # on Yahoo). Closes the previously-documented "Africa has zero regions" gap.
    {"region": "South Africa (FTSE/JSE All Share)", "country_fips": "SF", "yf_ticker": "^J203.JO", "tv_symbol": "JSE:J203"},
]

FIPS_LABELS = {
    "US": "United States", "FR": "France", "GM": "Germany", "UK": "United Kingdom",
    "JA": "Japan", "HK": "Hong Kong", "BR": "Brazil", "CA": "Canada", "AS": "Australia",
    "SF": "South Africa",
}

# Which registry entries belong to each continent. None = the borderless Europe (Euro Stoxx 50)
# entry. Africa now has one curated entry (South Africa) — previously resolved to an empty
# panel list (graceful degradation, not an error), kept that pattern for any future continent
# gaps rather than assuming every continent must have coverage.
CONTINENT_FIPS_MAP = {
    "europe": [None, "FR", "GM", "UK"],
    "asia": ["JA", "HK"],
    "north-america": ["US", "CA"],
    "south-america": ["BR"],
    "oceania": ["AS"],
    "africa": ["SF"],
}


def build_scope_config(level: str, region_id: str) -> PanelConfig:
    continent_panel: Panel | None = None
    if level == "world":
        matched_regions = REGIONS
        news_countries: list[str | None] = [None]
    elif level == "continent":
        if region_id not in CONTINENTS:
            raise ValueError(f"Unknown continent id: {region_id}")
        fips_list = CONTINENT_FIPS_MAP.get(region_id, [])
        matched_regions = [r for r in REGIONS if r["country_fips"] in fips_list]
        news_countries = [f for f in fips_list if f is not None]
        # Articles are tagged with continent directly at ingestion time, so this panel
        # covers the whole continent regardless of CONTINENT_FIPS_MAP coverage - it's
        # what keeps continents with no curated market index (e.g. Africa) from getting
        # zero news panels.
        continent_panel = Panel(
            id=new_panel_id(),
            type=PanelType.news,
            title=f"{CONTINENTS[region_id]} News",
            rationale="Default news panel for this scope.",
            params=NewsParams(continent=region_id).model_dump(),
        )
    else:
        raise ValueError(f"Unsupported scope level: {level}")

    panels = [
        Panel(
            id=new_panel_id(),
            type=PanelType.news,
            title="World News" if fips is None else f"{FIPS_LABELS[fips]} News",
            rationale="Default news panel for this scope.",
            params=NewsParams(country=fips).model_dump(),
        )
        for fips in news_countries
    ]
    if continent_panel is not None:
        panels.insert(0, continent_panel)
    panels += [
        Panel(
            id=new_panel_id(),
            type=PanelType.market,
            title=region["region"],
            rationale="Representative index for this scope.",
            params=MarketParams(symbol=region["yf_ticker"]).model_dump(),
        )
        for region in matched_regions
    ]

    return PanelConfig(panels=panels)
