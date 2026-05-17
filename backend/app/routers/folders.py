from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.db import crud
from app.schemas.folder_schemas import FolderCreate, FolderRename, FolderResponse

router = APIRouter()


@router.get("/folders", response_model=list[FolderResponse])
def list_folders(db: Session = Depends(get_db)):
    return crud.list_folders(db)


@router.post("/folders", response_model=FolderResponse, status_code=201)
def create_folder(data: FolderCreate, db: Session = Depends(get_db)):
    name = data.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="폴더 이름을 입력하세요.")
    return crud.create_folder(db, name)


@router.patch("/folders/{folder_id}", response_model=FolderResponse)
def rename_folder(folder_id: int, data: FolderRename, db: Session = Depends(get_db)):
    folder = db.get(crud.Folder, folder_id)
    if not folder:
        raise HTTPException(status_code=404, detail="폴더를 찾을 수 없습니다.")
    name = data.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="폴더 이름을 입력하세요.")
    return crud.rename_folder(db, folder, name)


@router.delete("/folders/{folder_id}", status_code=204)
def delete_folder(folder_id: int, db: Session = Depends(get_db)):
    deleted = crud.delete_folder(db, folder_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="폴더를 찾을 수 없습니다.")
