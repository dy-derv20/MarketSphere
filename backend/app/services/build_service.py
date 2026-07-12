from google.genai import types
from pydantic import BaseModel

from app.schemas.classifier import BuildOp, ClassifierEntities
from app.schemas.panel import MarketParams, NewsParams, Panel, PanelConfig, PanelType, new_panel_id
from app.services.entity_resolver import resolve_continent, resolve_country_for_news
from app.services.gemini_service import generate_with_retry
from app.services.scope_service import CONTINENTS, REGIONS

MODEL = "gemini-flash-latest"

VALID_SYMBOLS = sorted({r["yf_ticker"] for r in REGIONS})
VALID_CONTINENTS = sorted(CONTINENTS.keys())

SYSTEM_INSTRUCTION = (
    "You compose a panel-based workspace for a financial news/markets dashboard. Given the "
    "user's request and (if provided) the current workspace, return the FULL resulting set of "
    "panels (not a diff). Each panel is either type 'news' or type 'market'. "
    "News panel params: country (any real country name, e.g. 'Nigeria' or 'Japan' - not limited "
    "to a fixed list) OR continent (one of the allowed continent ids below) - use at most one of "
    "the two, or omit both for global/world news; plus query, timespan, max. "
    f"Allowed continent ids: {VALID_CONTINENTS}. "
    "Market panel params: symbol - a valid ticker from the allowed list below; range; interval. "
    f"Allowed market symbols: {VALID_SYMBOLS}. Market symbols ARE a fixed list - if the user asks "
    "for a company/index not in it, omit that market panel rather than inventing a symbol; this "
    "restriction does not apply to news panels. Give each panel a short display title and a "
    "one-line rationale."
)


class _GeneratedPanel(BaseModel):
    type: PanelType
    title: str
    rationale: str
    params: NewsParams | MarketParams


class _GeneratedConfig(BaseModel):
    panels: list[_GeneratedPanel]


def _build_prompt(entities: ClassifierEntities, build_op: BuildOp | None, current_config: PanelConfig | None) -> str:
    lines = [
        f"User wants: countries={entities.countries}, companies={entities.companies}, "
        f"topics={entities.topics}",
        f"Operation: {build_op.value if build_op else 'replace'}",
    ]
    if current_config and current_config.panels:
        lines.append(f"Current workspace panels: {[p.model_dump() for p in current_config.panels]}")
    else:
        lines.append("Current workspace is empty.")
    return "\n".join(lines)


def _to_panel(generated: _GeneratedPanel) -> Panel:
    return Panel(
        id=new_panel_id(),
        type=generated.type,
        title=generated.title,
        rationale=generated.rationale,
        params=generated.params.model_dump(),
    )


async def _generate_panels(prompt: str, error_feedback: str | None = None) -> list[Panel]:
    full_prompt = prompt if not error_feedback else f"{prompt}\n\nCorrection needed: {error_feedback}"
    response = await generate_with_retry(
        model=MODEL,
        contents=full_prompt,
        config=types.GenerateContentConfig(
            system_instruction=SYSTEM_INSTRUCTION,
            response_mime_type="application/json",
            response_schema=_GeneratedConfig,
        ),
    )
    return [_to_panel(p) for p in response.parsed.panels]


def _validate_panel(panel: Panel) -> tuple[bool, str | None]:
    if panel.type == PanelType.news:
        continent = panel.params.get("continent")
        if continent:
            resolved_continent = continent if continent in VALID_CONTINENTS else resolve_continent(continent)
            if resolved_continent is None:
                return False, f"'{continent}' isn't a recognized continent"
            panel.params["continent"] = resolved_continent
            return True, None
        country = panel.params.get("country")
        if country is None:
            return True, None
        resolved_country = resolve_country_for_news(country)
        if resolved_country is None:
            resolved_continent = resolve_continent(country)
            if resolved_continent:
                panel.params["country"] = None
                panel.params["continent"] = resolved_continent
                return True, None
            return False, f"'{country}' isn't a recognized country"
        panel.params["country"] = resolved_country
        return True, None
    if panel.type == PanelType.market:
        symbol = panel.params.get("symbol")
        if symbol not in VALID_SYMBOLS:
            return False, f"'{symbol}' isn't a recognized market symbol"
        return True, None
    return False, f"unknown panel type '{panel.type}'"


def _validate_all(panels: list[Panel]) -> tuple[list[Panel], list[tuple[Panel, str]]]:
    valid, dropped = [], []
    for panel in panels:
        ok, reason = _validate_panel(panel)
        (valid if ok else dropped).append(panel if ok else (panel, reason))
    return valid, dropped


def _reconcile_ids(new_panels: list[Panel], current_config: PanelConfig | None) -> list[Panel]:
    old_by_key = {}
    if current_config:
        for p in current_config.panels:
            old_by_key[(p.type, tuple(sorted(p.params.items())))] = p.id

    for panel in new_panels:
        key = (panel.type, tuple(sorted(panel.params.items())))
        panel.id = old_by_key.get(key, new_panel_id())
    return new_panels


async def build_workspace_config(
    entities: ClassifierEntities,
    build_op: BuildOp | None,
    current_config: PanelConfig | None,
) -> tuple[PanelConfig, str | None]:
    prompt = _build_prompt(entities, build_op, current_config)
    panels = await _generate_panels(prompt)
    valid_panels, dropped = _validate_all(panels)

    if dropped:
        error_feedback = "; ".join(reason for _, reason in dropped)
        retried_panels = await _generate_panels(prompt, error_feedback=error_feedback)
        valid_panels, dropped = _validate_all(retried_panels)

    valid_panels = _reconcile_ids(valid_panels, current_config)
    notes = ("Skipped: " + "; ".join(reason for _, reason in dropped)) if dropped else None

    return PanelConfig(panels=valid_panels), notes
