import json
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.db import crud
from app.schemas.issue_schemas import IssueCreate, IssueRename, IssueResponse
from app.schemas.folder_schemas import IssueFolderAssign

router = APIRouter()


def _serialize_issue(issue) -> dict:
    keywords = None
    if issue.extracted_keywords:
        try:
            keywords = json.loads(issue.extracted_keywords)
        except Exception:
            keywords = []
    strategy = None
    if issue.search_strategy:
        try:
            strategy = json.loads(issue.search_strategy)
        except Exception:
            strategy = {}
    return {
        "issue_id": issue.issue_id,
        "title": issue.title,
        "raw_input": issue.raw_input,
        "tax_category": issue.tax_category,
        "issue_summary": issue.issue_summary,
        "extracted_keywords": keywords,
        "search_strategy": strategy,
        "status": issue.status,
        "folder_id": issue.folder_id,
        "created_at": issue.created_at,
        "updated_at": issue.updated_at,
    }


@router.post("/issues", response_model=IssueResponse, status_code=201)
def create_issue(data: IssueCreate, db: Session = Depends(get_db)):
    issue = crud.create_issue(db, data)
    return _serialize_issue(issue)


@router.get("/issues", response_model=list[IssueResponse])
def list_issues(db: Session = Depends(get_db)):
    issues = crud.list_issues(db)
    return [_serialize_issue(i) for i in issues]


@router.get("/issues/{issue_id}", response_model=IssueResponse)
def get_issue(issue_id: int, db: Session = Depends(get_db)):
    issue = crud.get_issue(db, issue_id)
    if not issue:
        raise HTTPException(status_code=404, detail="이슈를 찾을 수 없습니다.")
    return _serialize_issue(issue)


@router.patch("/issues/{issue_id}", response_model=IssueResponse)
def rename_issue(issue_id: int, data: IssueRename, db: Session = Depends(get_db)):
    issue = crud.get_issue(db, issue_id)
    if not issue:
        raise HTTPException(status_code=404, detail="이슈를 찾을 수 없습니다.")
    title = data.title.strip()
    if not title:
        raise HTTPException(status_code=400, detail="제목을 입력하세요.")
    return _serialize_issue(crud.rename_issue(db, issue, title))


@router.delete("/issues/{issue_id}", status_code=204)
def delete_issue(issue_id: int, db: Session = Depends(get_db)):
    deleted = crud.delete_issue(db, issue_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="이슈를 찾을 수 없습니다.")


@router.patch("/issues/{issue_id}/folder", response_model=IssueResponse)
def assign_folder(issue_id: int, data: IssueFolderAssign, db: Session = Depends(get_db)):
    issue = crud.get_issue(db, issue_id)
    if not issue:
        raise HTTPException(status_code=404, detail="이슈를 찾을 수 없습니다.")
    return _serialize_issue(crud.assign_issue_folder(db, issue, data.folder_id))
