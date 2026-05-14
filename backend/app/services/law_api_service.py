import json
import asyncio
from html.parser import HTMLParser
import httpx
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db import crud
from app.db.models import Issue


class _HTMLStripper(HTMLParser):
    def __init__(self):
        super().__init__()
        self._parts: list[str] = []

    def handle_data(self, data: str):
        self._parts.append(data)

    def get_text(self) -> str:
        return " ".join(self._parts)


def _strip_html(html: str) -> str:
    p = _HTMLStripper()
    p.feed(html)
    return p.get_text()


async def search_and_save_cases(
    issue: Issue,
    db: Session,
    max_results: int | None = None,
    override_strategy: dict | None = None,
) -> dict:
    if max_results is None:
        max_results = settings.max_search_results

    strategy = override_strategy
    if strategy is None and issue.search_strategy:
        strategy = json.loads(issue.search_strategy)
    if not strategy:
        raise ValueError("검색 전략이 없습니다. 이슈 분석을 먼저 실행하세요.")

    crud.update_issue_status(db, issue, "searching")

    queries = [strategy["primary_query"]] + strategy.get("secondary_queries", [])
    all_cases: list[dict] = []
    seen_ids: set[str] = set()

    async with httpx.AsyncClient(timeout=30.0) as client:
        for query in queries:
            cases = await _search_cases_by_query(client, query, max_results, issue.issue_id, db)
            for c in cases:
                if c["external_case_id"] not in seen_ids:
                    seen_ids.add(c["external_case_id"])
                    all_cases.append(c)
            if len(all_cases) >= max_results:
                break

        # Fetch full text for each case
        for case_data in all_cases:
            if case_data.get("external_case_id"):
                body = await _fetch_case_body(
                    client, case_data["external_case_id"], issue.issue_id, db
                )
                if body:
                    case_data["full_text"] = body

    saved = crud.save_cases(db, issue.issue_id, all_cases)
    crud.update_issue_status(db, issue, "searched")

    return {"searched_count": len(all_cases), "saved_count": len(saved)}


async def _search_cases_by_query(
    client: httpx.AsyncClient,
    query: str,
    max_results: int,
    issue_id: int,
    db: Session,
) -> list[dict]:
    # law.go.kr API only supports up to 2 terms; truncate longer queries
    terms = query.split()
    if len(terms) > 2:
        query = " ".join(terms[:2])

    params = {
        "OC": settings.law_api_key,
        "target": "prec",
        "query": query,
        "type": "JSON",
        "display": str(max_results),
        "page": "1",
    }
    url = f"{settings.law_api_base_url}/lawSearch.do"
    error_msg = None
    status_code = None

    for attempt in range(3):
        try:
            resp = await client.get(url, params=params)
            status_code = resp.status_code
            resp.raise_for_status()
            data = resp.json()
            crud.create_api_log(
                db=db, issue_id=issue_id, provider="law_api",
                endpoint="lawSearch.do", request_payload={"query": query},
                response_payload={"total": data.get("PrecSearch", {}).get("totalCnt")},
                status_code=status_code,
            )
            return _parse_search_results(data)
        except Exception as e:
            error_msg = str(e)
            if attempt == 2:
                crud.create_api_log(
                    db=db, issue_id=issue_id, provider="law_api",
                    endpoint="lawSearch.do", request_payload={"query": query},
                    response_payload=None, status_code=status_code, error_message=error_msg,
                )
                return []
            await asyncio.sleep(5)
    return []


async def _fetch_case_body(
    client: httpx.AsyncClient,
    external_id: str,
    issue_id: int,
    db: Session,
) -> str | None:
    params = {
        "OC": settings.law_api_key,
        "target": "prec",
        "ID": external_id,
        "type": "JSON",
    }
    url = f"{settings.law_api_base_url}/lawService.do"

    for attempt in range(3):
        try:
            resp = await client.get(url, params=params)
            resp.raise_for_status()
            data = resp.json()
            content = data.get("PrecService", {}).get("판례내용", "")
            return _strip_html(content) if content else None
        except Exception:
            if attempt == 2:
                return None
            await asyncio.sleep(5)
    return None


def _parse_search_results(data: dict) -> list[dict]:
    prec_list = data.get("PrecSearch", {}).get("prec", [])
    if isinstance(prec_list, dict):
        prec_list = [prec_list]

    results = []
    for p in prec_list:
        raw_date = p.get("선고일자", "")
        decision_date = f"{raw_date[:4]}-{raw_date[4:6]}-{raw_date[6:8]}" if len(raw_date) == 8 else raw_date
        case_number = p.get("사건번호", "")
        court = p.get("법원명", "")
        full_case_number = f"{court} {case_number}".strip() if court and case_number else case_number

        results.append({
            "external_case_id": str(p.get("판례일련번호", "")),
            "case_name": p.get("사건명"),
            "case_number": full_case_number,
            "court_name": court,
            "decision_date": decision_date,
            "case_type": p.get("사건종류명"),
            "source_url": f"https://www.law.go.kr/precSc.do?precSeq={p.get('판례일련번호', '')}",
            "holding": p.get("판시사항"),
            "summary": p.get("판결요지"),
            "raw_metadata": p,
        })
    return results
