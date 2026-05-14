import json
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.db import crud

router = APIRouter()


@router.get("/issues/{issue_id}/api-logs")
def get_logs(issue_id: int, db: Session = Depends(get_db)):
    issue = crud.get_issue(db, issue_id)
    if not issue:
        raise HTTPException(status_code=404, detail="이슈를 찾을 수 없습니다.")
    logs = crud.get_api_logs_by_issue(db, issue_id)
    return [
        {
            "api_log_id": log.api_log_id,
            "provider": log.provider,
            "endpoint": log.endpoint,
            "status_code": log.status_code,
            "error_message": log.error_message,
            "created_at": log.created_at,
        }
        for log in logs
    ]
