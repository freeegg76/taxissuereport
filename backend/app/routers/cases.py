from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.db import crud
from app.schemas.case_schemas import CaseResponse, UserCaseSelection
from app.services.law_api_service import search_and_save_cases
from app.services.case_selector_service import select_cases

router = APIRouter()


@router.post("/issues/{issue_id}/search-cases")
async def search_cases(
    issue_id: int,
    max_results: int = Query(default=20, ge=1, le=50),
    db: Session = Depends(get_db),
):
    issue = crud.get_issue(db, issue_id)
    if not issue:
        raise HTTPException(status_code=404, detail="이슈를 찾을 수 없습니다.")
    if not issue.search_strategy:
        raise HTTPException(status_code=400, detail="이슈 분석을 먼저 실행하세요.")

    try:
        search_result = await search_and_save_cases(issue, db, max_results=max_results)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"판례 검색 실패: {e}")

    if search_result["saved_count"] == 0:
        raise HTTPException(status_code=503, detail="검색된 판례가 없습니다. 검색 전략을 변경하세요.")

    selected_count = 0
    try:
        selection = await select_cases(issue, db)
        selected_count = len(selection.selected_cases)
    except Exception:
        pass

    return {**search_result, "selected_count": selected_count}


@router.post("/issues/{issue_id}/cases/select")
def user_select_cases(
    issue_id: int,
    body: UserCaseSelection,
    db: Session = Depends(get_db),
):
    issue = crud.get_issue(db, issue_id)
    if not issue:
        raise HTTPException(status_code=404, detail="이슈를 찾을 수 없습니다.")
    if not body.case_ids:
        raise HTTPException(status_code=400, detail="최소 1건 이상 선택하세요.")
    crud.set_case_selection_by_ids(db, issue_id, body.case_ids)
    return {"selected_count": len(body.case_ids)}


@router.get("/issues/{issue_id}/cases", response_model=list[CaseResponse])
def list_cases(issue_id: int, db: Session = Depends(get_db)):
    issue = crud.get_issue(db, issue_id)
    if not issue:
        raise HTTPException(status_code=404, detail="이슈를 찾을 수 없습니다.")
    return crud.get_cases_by_issue(db, issue_id)


@router.get("/cases/{case_id}", response_model=CaseResponse)
def get_case(case_id: int, db: Session = Depends(get_db)):
    case = crud.get_case(db, case_id)
    if not case:
        raise HTTPException(status_code=404, detail="판례를 찾을 수 없습니다.")
    return case
