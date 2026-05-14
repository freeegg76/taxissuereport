from pydantic import BaseModel


class CaseResponse(BaseModel):
    case_id: int
    issue_id: int
    external_case_id: str | None
    case_name: str | None
    case_number: str | None
    court_name: str | None
    decision_date: str | None
    case_type: str | None
    source_url: str | None
    summary: str | None
    holding: str | None
    relevance_score: float | None
    rank_order: int | None
    selected: int
    selection_reason: str | None

    class Config:
        from_attributes = True


class CaseSelectionItem(BaseModel):
    case_id: int
    relevance_score: float
    rank_order: int
    selection_reason: str


class CaseSelectionOutput(BaseModel):
    selected_cases: list[CaseSelectionItem]
