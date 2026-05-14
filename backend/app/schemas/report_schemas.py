import re
from pydantic import BaseModel, field_validator, model_validator

# 판례번호가 [] 없이 단독으로 쓰이는 패턴 감지
_BARE_CASE_PATTERN = re.compile(
    r'(?<!\[)(?:대법원|고등법원|지방법원|조세심판원)\s+\d{4}[가-힣]+\d+'
)

_REQUIRED_HEADERS = [
    "## 1. 이슈 요약",
    "## 2. 판례 분석",
    "## 3. 사안 적용",
    "## 4. 리스크 분석",
    "## 5. 실무 대응안",
    "## 6. 결론",
]
_DISCLAIMER_TEXT = "본 보고서는 참고용이며 전문가 검토가 필요합니다"


class ReportSectionValidated(BaseModel):
    content: str


class ReportSectionsSchema(BaseModel):
    issue_summary: ReportSectionValidated
    case_analysis: ReportSectionValidated
    application_analysis: ReportSectionValidated
    risk_analysis: ReportSectionValidated
    practical_recommendation: ReportSectionValidated
    conclusion: ReportSectionValidated
    citations_table: str
    disclaimer: str

    @model_validator(mode="after")
    def disclaimer_present(self) -> "ReportSectionsSchema":
        if _DISCLAIMER_TEXT not in self.disclaimer:
            raise ValueError(f"면책문구 누락: '{_DISCLAIMER_TEXT}' 포함 필수")
        return self


class LLMReportOutput(BaseModel):
    title: str
    sections: ReportSectionsSchema
    full_report_markdown: str

    @field_validator("full_report_markdown")
    @classmethod
    def validate_structure(cls, v: str) -> str:
        missing = [h for h in _REQUIRED_HEADERS if h not in v]
        if missing:
            raise ValueError(f"필수 섹션 누락: {missing}")
        if "| 판례명 |" not in v and "| 판례번호 |" not in v:
            raise ValueError("판례 출처 테이블 누락")
        if _DISCLAIMER_TEXT not in v:
            raise ValueError("면책문구 누락")
        return v


class ReportResponse(BaseModel):
    report_id: int
    issue_id: int
    title: str | None
    status: str
    full_report_markdown: str | None
    full_report_html: str | None
    created_at: str
    updated_at: str
    finalized_at: str | None

    class Config:
        from_attributes = True
