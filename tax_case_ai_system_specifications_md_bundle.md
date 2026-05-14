# FR.md

# Functional Requirements

| FR No. | 구분 | Functional Requirement | 관련 UC | 관련 API |
|---|---|---|---|---|
| FR-001 | 이슈 입력 | 사용자는 세무 이슈를 자연어로 입력할 수 있다. | UC-001 | API-001 |
| FR-002 | 이슈 저장 | 시스템은 입력된 세무 이슈를 SQLite에 저장한다. | UC-001 | API-001 |
| FR-003 | 이슈 분석 | LLM은 세무 이슈를 세목, 쟁점, 키워드, 검색 전략으로 분석한다. | UC-002 | API-004 |
| FR-004 | 판례 검색 | 시스템은 국가법령정보 판례 API를 호출해 관련 판례를 검색한다. | UC-003 | API-005 |
| FR-005 | 판례 본문 조회 | 시스템은 검색된 판례의 본문을 국가법령정보 API로 조회한다. | UC-003 | API-005 |
| FR-006 | 판례 저장 | 시스템은 판례 메타정보와 본문을 TB_CASES에 통합 저장한다. | UC-003 | API-005 |
| FR-007 | 판례 선별 | LLM은 관련성, 최신성, 법원 단계, 쟁점 일치도를 기준으로 판례를 선별한다. | UC-004 | API-006 |
| FR-008 | 판례 조회 | 사용자는 판례 후보 목록과 상세 내용을 조회할 수 있다. | UC-004 | API-006, API-007 |
| FR-009 | 보고서 생성 | 시스템은 선별된 판례를 기반으로 세무 이슈 분석 보고서를 생성한다. | UC-005 | API-008 |
| FR-010 | 단일 보고서 관리 | 시스템은 이슈별 보고서를 1개만 관리하며 수정 시 기존 보고서를 업데이트한다. | UC-005, UC-007 | API-008, API-010 |
| FR-011 | 웹 보고서 조회 | 사용자는 웹 화면에서 보고서를 조회할 수 있다. | UC-006 | API-009 |
| FR-012 | 보고서 구성 | 보고서는 이슈 요약, 판례 분석, 사안 적용, 리스크, 실무 대응안, 결론을 포함한다. | UC-005, UC-006 | API-008, API-009 |
| FR-013 | 피드백 반영 | 사용자는 보고서에 대한 피드백을 입력하고, 시스템은 즉시 보고서에 반영한다. | UC-007 | API-010 |
| FR-014 | 재검색 | 피드백이 신규 판례 검색을 요구하면 시스템은 판례 API를 재호출한다. | UC-007 | API-010 |
| FR-015 | 최종 확정 | 사용자는 보고서를 최종 확정할 수 있다. | UC-008 | API-011 |
| FR-016 | DOCX 다운로드 | 사용자는 최종 보고서를 Word 파일로 다운로드할 수 있다. | UC-009 | API-012, API-014 |
| FR-017 | PDF 다운로드 | 사용자는 최종 보고서를 PDF 파일로 다운로드할 수 있다. | UC-009 | API-013, API-014 |
| FR-018 | 파일 이력 저장 | 시스템은 생성된 DOCX/PDF 파일 정보를 저장한다. | UC-009 | API-012, API-013 |
| FR-019 | API 로그 저장 | 시스템은 국가법령정보 API 및 LLM 호출 로그를 저장한다. | UC-003, UC-007 | API-015 |
| FR-020 | 출처 표시 | 보고서에는 사용된 판례명, 사건번호, 법원, 선고일, 출처를 표시한다. | UC-005, UC-006 | API-008, API-009 |
| FR-021 | 면책문구 표시 | 보고서에는 전문가 검토 필요 문구를 포함한다. | UC-005, UC-006 | API-008, API-009 |

---

# USER_CASE_SCENARIOS.md

# User Case 시나리오

