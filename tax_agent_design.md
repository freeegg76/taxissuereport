# 세무 이슈 보고서 자동화 에이전트 시스템 설계서

> **문서 목적**: Claude Code에서 구체적인 구현 시 참조할 계획서
> **작성 기준**: 첨부 명세서(FR.md, USER_CASE_SCENARIOS.md, API_ENDPOINT_REPORT.md, TABLE_SPECIFICATIONS.md, ERD.md) 및 제공된 기술 스택 기반

---

## 1. 작업 컨텍스트

### 1.1 배경 및 목적

세무 전문가가 특정 세무 이슈에 대한 판례를 수집·분석하고 보고서를 작성하는 작업은 반복적이고 시간 소모가 크다. 본 시스템은 국가법령정보 시스템의 판례 API를 활용하여 이 과정을 자동화한다.

**에이전트의 역할**: FastAPI 백엔드 내부의 LLM 처리 레이어로서, 이슈 분석 / 판례 선별 / 보고서 생성 등 **판단이 필요한 단계**만 수행한다. 나머지 I/O, DB, 외부 API 호출은 스크립트(백엔드 레이어)가 담당한다.

### 1.2 범위

| 포함 | 제외 |
|------|------|
| 세무 이슈 분석 (세목·쟁점·키워드·검색 전략 추출) | 사용자 인증/권한 관리 |
| 국가법령정보 판례 API 검색 결과 기반 선별 | 세무 법령 해석 (판례 기반에 한정) |
| 세무 이슈 분석 보고서 생성 | 외부 회계·세무 소프트웨어 연동 |
| 피드백 기반 보고서 수정 | 실시간 세법 개정 반영 |
| DOCX/PDF 파일 내보내기 | |

### 1.3 입출력 정의

| 구분 | 내용 | 형식 |
|------|------|------|
| **입력** | 사용자가 자연어로 작성한 세무 이슈 | 자유 텍스트 |
| **중간 산출물** | 이슈 분석 결과 (세목, 쟁점, 키워드, 검색 전략) | JSON |
| **중간 산출물** | 선별된 판례 목록 및 선택 사유 | JSON |
| **최종 출력** | 세무 이슈 분석 보고서 | Markdown / HTML / DOCX / PDF |

### 1.4 제약조건

- 이슈당 보고서는 1개만 유지 (수정 시 기존 보고서 업데이트, FR-010)
- 보고서에는 출처(판례명, 사건번호, 법원, 선고일) 및 면책문구 필수 포함 (FR-020, FR-021)
- 국가법령정보 API 응답 실패 시 재시도 후 에스컬레이션

### 1.5 용어 정의

| 용어 | 정의 |
|------|------|
| 세목 | 소득세, 법인세, 부가가치세 등 세금의 종류 |
| 쟁점 | 이슈의 핵심 법적 논점 |
| 검색 전략 | 국가법령정보 API 호출 시 사용할 키워드·필터 조합 |
| 판례 선별 | LLM이 관련성·최신성·법원 단계·쟁점 일치도를 기준으로 보고서에 사용할 판례를 선택하는 행위 |
| 보고서 확정 | 사용자가 최종 승인하여 STATUS를 `finalized`로 변경하는 상태 |

---

## 2. 워크플로우 정의

### 2.1 전체 흐름도

```
[사용자 입력: 세무 이슈]
        │
        ▼
[STEP 1] 이슈 저장
  - FastAPI: TB_ISSUES INSERT
  - 반환: ISSUE_ID
        │
        ▼
[STEP 2] 이슈 분석  ◀── LLM 판단 영역
  - 세목 분류
  - 쟁점 추출
  - 키워드 생성
  - 검색 전략 수립
  - FastAPI: TB_ISSUES UPDATE
        │
        ▼
[STEP 3] 판례 검색 및 저장
  - 국가법령정보 API 호출 (스크립트)
  - 판례 본문 조회 (스크립트)
  - TB_CASES INSERT (스크립트)
  - TB_API_LOGS INSERT (스크립트)
        │
        ▼
[STEP 4] 판례 선별  ◀── LLM 판단 영역
  - 관련성 점수 산정
  - 최신성 / 법원 단계 / 쟁점 일치도 평가
  - 선택 사유 생성
  - TB_CASES UPDATE (SELECTED, RELEVANCE_SCORE, RANK_ORDER)
        │
        ▼
[STEP 5] 보고서 생성  ◀── LLM 판단 영역
  - 이슈 요약 / 판례 분석 / 사안 적용 /
    리스크 / 실무 대응안 / 결론 생성
  - 출처 및 면책문구 자동 삽입
  - TB_REPORTS UPSERT
        │
        ▼
[STEP 6] 사용자 검토
  ┌─────────────────┐
  │  피드백 있음?   │
  └─────────────────┘
       │ YES                    │ NO
       ▼                        ▼
[STEP 7] 피드백 처리  ◀── LLM   [STEP 8] 최종 확정
  - 수정 범위 판단              - STATUS → finalized
  ┌──────────────┐              - FINALIZED_AT 기록
  │ 신규 판례    │
  │ 필요 여부?   │
  └──────────────┘
    YES │        │ NO
        ▼        ▼
   STEP 3   보고서 수정만
   재실행    (LLM 판단)
        │        │
        └───┬────┘
            ▼
       STEP 5 재실행
            │
       STEP 6 반복
```

