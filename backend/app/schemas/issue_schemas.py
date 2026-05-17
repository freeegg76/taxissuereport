from pydantic import BaseModel, field_validator
from typing import Any


class IssueCreate(BaseModel):
    title: str | None = None
    raw_input: str


class SearchStrategySchema(BaseModel):
    primary_query: str
    secondary_queries: list[str] = []
    filters: dict[str, Any] = {}


class IssueAnalysisOutput(BaseModel):
    tax_category: str
    issue_summary: str
    extracted_keywords: list[str]
    search_strategy: SearchStrategySchema

    @field_validator("extracted_keywords")
    @classmethod
    def at_least_three_keywords(cls, v: list[str]) -> list[str]:
        if len(v) < 3:
            raise ValueError("keywords는 최소 3개 이상이어야 합니다.")
        return v


class IssueRename(BaseModel):
    title: str


class IssueResponse(BaseModel):
    issue_id: int
    title: str | None
    raw_input: str
    tax_category: str | None
    issue_summary: str | None
    extracted_keywords: list[str] | None
    search_strategy: dict | None
    status: str
    folder_id: int | None
    created_at: str
    updated_at: str

    class Config:
        from_attributes = True