| UC No. | User Case | 목적 | 관련 FR | 관련 API | Main Flow | 결과 |
|---|---|---|---|---|---|---|
| UC-001 | 세무 이슈 입력 | 사용자가 검토할 세무 이슈를 입력한다. | FR-001, FR-002 | API-001, API-002, API-003 | 1. 제목과 세무 이슈 입력<br>2. 시스템이 TB_ISSUES에 저장<br>3. ISSUE_ID 반환 | 이슈 생성 완료 |
| UC-002 | 세무 이슈 분석 | LLM이 세무 이슈를 분석한다. | FR-003 | API-004 | 1. 이슈 원문 조회<br>2. LLM 분석 수행<br>3. 세목, 쟁점, 키워드, 검색 전략 생성<br>4. TB_ISSUES 업데이트 | 검색 전략 생성 완료 |
| UC-003 | 판례 검색 및 본문 조회 | 국가법령정보 API로 관련 판례를 조회한다. | FR-004, FR-005, FR-006, FR-019 | API-005, API-015 | 1. 판례 목록 API 호출<br>2. 관련 판례 본문 조회<br>3. TB_CASES에 통합 저장<br>4. TB_API_LOGS 저장 | 판례 데이터 확보 완료 |
| UC-004 | 판례 후보 확인 | 사용자가 검색된 판례를 확인한다. | FR-007, FR-008 | API-006, API-007 | 1. 판례 후보 목록 조회<br>2. 관련도와 선택 사유 확인<br>3. 특정 판례 상세 조회 | 판례 검토 완료 |
| UC-005 | 보고서 생성 | 판례 기반 보고서를 생성한다. | FR-009, FR-010, FR-012, FR-020, FR-021 | API-008 | 1. 이슈와 판례 데이터 수집<br>2. LLM 보고서 생성<br>3. TB_REPORTS 저장 또는 업데이트 | 보고서 생성 완료 |
| UC-006 | 웹 보고서 조회 | 사용자가 보고서를 웹에서 확인한다. | FR-011, FR-012, FR-020, FR-021 | API-009 | 1. 보고서 조회<br>2. 본문, 판례 출처, 면책문구 표시 | 보고서 열람 완료 |
| UC-007 | 피드백 반영 및 보고서 수정 | 사용자가 수정 요청을 입력하고 보고서를 갱신한다. | FR-010, FR-013, FR-014, FR-019 | API-010, API-015 | 1. 피드백 입력<br>2. LLM이 수정 요청 분석<br>3. 필요 시 판례 API 재호출<br>4. TB_CASES 및 TB_REPORTS 업데이트 | 보고서 수정 완료 |
| UC-008 | 보고서 최종 확정 | 사용자가 보고서를 최종 확정한다. | FR-015 | API-011 | 1. 최종 확정 요청<br>2. TB_REPORTS.STATUS 변경<br>3. FINALIZED_AT 기록 | 보고서 확정 완료 |
| UC-009 | DOCX/PDF 다운로드 | 사용자가 보고서를 파일로 다운로드한다. | FR-016, FR-017, FR-018 | API-012, API-013, API-014 | 1. DOCX 또는 PDF 생성 요청<br>2. 파일 생성<br>3. TB_EXPORTED_FILES 저장<br>4. 파일 다운로드 | 파일 다운로드 완료 |

---

# API_ENDPOINT_REPORT.md

# API Endpoint 리포트

