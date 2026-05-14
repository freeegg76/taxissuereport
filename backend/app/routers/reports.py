from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.db import crud
from app.schemas.report_schemas import ReportResponse
from app.schemas.feedback_schemas import FeedbackRequest
from app.services.report_generator_service import generate_report

router = APIRouter()


@router.post("/issues/{issue_id}/report")
async def create_or_update_report(issue_id: int, db: Session = Depends(get_db)):
    issue = crud.get_issue(db, issue_id)
    if not issue:
        raise HTTPException(status_code=404, detail="이슈를 찾을 수 없습니다.")

    selected = crud.get_selected_cases(db, issue_id)
    if not selected:
        raise HTTPException(status_code=400, detail="선별된 판례가 없습니다. 판례 검색을 먼저 실행하세요.")

    try:
        result = await generate_report(issue, db)
    except (ValueError, RuntimeError) as e:
        raise HTTPException(status_code=503, detail=str(e))

    return result


@router.get("/issues/{issue_id}/report", response_model=ReportResponse)
def get_report(issue_id: int, db: Session = Depends(get_db)):
    issue = crud.get_issue(db, issue_id)
    if not issue:
        raise HTTPException(status_code=404, detail="이슈를 찾을 수 없습니다.")
    report = crud.get_report_by_issue(db, issue_id)
    if not report:
        raise HTTPException(status_code=404, detail="보고서가 없습니다. 보고서 생성을 먼저 실행하세요.")
    return report


@router.put("/issues/{issue_id}/report/feedback")
async def apply_feedback(issue_id: int, body: FeedbackRequest, db: Session = Depends(get_db)):
    issue = crud.get_issue(db, issue_id)
    if not issue:
        raise HTTPException(status_code=404, detail="이슈를 찾을 수 없습니다.")
    report = crud.get_report_by_issue(db, issue_id)
    if not report:
        raise HTTPException(status_code=404, detail="보고서가 없습니다.")
    if report.status == "finalized":
        raise HTTPException(status_code=400, detail="확정된 보고서는 수정할 수 없습니다.")

    from app.services.feedback_handler_service import handle_feedback
    try:
        result = await handle_feedback(issue, report, body.feedback_text, db)
    except Exception as e:
        raise HTTPException(status_code=503, detail=str(e))

    return {"report_id": result.report_id, "updated": True}


@router.post("/issues/{issue_id}/report/finalize")
def finalize_report(issue_id: int, db: Session = Depends(get_db)):
    issue = crud.get_issue(db, issue_id)
    if not issue:
        raise HTTPException(status_code=404, detail="이슈를 찾을 수 없습니다.")
    report = crud.get_report_by_issue(db, issue_id)
    if not report:
        raise HTTPException(status_code=404, detail="보고서가 없습니다.")
    if report.status == "finalized":
        raise HTTPException(status_code=400, detail="이미 확정된 보고서입니다.")

    report = crud.finalize_report(db, report)
    return {"status": report.status, "finalized_at": report.finalized_at}
