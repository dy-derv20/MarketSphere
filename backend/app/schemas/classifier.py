from enum import Enum

from pydantic import BaseModel


class Intent(str, Enum):
    answer = "answer"
    build = "build"
    analyze = "analyze"


class BuildOp(str, Enum):
    replace = "replace"
    add = "add"
    remove = "remove"


class ClassifierEntities(BaseModel):
    countries: list[str] = []
    companies: list[str] = []
    topics: list[str] = []
    timespan: str | None = None


class ClassifierResult(BaseModel):
    intent: Intent
    confidence: float
    build_op: BuildOp | None = None
    entities: ClassifierEntities
    restated: str
