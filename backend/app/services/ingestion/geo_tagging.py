import pycountry
import pycountry_convert

from app.services.scope_service import FIPS_LABELS

_CONTINENT_CODE_TO_ID = {
    "AF": "africa",
    "AS": "asia",
    "EU": "europe",
    "NA": "north-america",
    "OC": "oceania",
    "SA": "south-america",
}

# scope_service.REGIONS/CONTINENT_FIPS_MAP use FIPS 10-4 codes for the 10 curated
# market-index countries. Everything ingested here is tagged with ISO 3166-1 alpha-2
# (via pycountry, which covers all ~200 countries generically). This crosswalk is the
# only bridge between the two systems, and it only needs to cover those 10 FIPS codes -
# they're the only FIPS values this app ever emits (scope_service.FIPS_LABELS.keys()).
FIPS_TO_ISO2 = {
    "US": "US", "FR": "FR", "GM": "DE", "UK": "GB",
    "JA": "JP", "HK": "HK", "BR": "BR", "CA": "CA", "AS": "AU",
    "SF": "ZA",
}


def country_to_continent(name_or_code: str | None) -> str | None:
    if not name_or_code:
        return None
    try:
        country = pycountry.countries.lookup(name_or_code)
    except LookupError:
        return None
    try:
        continent_code = pycountry_convert.country_alpha2_to_continent_code(country.alpha_2)
    except KeyError:
        return None
    return _CONTINENT_CODE_TO_ID.get(continent_code)


def country_to_iso2(name_or_code: str | None) -> str | None:
    if not name_or_code:
        return None
    try:
        return pycountry.countries.lookup(name_or_code).alpha_2
    except LookupError:
        return None


def fips_to_iso2(fips: str | None) -> str | None:
    if not fips:
        return None
    return FIPS_TO_ISO2.get(fips)


def fips_to_continent(fips: str | None) -> str | None:
    if not fips:
        return None
    return country_to_continent(FIPS_LABELS.get(fips))
