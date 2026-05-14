import re
from dataclasses import dataclass, field


@dataclass
class ValidationResult:
    passed: bool
    errors: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)


_CITATION_PATTERN = re.compile(r'\[[^\]]+\d{4}[^\]]+\]')
_COURT_MENTION = re.compile(r'(?:대법원|고등법원|지방법원|조세심판원)')
def _has_law_name_before(text: str, pos: int) -> bool:
    """Check if a law name (ending in 법/령/규칙/조례) appears within 30 chars before pos."""
    preceding = text[max(0, pos - 40):pos]
    return bool(re.search(r'[가-힣]+(?:법|령|규칙|조례|시행)\s*$', preceding))
_SYNTHESIS_MARKERS = re.compile(r'(따라서|이에 따라|결국|종합하면|이를 종합하면)[^.。\n]+[.。]')
_REQUIRED_HEADERS = [
    "## 1. 이슈 요약", "## 2. 판례 분석", "## 3. 사안 적용",
    "## 4. 리스크 분석", "## 5. 실무 대응안", "## 6. 결론",
]


def validate_report_markdown(markdown: str) -> ValidationResult:
    errors: list[str] = []
    warnings: list[str] = []

    # Rule 0: Required section headers
    for header in _REQUIRED_HEADERS:
        if header not in markdown:
            errors.append(f"필수 섹션 누락: {header}")

    # Rule 1: Citations table
    if "| 판례명 |" not in markdown and "| 판례번호 |" not in markdown:
        errors.append("참조 판례 출처 테이블 누락")

    # Rule 2: Disclaimer
    if "본 보고서는 참고용이며 전문가 검토가 필요합니다" not in markdown:
        errors.append("면책문구 누락")

    # Rule 3: Court mentions in case_analysis section must have [citation]
    # Skip metadata blocks (사건번호/법원/선고일 listing) — they ARE the citation source
    _META_PATTERN = re.compile(r'사건번호|선고일|법원[^가-힣]')
    analysis_start = markdown.find("## 2. 판례 분석")
    analysis_end = markdown.find("## 3. 사안 적용")
    if analysis_start != -1 and analysis_end != -1:
        section = markdown[analysis_start:analysis_end]
        for para in section.split("\n\n"):
            para = para.strip()
            if _COURT_MENTION.search(para) and not _CITATION_PATTERN.search(para):
                if not para.startswith("#") and len(para) > 30:
                    # Skip metadata-only blocks
                    if _META_PATTERN.search(para):
                        continue
                    errors.append(f"판례 분석 단락에 각주 누락: '{para[:60]}...'")

    # Rule 4: Bare law article references (제X조 without law name)
    _ARTICLE_RE = re.compile(r'제\d+조')
    bare_articles = [
        m.group() for m in _ARTICLE_RE.finditer(markdown)
        if not _has_law_name_before(markdown, m.start())
    ]
    if bare_articles:
        errors.append(
            f"법령명 없이 조문번호만 사용: {bare_articles[:3]}. "
            f"반드시 '소득세법 제X조' 형식 사용"
        )

    # Rule 5 (warning): Synthesis language outside ※ 검토 의견: blocks
    for m in _SYNTHESIS_MARKERS.finditer(markdown):
        preceding = markdown[max(0, m.start() - 300): m.start()]
        if "※ 검토 의견:" not in preceding:
            warnings.append(
                f"종합 표현이 ※ 검토 의견: 블록 밖에 있을 수 있음: '{m.group()[:60]}'"
            )

    return ValidationResult(passed=len(errors) == 0, errors=errors, warnings=warnings)
