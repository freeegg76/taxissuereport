from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import issues, analysis, cases, reports, exports, logs, config, folders

app = FastAPI(title="세무 이슈 보고서 자동화 API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(issues.router, prefix="/api/v1", tags=["issues"])
app.include_router(analysis.router, prefix="/api/v1", tags=["analysis"])
app.include_router(cases.router, prefix="/api/v1", tags=["cases"])
app.include_router(reports.router, prefix="/api/v1", tags=["reports"])
app.include_router(exports.router, prefix="/api/v1", tags=["exports"])
app.include_router(logs.router, prefix="/api/v1", tags=["logs"])
app.include_router(config.router, prefix="/api/v1", tags=["config"])
app.include_router(folders.router, prefix="/api/v1", tags=["folders"])


@app.get("/health")
def health():
    return {"status": "ok"}
