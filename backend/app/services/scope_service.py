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
]


def validate_scope(level: str, id: str) -> str:
    if level == "world" and id == "world":
        return "World"
    if level == "continent":
        if id not in CONTINENTS:
            raise ValueError(f"Unknown continent id: {id}")
        return CONTINENTS[id]
    raise ValueError(f"Unsupported scope level: {level}")