### 2.2 LLM 판단 영역 vs 코드 처리 영역

| 단계 | 처리 주체 | 세부 내용 |
|------|-----------|-----------|
| STEP 1: 이슈 저장 | **스크립트** | FastAPI POST /api/v1/issues → SQLite INSERT |
| STEP 2: 이슈 분석 | **LLM** | 세목 분류, 쟁점 추출, 키워드 생성, 검색 전략 수립 |
| STEP 3: 판례 검색 | **스크립트** | 국가법령정보 API 호출, 응답 파싱, DB 저장 |
| STEP 4: 판례 선별 | **LLM** | 관련성·최신성·법원 단계·쟁점 일치도 평가 및 순위 결정 |
| STEP 5: 보고서 생성 | **LLM** | 6개 섹션 생성, 출처·면책문구 삽입, Markdown 작성 |
| STEP 6: 파일 저장 | **스크립트** | TB_REPORTS UPSERT, Markdown→HTML 변환 |
| STEP 7: 피드백 처리 | **LLM + 스크립트** | 수정 범위 판단(LLM) → 필요 시 판례 재검색(스크립트) → 보고서 재생성(LLM) |
| STEP 8: 확정/내보내기 | **스크립트** | STATUS 업데이트, DOCX/PDF 생성 |

### 2.3 단계별 성공 기준 및 검증

#### STEP 2: 이슈 분석

| 항목 | 내용 |
|------|------|
| **성공 기준** | `tax_category`, `keywords`(3개 이상), `search_strategy`(쿼리 1개 이상) 모두 존재 |
| **검증 방법** | 스키마 검증 (필수 필드 존재 여부 체크) |
| **실패 시 처리** | 자동 재시도 (최대 2회) → 초과 시 에스컬레이션 (사용자에게 이슈 재입력 요청) |

#### STEP 3: 판례 검색

| 항목 | 내용 |
|------|------|
| **성공 기준** | 1건 이상의 판례가 TB_CASES에 저장됨, API 응답 STATUS_CODE 200 |
| **검증 방법** | 규칙 기반 (저장 건수 > 0, 상태 코드 확인) |
| **실패 시 처리** | API 오류: 자동 재시도 (최대 3회, 5초 간격) → 초과 시 에스컬레이션 / 결과 0건: 검색 전략 변경 후 재시도 1회 → 에스컬레이션 |

#### STEP 4: 판례 선별

| 항목 | 내용 |
|------|------|
| **성공 기준** | SELECTED=1인 판례 1건 이상, 각 판례에 SELECTION_REASON 존재 |
| **검증 방법** | 스키마 검증 + LLM 자기 검증 (선택 사유가 이슈와 연결되는지 확인) |
| **실패 시 처리** | 자동 재시도 (최대 2회) → 선별 기준을 완화하여 재수행 |

#### STEP 5: 보고서 생성

| 항목 | 내용 |
|------|------|
| **성공 기준** | 6개 섹션(이슈 요약·판례 분석·사안 적용·리스크·실무 대응안·결론) 모두 존재, 출처 및 면책문구 포함 |
| **검증 방법** | 규칙 기반 (필수 섹션 존재 여부) + LLM 자기 검증 (누락·품질 체크) |
| **실패 시 처리** | 자동 재시도 (최대 2회, 누락 섹션 명시하여 재생성 요청) → 초과 시 에스컬레이션 |

#### STEP 7: 피드백 처리

| 항목 | 내용 |
|------|------|
| **성공 기준** | 피드백 내용이 보고서에 반영되었는지 LLM이 자기 확인 |
| **검증 방법** | LLM 자기 검증 |
| **실패 시 처리** | 자동 재시도 1회 → 이후 스킵 + 로그 기록 (피드백 반영 실패 사유 TB_API_LOGS에 저장) |

### 2.4 상태 전이

```
TB_ISSUES.STATUS
  created → analyzed → searching → searched → report_generating → report_ready

TB_REPORTS.STATUS
  draft → finalized
```

---

## 3. 구현 스펙

### 3.1 폴더 구조