| API No. | Method | Endpoint | 설명 | 관련 UC | 관련 FR | Request 주요 필드 | Response 주요 필드 |
|---|---|---|---|---|---|---|---|
| API-001 | POST | /api/v1/issues | 세무 이슈 생성 | UC-001 | FR-001, FR-002 | title, raw_input | issue_id, status |
| API-002 | GET | /api/v1/issues | 이슈 목록 조회 | UC-001 | FR-002 | - | issues[] |
| API-003 | GET | /api/v1/issues/{issue_id} | 이슈 상세 조회 | UC-001, UC-002 | FR-002, FR-003 | issue_id | issue detail |
| API-004 | POST | /api/v1/issues/{issue_id}/analyze | 이슈 분석 및 검색 전략 생성 | UC-002 | FR-003 | issue_id | tax_category, keywords, search_strategy |
| API-005 | POST | /api/v1/issues/{issue_id}/search-cases | 판례 검색 및 본문 조회 | UC-003 | FR-004, FR-005, FR-006, FR-019 | max_results, include_body | searched_count, saved_count |
| API-006 | GET | /api/v1/issues/{issue_id}/cases | 판례 후보 목록 조회 | UC-004 | FR-007, FR-008 | issue_id | cases[] |
| API-007 | GET | /api/v1/cases/{case_id} | 판례 상세 조회 | UC-004 | FR-008 | case_id | case detail |
| API-008 | POST | /api/v1/issues/{issue_id}/report | 보고서 생성 또는 업데이트 | UC-005 | FR-009, FR-010, FR-012, FR-020, FR-021 | issue_id, case_limit | report_id, status |
| API-009 | GET | /api/v1/issues/{issue_id}/report | 보고서 조회 | UC-006 | FR-011, FR-012, FR-020, FR-021 | issue_id | report detail |
| API-010 | PUT | /api/v1/issues/{issue_id}/report/feedback | 피드백 기반 보고서 수정 | UC-007 | FR-010, FR-013, FR-014, FR-019 | feedback_text | report_id, updated, searched_count |
| API-011 | POST | /api/v1/issues/{issue_id}/report/finalize | 보고서 최종 확정 | UC-008 | FR-015 | issue_id | status, finalized_at |
| API-012 | POST | /api/v1/issues/{issue_id}/report/export/docx | DOCX 생성 | UC-009 | FR-016, FR-018 | issue_id | file_id, download_url |
| API-013 | POST | /api/v1/issues/{issue_id}/report/export/pdf | PDF 생성 | UC-009 | FR-017, FR-018 | issue_id | file_id, download_url |
| API-014 | GET | /api/v1/files/{file_id}/download | 파일 다운로드 | UC-009 | FR-016, FR-017 | file_id | Binary file |
| API-015 | GET | /api/v1/issues/{issue_id}/api-logs | API 호출 로그 조회 | UC-003, UC-007 | FR-019 | issue_id | api_logs[] |

---

# TABLE_SPECIFICATIONS.md

# 테이블 명세서

## TB_ISSUES

| 컬럼명 | 타입 | NULL | PK | FK | Default | 설명 |
|---|---|---|---|---|---|---|
| ISSUE_ID | INTEGER | N | Y |  | AUTOINCREMENT | 이슈 ID |
| TITLE | TEXT | Y |  |  |  | 이슈 제목 |
| RAW_INPUT | TEXT | N |  |  |  | 사용자 입력 원문 |
| TAX_CATEGORY | TEXT | Y |  |  |  | 세목 |
| ISSUE_SUMMARY | TEXT | Y |  |  |  | 이슈 요약 |
| EXTRACTED_KEYWORDS | TEXT | Y |  |  |  | 키워드 JSON |
| SEARCH_STRATEGY | TEXT | Y |  |  |  | 검색 전략 JSON |
| STATUS | TEXT | N |  |  | 'created' | 상태 |
| CREATED_AT | TEXT | N |  |  | CURRENT_TIMESTAMP | 생성일시 |
| UPDATED_AT | TEXT | N |  |  | CURRENT_TIMESTAMP | 수정일시 |

## TB_CASES

