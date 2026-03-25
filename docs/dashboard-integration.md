# Dashboard Integration Notes

현재는 자동 다운로드 기능만 구현 범위에 포함된다.

향후 대시보드 연계 원칙:

- 버튼 클릭 시 `runMonthlyDownload(options)`를 직접 호출한다.
- 대시보드는 `data/raw`의 원본 파일과 `data/metadata/download-registry.json`을 분석 입력으로 사용한다.
- UI 계층은 게시판 파싱, 파일 저장, registry 업데이트 세부 구현을 직접 알지 않도록 분리한다.

## 현재 재사용 가능한 호출 지점

- 서비스 함수: `src/app/run-monthly-download.ts`
- CLI 래퍼: `src/cli/index.ts`
- 핵심 다운로드 서비스: `src/application/downloader/download-stay-foreigners-files.ts`

추천 호출 방식:

```ts
const result = await runMonthlyDownload({
  months: 3,
  dryRun: false,
});
```

## 대시보드가 기대할 반환값

현재 반환 DTO에는 다음이 포함된다.

- `downloaded`, `skipped`, `failed`
- `downloadedItems[]`
- `skippedItems[]`
- `failedItems[]`

각 item은 최소한 다음 필드를 가진다.

- `articleId`
- `articleTitle`
- `attachmentId`
- `attachmentName`
- `localPath` 또는 `reason`

대시보드 버튼은 이 반환값으로 즉시 실행 결과를 사용자에게 보여줄 수 있다.

## 분석 데이터 소스

- 원본 파일: `data/raw/{yyyy}/{yyyy-mm}/*.xlsx`
- 다운로드 이력: `data/metadata/download-registry.json`
- 운영 로그: `logs/download.log`

분석 대시보드는 우선 registry를 기준으로 사용 가능한 파일 목록을 만들고, 사용자가 선택한 파일만 로딩하는 방식이 적절하다.

## 후속 대시보드 작업 후보

- 다운로드 실행 버튼과 최근 실행 결과 패널 추가
- registry 기반 파일 목록/기간 필터 UI 추가
- 원본 엑셀 파싱 후 통계용 정규화 테이블 생성
- 체류자격, 국적, 지역, 성별, 연령대 등 조합 분석 뷰 구성

## 검증 메모

2026-03-25 기준 실제 검증 결과:

- 최초 실행에서 5개 월보 파일 다운로드 성공
- 재실행 시 동일 파일 5건 모두 skipped
- 실패 URL 주입 테스트에서 failed 결과가 반환되고 registry 성공 기록은 남지 않음
