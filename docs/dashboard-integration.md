# Dashboard Integration Notes

현재는 자동 다운로드 기능과 GitHub Pages용 정적 대시보드 1차 구현까지 포함된다.

대시보드 연계 원칙:

- 버튼 클릭 시 `runMonthlyDownload(options)`를 직접 호출한다.
- 대시보드는 `data/raw`의 원본 파일과 `data/metadata/download-registry.json`을 분석 입력으로 사용한다.
- UI 계층은 게시판 파싱, 파일 저장, registry 업데이트 세부 구현을 직접 알지 않도록 분리한다.
- GitHub Pages 공개 영역은 `site/`만 사용하고, raw/registry/log는 브라우저에 직접 노출하지 않는다.

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

## 현재 대시보드 공개 산출물

- `site/index.html`
- `site/styles.css`
- `site/app.js`
- `site/data/dashboard_data.json`

## 분석 데이터 소스

- 원본 파일: `data/raw/{yyyy}/{yyyy-mm}/*.xlsx`
- 다운로드 이력: `data/metadata/download-registry.json`
- 운영 로그: `logs/download.log`

분석 대시보드는 raw/registry를 로컬 집계 파이프라인에서만 사용하고, 브라우저는 집계 결과 JSON만 읽는다.

## 현재 구현 상태

- `npm run generate:dashboard`로 정적 dataset JSON 생성
- `site/index.html`에서 hero, 멀티 선택 필터, 3개 핵심 차트, 상세 표 렌더링
- `site/app.js`에서 dataset 로드, 국가/연도/월 멀티 선택, 국가 검색, 페이지네이션, Excel export 처리
- `site/styles.css`에서 family look 기반 glass panel, warm beige, rounded UI 적용

현재 필터와 차트 기본 해석:

- 국가 필터: 정규화된 19개 국가군 기준
- 연도/월 필터: 멀티 선택 가능
- 상단 차트: 선택 집합의 단기 관광객 시계열
- 좌측 하단 차트: 선택 집합 안에서 국가군별 `단기 관광객수 / 총합계`
- 우측 하단 차트: 선택 집합 전체 남/여 비중

## GitHub Pages 배포 절차

1. 로컬 또는 CI에서 `npm run generate:dashboard` 실행
2. `site/data/dashboard_data.json` 포함하여 `site/` 변경사항 커밋
3. GitHub Pages publish source를 `site/` 기준 정적 배포로 설정
4. 배포 후 브라우저는 `site/data/dashboard_data.json`만 fetch한다

## 후속 대시보드 작업 후보

- 다운로드 실행 버튼과 최근 실행 결과 패널 추가
- registry 기반 파일 목록/기간 필터 UI 추가
- 원본 엑셀 파싱 후 통계용 정규화 테이블 생성
- 체류자격, 국적, 지역, 성별, 연령대 등 조합 분석 뷰 구성

## 검증 메모

2026-03-25 기준 실제 검증 결과:

- `npm run check` 통과
- `npm run generate:dashboard` 통과
- `site/data/dashboard_data.json` 생성 확인
- dataset metadata 기준 `sourceRecordCount: 136`, `skippedSourceRecordCount: 1`
- 스킵 원본 1건은 `2025년 8월 출입국외국인정책 통계월보` 첨부이며, 현재 저장 파일이 HTML 응답으로 내려와 파싱 제외 처리됨
