from app.services.scope_service import REGIONS

COUNTRY_FIPS_LOOKUP = {
    "us": "US", "usa": "US", "united states": "US", "america": "US",
    "fr": "FR", "france": "FR",
    "gm": "GM", "de": "GM", "germany": "GM",
    "uk": "UK", "gb": "UK", "united kingdom": "UK", "britain": "UK", "great britain": "UK", "england": "UK",
    "ja": "JA", "jp": "JA", "japan": "JA",
    "hk": "HK", "hong kong": "HK",
    "br": "BR", "brazil": "BR",
    "ca": "CA", "canada": "CA",
    "as": "AS", "au": "AS", "australia": "AS",
}

COMPANIES = {
    "apple": {"ticker": "AAPL", "country_fips": "US"},
    "microsoft": {"ticker": "MSFT", "country_fips": "US"},
    "amazon": {"ticker": "AMZN", "country_fips": "US"},
    "alphabet": {"ticker": "GOOGL", "country_fips": "US"},
    "google": {"ticker": "GOOGL", "country_fips": "US"},
    "tesla": {"ticker": "TSLA", "country_fips": "US"},
    "nvidia": {"ticker": "NVDA", "country_fips": "US"},
    "meta": {"ticker": "META", "country_fips": "US"},
    "jpmorgan": {"ticker": "JPM", "country_fips": "US"},
    "exxonmobil": {"ticker": "XOM", "country_fips": "US"},
    "walmart": {"ticker": "WMT", "country_fips": "US"},
    "lvmh": {"ticker": "MC.PA", "country_fips": "FR"},
    "totalenergies": {"ticker": "TTE.PA", "country_fips": "FR"},
    "sanofi": {"ticker": "SAN.PA", "country_fips": "FR"},
    "loreal": {"ticker": "OR.PA", "country_fips": "FR"},
    "sap": {"ticker": "SAP.DE", "country_fips": "GM"},
    "siemens": {"ticker": "SIE.DE", "country_fips": "GM"},
    "volkswagen": {"ticker": "VOW3.DE", "country_fips": "GM"},
    "allianz": {"ticker": "ALV.DE", "country_fips": "GM"},
    "hsbc": {"ticker": "HSBA.L", "country_fips": "UK"},
    "shell": {"ticker": "SHEL.L", "country_fips": "UK"},
    "astrazeneca": {"ticker": "AZN.L", "country_fips": "UK"},
    "bp": {"ticker": "BP.L", "country_fips": "UK"},
    "toyota": {"ticker": "7203.T", "country_fips": "JA"},
    "sony": {"ticker": "6758.T", "country_fips": "JA"},
    "nintendo": {"ticker": "7974.T", "country_fips": "JA"},
    "softbank": {"ticker": "9984.T", "country_fips": "JA"},
    "tencent": {"ticker": "0700.HK", "country_fips": "HK"},
    "alibaba": {"ticker": "9988.HK", "country_fips": "HK"},
    "petrobras": {"ticker": "PETR4.SA", "country_fips": "BR"},
    "vale": {"ticker": "VALE3.SA", "country_fips": "BR"},
    "shopify": {"ticker": "SHOP.TO", "country_fips": "CA"},
    "royal bank of canada": {"ticker": "RY.TO", "country_fips": "CA"},
    "rbc": {"ticker": "RY.TO", "country_fips": "CA"},
    "bhp": {"ticker": "BHP.AX", "country_fips": "AS"},
    "commonwealth bank": {"ticker": "CBA.AX", "country_fips": "AS"},
    "cba": {"ticker": "CBA.AX", "country_fips": "AS"},
}


def resolve_country_fips(name_or_code: str) -> str | None:
    return COUNTRY_FIPS_LOOKUP.get(name_or_code.strip().lower())


def resolve_company(name: str) -> dict | None:
    entry = COMPANIES.get(name.strip().lower())
    if entry is None:
        return None
    region = next((r for r in REGIONS if r["country_fips"] == entry["country_fips"]), None)
    return {
        "ticker": entry["ticker"],
        "country_fips": entry["country_fips"],
        "index_symbol": region["yf_ticker"] if region else None,
        "region": region["region"] if region else None,
    }
