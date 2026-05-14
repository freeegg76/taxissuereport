from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.db import crud
from app.services.export_service import generate_docx, generate_pdf

router = APIRouter()


@router.post("/issues/{issue_id}/report/export/docx")
def export_docx(issue_id: int, db: Session = Depends(get_db)):
    report = crud.get_report_by_issue(db, issue_id)
    if not report:
        raise HTTPException(status_code=404, detail="보고서가 없습니다.")
    if report.status != "finalized":
        raise HTTPException(status_code=400, detail="확정된 보고서만 내보낼 수 있습니다.")
    try:
        result = generate_docx(report, db)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"DOCX 생성 실패: {e}")
    return {"file_id": result["file_id"], "download_url": f"/api/v1/files/{result['file_id']}/download"}


@router.post("/issues/{issue_id}/report/export/pdf")
def export_pdf(issue_id: int, db: Session = Depends(get_db)):
    report = crud.get_report_by_issue(db, issue_id)
    if not report:
        raise HTTPException(status_code=404, detail="보고서가 없습니다.")
    if report.status != "finalized":
        raise HTTPException(status_code=400, detail="확정된 보고서만 내보낼 수 있습니다.")
    try:
        result = generate_pdf(report, db)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"PDF 생성 실패: {e}")
    return {"file_id": result["file_id"], "download_url": f"/api/v1/files/{result['file_id']}/download"}


@router.get("/files/{file_id}/download")
def download_file(file_id: int, db: Session = Depends(get_db)):
    ef = crud.get_exported_file(db, file_id)
    if not ef:
        raise HTTPException(status_code=404, detail="파일을 찾을 수 없습니다.")
    path = Path(ef.file_path)
    if not path.exists():
        raise HTTPException(status_code=404, detail="파일이 서버에 존재하지 않습니다.")
    media_type = "application/vnd.openxmlformats-officedocument.wordprocessingml.document" \
        if ef.file_type == "docx" else "application/pdf"
    return FileResponse(path=str(path), filename=ef.file_name, media_type=media_type)