```
/project-root
  ├── CLAUDE.md                              # 메인 에이전트 지침 (오케스트레이터)
  │
  ├── /.claude
  │   ├── /skills
  │   │   ├── /issue-analyzer               # STEP 2: 이슈 분석
  │   │   │   ├── SKILL.md
  │   │   │   └── /references
  │   │   │       └── tax_categories.md     # 세목 분류 기준 참조
  │   │   │
  │   │   ├── /case-selector               # STEP 4: 판례 선별
  │   │   │   ├── SKILL.md
  │   │   │   └── /references
  │   │   │       └── selection_criteria.md # 선별 기준 (관련성·최신성·법원 단계)
  │   │   │
  │   │   ├── /report-generator            # STEP 5, 7: 보고서 생성·수정
  │   │   │   ├── SKILL.md
  │   │   │   ├── /references
  │   │   │   │   └── report_template.md   # 보고서 섹션 구조 및 면책문구
  │   │   │   └── /scripts
  │   │   │       └── validate_report.py   # 필수 섹션 존재 여부 검증
  │   │   │
  │   │   └── /law-api-caller              # STEP 3: 판례 검색 (스크립트 전용)
  │   │       ├── SKILL.md
  │   │       ├── /scripts
  │   │       │   ├── search_cases.py      # 국가법령정보 판례 목록 API 호출
  │   │       │   └── fetch_case_body.py   # 판례 본문 조회 API 호출
  │   │       └── /references
  │   │           └── law_api_guide.md     # 국가법령정보 API 명세 요약
  │   │
  │   └── /agents
  │       └── /feedback-handler            # STEP 7: 피드백 처리 서브에이전트
  │           └── AGENT.md
  │
  ├── /output                              # 중간 및 최종 산출물
  │   ├── step2_issue_analysis.json        # 이슈 분석 결과
  │   ├── step3_cases_raw.json             # 검색된 판례 목록
  │   ├── step4_cases_selected.json        # 선별된 판례 목록
  │   └── step5_report.md                 # 생성된 보고서 (Markdown)
  │
  ├── /docs                               # 참고 문서
  │   ├── FR.md
  │   ├── USER_CASE_SCENARIOS.md
  │   ├── API_ENDPOINT_REPORT.md
  │   ├── TABLE_SPECIFICATIONS.md
  │   └── ERD.md
  │
  ├── /frontend                           # Next.js 15 앱
  │   └── ...
  │
  └── /backend                            # FastAPI 앱
      └── ...
```

### 3.2 CLAUDE.md 핵심 섹션 목록

1. **역할 정의** — 오케스트레이터로서의 역할, LLM 처리 레이어임을 명시
2. **워크플로우 순서** — STEP 1~8 순서 및 각 단계에서 호출할 스킬/서브에이전트
3. **판단 위임 원칙** — 언제 스킬을 호출하고, 언제 스크립트를 호출하는지 기준
4. **검증 지침** — 각 단계의 성공 기준 요약 및 재시도 횟수
5. **데이터 전달 규칙** — 중간 산출물을 `/output/` 에 저장하고 경로만 전달
6. **에스컬레이션 조건** — 재시도 소진 시 사용자에게 보고할 메시지 형식

### 3.3 에이전트 구조

**구조 선택: 단일 에이전트 + 1개 서브에이전트**

대부분의 단계는 순차적이고 컨텍스트가 연속되므로 단일 에이전트로 처리한다. 단, **STEP 7 피드백 처리**는 피드백 내용에 따라 분기 경로가 복잡하고(판례 재검색 여부 판단 → 보고서 재생성), 독립적인 판단 루프가 필요하므로 서브에이전트로 분리한다.

```
CLAUDE.md (오케스트레이터)
  ├── STEP 2  → issue-analyzer 스킬 호출
  ├── STEP 3  → law-api-caller 스킬 호출 (스크립트 실행)
  ├── STEP 4  → case-selector 스킬 호출
  ├── STEP 5  → report-generator 스킬 호출
  └── STEP 7  → feedback-handler 서브에이전트 위임
```

### 3.4 스킬 목록

| 스킬 이름 | 역할 | 처리 주체 | 트리거 조건 |
|-----------|------|-----------|-------------|
| `issue-analyzer` | 이슈 텍스트에서 세목·쟁점·키워드·검색 전략 추출 | LLM | POST /api/v1/issues/{id}/analyze 호출 시 |
| `law-api-caller` | 국가법령정보 API 호출, 판례 목록 및 본문 수집, TB_CASES 저장 | 스크립트 | POST /api/v1/issues/{id}/search-cases 호출 시 |
| `case-selector` | 검색된 판례 중 보고서에 사용할 판례 선별 및 순위 결정 | LLM | 판례 검색 완료 후 자동 실행 |
| `report-generator` | 선별된 판례 기반 6개 섹션 보고서 생성, 출처·면책문구 삽입 | LLM | POST /api/v1/issues/{id}/report 호출 시 |

### 3.5 서브에이전트 정의

#### `feedback-handler`

