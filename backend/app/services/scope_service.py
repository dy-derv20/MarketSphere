CONTINENTS = {
    "africa": "Africa",
    "asia": "Asia",
    "europe": "Europe",
    "north-america": "North America",
    "oceania": "Oceania",
    "south-america": "South America",
}


def validate_scope(level: str, id: str) -> str:
    if level == "world" and id == "world":
        return "World"
    if level == "continent":
        if id not in CONTINENTS:
            raise ValueError(f"Unknown continent id: {id}")
        return CONTINENTS[id]
    raise ValueError(f"Unsupported scope level: {level}")
