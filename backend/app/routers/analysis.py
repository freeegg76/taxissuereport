from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.db import crud
from app.services.issue_analyzer_service import analyze_issue

router = APIRouter()


@router.post("/issues/{issue_id}/analyze")
async def analyze(issue_id: int, db: Session = Depends(get_db)):
    issue = crud.get_issue(db, issue_id)
    if not issue:
        raise HTTPException(status_code=404, detail="이슈를 찾을 수 없습니다.")
    if issue.status == "finalized":
        raise HTTPException(status_code=400, detail="확정된 이슈는 재분석할 수 없습니다.")

    try:
        result = await analyze_issue(issue, db)
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))

    return {
        "issue_id": issue_id,
        "tax_category": result.tax_category,
        "keywords": result.extracted_keywords,
        "search_strategy": result.search_strategy.model_dump(),
    }
