# 세무 이슈 보고서 자동화 시스템

## 프로젝트 개요

판례 기반 세무 이슈 분석 보고서를 자동 생성하는 시스템.

- **백엔드**: FastAPI + Anthropic SDK + SQLite (c:\Dev\Tax\backend\)
- **프론트엔드**: Next.js 15 + Zustand + Tailwind (c:\Dev\Tax\frontend\)
- **LLM 스킬 프롬프트**: c:\Dev\Tax\.claude\skills\
- **에이전트 프롬프트**: c:\Dev\Tax\.claude\agents\

---

## 개발 환경 시작

```bash
# 백엔드
cd backend
python -m uvicorn main:app --reload --port 8000

# 프론트엔드 (새 터미널)
cd frontend
npm run dev
```

백엔드: http://localhost:8000 | API 문서: http://localhost:8000/docs
프론트엔드: http://localhost:3000

---

## 환경변수 설정

`backend/.env` 파일 생성 (`.env.example` 참조):

```
ANTHROPIC_API_KEY=sk-ant-...
LAW_API_KEY=...          # 법제처 국가법령정보 OpenAPI 키
DATABASE_URL=sqlite:///./tax_agent.db
```

---

## 핵심 아키텍처

### LLM 호출 패턴

모든 LLM 호출은 `backend/app/services/llm_client.py`의 `call_llm_with_skill()` 함수를 통과합니다.

```python
# 스킬 호출 예시
raw = await call_llm_with_skill(
    skill_name="issue-analyzer",   # .claude/skills/{name}/SKILL.md 로드
    user_message=message,
    issue_id=issue.issue_id,
    db=db,                         # 자동으로 TB_API_LOGS에 기록
)
```

- SKILL.md 파일 내용이 `system` 파라미터로 전달됩니다
- `lru_cache`로 최초 1회만 파일을 읽습니다
- 모든 호출 결과는 `TB_API_LOGS`에 자동 기록됩니다

### 스킬/에이전트 수정 시

| 파일 | 역할 |
|------|------|
| `.claude/skills/issue-analyzer/SKILL.md` | 이슈 분석 system prompt |
| `.claude/skills/case-selector/SKILL.md` | 판례 선별 system prompt |
| `.claude/skills/report-generator/SKILL.md` | 보고서 생성 system prompt (인용 규칙 포함) |
| `.claude/agents/feedback-handler/AGENT.md` | 피드백 분류 + 보고서 수정 system prompt |

SKILL.md를 수정하면 서버 재시작 없이 바로 반영됩니다 (단, `lru_cache` 초기화 필요 시 서버 재시작).

### 할루시네이션 방지 시스템

보고서 생성 시 3단계 검증이 적용됩니다:

1. **SKILL.md 프롬프트 강제** — 인용 규칙 위반 시 재작성 지시
2. **Pydantic 스키마** — `backend/app/schemas/report_schemas.py`의 `LLMReportOutput`
3. **validate_report.py** — `backend/app/services/validate_report.py`

검증 실패 시 오류 메시지를 프롬프트에 주입하여 최대 2회 재시도합니다.

**보고서 인용 규칙**:
- 판례 직접 인용: `[대법원 2019두38656]` 형식
- LLM 해석/의견: `※ 검토 의견:` 블록으로 시작
- 법령 참조: `소득세법 제19조 제1항` 형식 (법령명 + 조항번호 필수)

---

## 워크플로우 (8단계)

| 단계 | 처리 | 엔드포인트 |
|------|------|-----------|
| STEP 1: 이슈 저장 | 스크립트 | POST /api/v1/issues |
| STEP 2: 이슈 분석 | **LLM** | POST /api/v1/issues/{id}/analyze |
| STEP 3: 판례 검색 | 스크립트 | POST /api/v1/issues/{id}/search-cases |
| STEP 4: 판례 선별 | **LLM** | (search-cases 내부 자동 실행) |
| STEP 5: 보고서 생성 | **LLM** | POST /api/v1/issues/{id}/report |
| STEP 6: 보고서 조회 | 스크립트 | GET /api/v1/issues/{id}/report |
| STEP 7: 피드백 반영 | **LLM** | PUT /api/v1/issues/{id}/report/feedback |
| STEP 8: 확정/내보내기 | 스크립트 | POST /api/v1/issues/{id}/report/finalize |

---

## DB 스키마 변경

새 컬럼 추가 시:
```bash
cd backend
python -m alembic revision --autogenerate -m "add column X"
python -m alembic upgrade head
```

---

## 폴더 구조

```
/backend/
  main.py                     # FastAPI 앱
  app/
    core/config.py             # 환경변수 (pydantic-settings)
    core/database.py           # SQLAlchemy 엔진
    db/models.py               # ORM 모델 (5개 테이블)
    db/crud.py                 # DB 조작 전용
    routers/                   # HTTP 레이어 (비즈니스 로직 없음)
    schemas/                   # Pydantic 모델 + 검증
    services/
      llm_client.py            # ★ 단일 LLM 진입점
      issue_analyzer_service.py
      law_api_service.py       # 국가법령정보 API
      case_selector_service.py
      report_generator_service.py
      validate_report.py       # 할루시네이션 방지 Layer 3
      feedback_handler_service.py
      export_service.py        # DOCX/PDF

/.claude/
  skills/issue-analyzer/SKILL.md
  skills/case-selector/SKILL.md
  skills/report-generator/SKILL.md
  agents/feedback-handler/AGENT.md

/frontend/
  src/
    app/page.tsx               # 이슈 입력
    app/issues/[id]/page.tsx   # 워크플로우 + 보고서
    components/ReportViewer.tsx
    components/FeedbackForm.tsx
    components/ExportButtons.tsx
    store/issueStore.ts        # Zustand
    lib/apiClient.ts           # Axios
```
