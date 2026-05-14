# Skill: law-api-caller

국가법령정보 판례 API를 호출하여 판례를 검색하고 DB에 저장합니다.

## 역할 정의

이 스킬은 **스크립트 전용**입니다. LLM 판단 없이 순수하게 API 호출 → 파싱 → DB 저장을 수행합니다.

## 처리 흐름

1. `TB_ISSUES.search_strategy`에서 검색 전략 로드
2. 국가법령정보 판례 목록 API 호출 (`lawSearch.do`)
3. 각 판례의 본문 조회 API 호출 (`lawService.do`)
4. 결과를 `TB_CASES`에 저장
5. API 호출 로그를 `TB_API_LOGS`에 저장

## 오류 처리

- API 응답 오류: 5초 후 재시도, 최대 3회
- 결과 0건: 보조 검색어로 재시도 1회
- 재시도 소진 시: HTTP 503 반환 + 에러 로그

## 구현 파일

`/backend/app/services/law_api_service.py`
