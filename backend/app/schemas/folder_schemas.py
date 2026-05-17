from pydantic import BaseModel


class FolderCreate(BaseModel):
    name: str


class FolderRename(BaseModel):
    name: str


class FolderResponse(BaseModel):
    folder_id: int
    name: str
    created_at: str

    class Config:
        from_attributes = True


class IssueFolderAssign(BaseModel):
    folder_id: int | None  # None = 폴더에서 제거