| 컬럼명 | 타입 | NULL | PK | FK | Default | 설명 |
|---|---|---|---|---|---|---|
| CASE_ID | INTEGER | N | Y |  | AUTOINCREMENT | 내부 판례 ID |
| ISSUE_ID | INTEGER | N |  | Y |  | 이슈 ID |
| EXTERNAL_CASE_ID | TEXT | Y |  |  |  | 국가법령정보 API 판례 ID |
| CASE_NAME | TEXT | Y |  |  |  | 판례명 |
| CASE_NUMBER | TEXT | Y |  |  |  | 사건번호 |
| COURT_NAME | TEXT | Y |  |  |  | 법원명 |
| DECISION_DATE | TEXT | Y |  |  |  | 선고일 |
| CASE_TYPE | TEXT | Y |  |  |  | 사건 유형 |
| SOURCE_URL | TEXT | Y |  |  |  | 원문 URL |
| SUMMARY | TEXT | Y |  |  |  | 판례 요약 |
| HOLDING | TEXT | Y |  |  |  | 판시사항 |
| REASONING | TEXT | Y |  |  |  | 판결 이유 |
| FULL_TEXT | TEXT | Y |  |  |  | 판례 전문 |
| RELEVANCE_SCORE | REAL | Y |  |  |  | 관련도 점수 |
| RANK_ORDER | INTEGER | Y |  |  |  | 정렬 순위 |
| SELECTED | INTEGER | N |  |  | 0 | 보고서 사용 여부 |
| SELECTION_REASON | TEXT | Y |  |  |  | 판례 선택 사유 |
| RAW_METADATA | TEXT | Y |  |  |  | 원본 메타 JSON |
| RAW_CONTENT | TEXT | Y |  |  |  | 원본 본문 JSON |
| CREATED_AT | TEXT | N |  |  | CURRENT_TIMESTAMP | 생성일시 |
| UPDATED_AT | TEXT | N |  |  | CURRENT_TIMESTAMP | 수정일시 |

## TB_REPORTS

| 컬럼명 | 타입 | NULL | PK | FK | Default | 설명 |
|---|---|---|---|---|---|---|
| REPORT_ID | INTEGER | N | Y |  | AUTOINCREMENT | 보고서 ID |
| ISSUE_ID | INTEGER | N |  | Y |  | 이슈 ID |
| TITLE | TEXT | Y |  |  |  | 보고서 제목 |
| STATUS | TEXT | N |  |  | 'draft' | draft/finalized |
| EXECUTIVE_SUMMARY | TEXT | Y |  |  |  | 요약 |
| ISSUE_ANALYSIS | TEXT | Y |  |  |  | 이슈 분석 |
| CASE_ANALYSIS | TEXT | Y |  |  |  | 판례 분석 |
| APPLICATION_ANALYSIS | TEXT | Y |  |  |  | 사안 적용 |
| RISK_ANALYSIS | TEXT | Y |  |  |  | 리스크 분석 |
| PRACTICAL_RECOMMENDATION | TEXT | Y |  |  |  | 실무 대응안 |
| CONCLUSION | TEXT | Y |  |  |  | 결론 |
| FULL_REPORT_MARKDOWN | TEXT | Y |  |  |  | Markdown 보고서 |
| FULL_REPORT_HTML | TEXT | Y |  |  |  | HTML 보고서 |
| CREATED_AT | TEXT | N |  |  | CURRENT_TIMESTAMP | 생성일시 |
| UPDATED_AT | TEXT | N |  |  | CURRENT_TIMESTAMP | 수정일시 |
| FINALIZED_AT | TEXT | Y |  |  |  | 최종 확정일시 |

## TB_EXPORTED_FILES

| 컬럼명 | 타입 | NULL | PK | FK | Default | 설명 |
|---|---|---|---|---|---|---|
| FILE_ID | INTEGER | N | Y |  | AUTOINCREMENT | 파일 ID |
| REPORT_ID | INTEGER | N |  | Y |  | 보고서 ID |
| FILE_TYPE | TEXT | N |  |  |  | docx/pdf |
| FILE_PATH | TEXT | N |  |  |  | 파일 경로 |
| FILE_NAME | TEXT | N |  |  |  | 파일명 |
| CREATED_AT | TEXT | N |  |  | CURRENT_TIMESTAMP | 생성일시 |

## TB_API_LOGS