| 항목 | 내용 |
|------|------|
| **역할** | 사용자 피드백을 해석하고, 보고서 수정 범위를 판단하며, 필요 시 판례 재검색을 지시한 후 보고서를 갱신 |
| **트리거 조건** | PUT /api/v1/issues/{id}/report/feedback 호출 시 |
| **입력** | `issue_id`, `feedback_text`, 현재 보고서 내용 (파일 경로: `/output/step5_report.md`), 현재 선별 판례 목록 (파일 경로: `/output/step4_cases_selected.json`) |
| **출력** | 수정된 보고서 (`/output/step5_report.md` 덮어쓰기), 판례 재검색 필요 여부 플래그 (`needs_new_search: bool`) |
| **데이터 전달 방식** | 파일 기반 (입출력 모두 `/output/` 경로로 전달) |
| **참조 스킬** | `law-api-caller` (판례 재검색 필요 시), `report-generator` (보고서 재생성) |
| **판단 기준** | 피드백이 "특정 판례 추가·제외", "법원 범위 변경", "다른 쟁점 강조" 등이면 신규 검색 필요로 판단; "표현 수정", "섹션 보완"은 현재 판례로 재생성 |

### 3.6 주요 산출물 파일 형식

| 파일 | 형식 | 저장 위치 | 설명 |
|------|------|-----------|------|
| `step2_issue_analysis.json` | JSON | `/output/` | `tax_category`, `keywords[]`, `search_strategy{}` |
| `step3_cases_raw.json` | JSON | `/output/` | 국가법령정보 API 원본 응답 배열 |
| `step4_cases_selected.json` | JSON | `/output/` | `case_id`, `relevance_score`, `rank_order`, `selection_reason` |
| `step5_report.md` | Markdown | `/output/` | 6개 섹션 + 출처 테이블 + 면책문구 |
| `report.html` | HTML | DB (TB_REPORTS) | Markdown → HTML 변환본, 웹 조회용 |
| `report_{id}.docx` | DOCX | `/output/exports/` | 최종 내보내기, TB_EXPORTED_FILES에 경로 저장 |
| `report_{id}.pdf` | PDF | `/output/exports/` | 최종 내보내기, TB_EXPORTED_FILES에 경로 저장 |

---

## 4. 기술 스택 연계 메모

### 4.1 백엔드 (FastAPI + Python 3.12)

- **국가법령정보 API 호출**: `httpx` (비동기) — `law-api-caller` 스크립트에서 사용
- **LLM 호출**: FastAPI 엔드포인트가 에이전트 스킬을 호출하는 방식으로 연동
- **DB**: SQLAlchemy 2.x + Alembic, 위 테이블 명세(TABLE_SPECIFICATIONS.md) 그대로 구현
- **검증**: Pydantic 모델로 LLM 출력 스키마 검증

### 4.2 프론트엔드 (Next.js 15 + TypeScript)

- **보고서 렌더링**: `react-markdown` — TB_REPORTS.FULL_REPORT_MARKDOWN 표시
- **상태관리**: Zustand — 이슈 ID, 워크플로우 진행 상태, 피드백 입력 상태 관리
- **API 통신**: Axios — API_ENDPOINT_REPORT.md의 15개 엔드포인트 호출
- **PDF 미리보기**: `react-pdf` (선택) — 내보내기 전 미리보기 제공

### 4.3 에이전트-백엔드 연동 방식

```
사용자 요청
    │
    ▼
Next.js → Axios → FastAPI 엔드포인트
                        │
                        ▼
              LLM 판단 필요 여부 체크
              ├── YES → 해당 스킬 로드 → LLM 호출 → 결과 파싱 (Pydantic)
              └── NO  → 스크립트 직접 실행
                        │
                        ▼
                   DB 저장 (SQLAlchemy)
                        │
                        ▼
                   Response 반환
```

---

## 5. 미결 사항 (구현 시 결정)

| 항목 | 내용 | 권장 방향 |
|------|------|-----------|
| LLM 모델 선택 | 이슈 분석·판례 선별·보고서 생성에 사용할 모델 | Claude Sonnet 계열 (비용·품질 균형) |
| 국가법령정보 API 인증 | API 키 관리 방식 | 환경변수로 분리, `.env` 미포함 |
| 판례 검색 최대 건수 | max_results 기본값 | 20건 검색 후 상위 5건 선별 권장 |
| 보고서 재생성 이력 | 피드백 버전 관리 필요 여부 | 현재 명세에 없음, 단순 덮어쓰기로 시작 |
| DOCX/PDF 생성 라이브러리 | 백엔드에서 사용할 도구 | `python-docx` / `weasyprint` 검토 필요 |

---

*본 설계서는 Claude Code 구현 착수 전 계획서이며, 구현 중 발견된 사항에 따라 업데이트될 수 있다.*
