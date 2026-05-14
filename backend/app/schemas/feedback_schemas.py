from pydantic import BaseModel
from typing import Literal


class FeedbackRequest(BaseModel):
    feedback_text: str


class FeedbackAnalysis(BaseModel):
    needs_new_search: bool
    reason: str
    new_search_queries: list[str] = []
    modification_scope: Literal["full_regenerate", "section_update"]
    target_sections: list[str] = []
    modification_instructions: str