| 컬럼명 | 타입 | NULL | PK | FK | Default | 설명 |
|---|---|---|---|---|---|---|
| API_LOG_ID | INTEGER | N | Y |  | AUTOINCREMENT | 로그 ID |
| ISSUE_ID | INTEGER | Y |  | Y |  | 이슈 ID |
| PROVIDER | TEXT | N |  |  |  | law_api/openai |
| ENDPOINT | TEXT | Y |  |  |  | 호출 endpoint |
| REQUEST_PAYLOAD | TEXT | Y |  |  |  | 요청 JSON |
| RESPONSE_PAYLOAD | TEXT | Y |  |  |  | 응답 JSON |
| STATUS_CODE | INTEGER | Y |  |  |  | 상태 코드 |
| ERROR_MESSAGE | TEXT | Y |  |  |  | 오류 메시지 |
| CREATED_AT | TEXT | N |  |  | CURRENT_TIMESTAMP | 생성일시 |

---

# ERD.md

# ERD

```text
+----------------------------+
|         TB_ISSUES          |
+----------------------------+
| PK ISSUE_ID                |
| TITLE                      |
| RAW_INPUT                  |
| TAX_CATEGORY               |
| ISSUE_SUMMARY              |
| EXTRACTED_KEYWORDS         |
| SEARCH_STRATEGY            |
| STATUS                     |
| CREATED_AT                 |
| UPDATED_AT                 |
+----------------------------+
        | 1
        |
        | N
+----------------------------+
|         TB_CASES           |
+----------------------------+
| PK CASE_ID                 |
| FK ISSUE_ID                |
| EXTERNAL_CASE_ID           |
| CASE_NAME                  |
| CASE_NUMBER                |
| COURT_NAME                 |
| DECISION_DATE              |
| CASE_TYPE                  |
| SOURCE_URL                 |
| SUMMARY                    |
| HOLDING                    |
| REASONING                  |
| FULL_TEXT                  |
| RELEVANCE_SCORE            |
| RANK_ORDER                 |
| SELECTED                   |
| SELECTION_REASON           |
| RAW_METADATA               |
| RAW_CONTENT                |
| CREATED_AT                 |
| UPDATED_AT                 |
+----------------------------+

+----------------------------+
|         TB_ISSUES          |
+----------------------------+
| PK ISSUE_ID                |
+----------------------------+
        | 1
        |
        | 1
+----------------------------+
|        TB_REPORTS          |
+----------------------------+
| PK REPORT_ID               |
| FK ISSUE_ID UNIQUE         |
| TITLE                      |
| STATUS                     |
| EXECUTIVE_SUMMARY          |
| ISSUE_ANALYSIS             |
| CASE_ANALYSIS              |
| APPLICATION_ANALYSIS       |
| RISK_ANALYSIS              |
| PRACTICAL_RECOMMENDATION   |
| CONCLUSION                 |
| FULL_REPORT_MARKDOWN       |
| FULL_REPORT_HTML           |
| CREATED_AT                 |
| UPDATED_AT                 |
| FINALIZED_AT               |
+----------------------------+
        | 1
        |
        | N
+----------------------------+
|     TB_EXPORTED_FILES      |
+----------------------------+
| PK FILE_ID                 |
| FK REPORT_ID               |
| FILE_TYPE                  |
| FILE_PATH                  |
| FILE_NAME                  |
| CREATED_AT                 |
+----------------------------+

+----------------------------+
|         TB_ISSUES          |
+----------------------------+
| PK ISSUE_ID                |
+----------------------------+
        | 1
        |
        | N
+----------------------------+
|        TB_API_LOGS         |
+----------------------------+
| PK API_LOG_ID              |
| FK ISSUE_ID                |
| PROVIDER                   |
| ENDPOINT                   |
| REQUEST_PAYLOAD            |
| RESPONSE_PAYLOAD           |
| STATUS_CODE                |
| ERROR_MESSAGE              |
| CREATED_AT                 |
+----------------------------+
```
