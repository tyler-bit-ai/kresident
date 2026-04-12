/* ── kresident Dashboard Mockup ── */
/* 이 파일은 목업 대시보드용 정적 데이터와 렌더링 로직을 포함합니다 */

// ── 유틸리티 ──
const fmt = (v) => new Intl.NumberFormat("ko-KR").format(v ?? 0);
const pct = (v) => `${((v ?? 0) * 100).toFixed(1)}%`;
const period = (k) => { if (!k) return "-"; const [y, m] = k.split("-"); return `${y}.${m.padStart(2, "0")}`; };

// ── 목업 데이터셋 ──
const COUNTRIES = [
  { key: "cn", label: "중국", continent: "아시아" },
  { key: "jp", label: "일본", continent: "아시아" },
  { key: "tw", label: "타이완", continent: "아시아" },
  { key: "us", label: "미국", continent: "북미" },
  { key: "hk", label: "홍콩", continent: "아시아" },
  { key: "sg", label: "싱가포르", continent: "아시아" },
  { key: "vn", label: "베트남", continent: "아시아" },
  { key: "ph", label: "필리핀", continent: "아시아" },
  { key: "my", label: "말레이시아", continent: "아시아" },
  { key: "th", label: "타이", continent: "아시아" },
  { key: "au", label: "오스트레일리아", continent: "오세아니아" },
  { key: "ca", label: "캐나다", continent: "북미" },
  { key: "id", label: "인도네시아", continent: "아시아" },
  { key: "fr", label: "프랑스", continent: "유럽" },
  { key: "de", label: "독일", continent: "유럽" },
  { key: "ru", label: "러시아(연방)", continent: "유럽" },
  { key: "gb", label: "영국", continent: "유럽" },
  { key: "mn", label: "몽골", continent: "아시아" },
  { key: "etc", label: "기타", continent: "기타" },
];

const CONTINENTS = ["아시아", "북미", "유럽", "오세아니아", "기타"];
const CONTINENT_COLORS = {
  "아시아": "#c95e2a",
  "북미": "#3b6fa0",
  "유럽": "#2f7d4d",
  "오세아니아": "#8b6bb5",
  "기타": "#999",
};

// 계절성 기반 목업 값 생성
function seasonalBase(month) {
  // 한국 관광 시즌: 여름(7-8)과 가을(10)에 피크
  const factors = [0.7, 0.65, 0.8, 0.85, 0.82, 0.9, 1.0, 1.05, 0.88, 1.1, 0.95, 0.75];
  return factors[(month - 1) % 12];
}

// 국가별 기본 입국자 수 (월별 베이스라인)
const COUNTRY_BASELINE = {
  cn: 280000, jp: 95000, tw: 78000, us: 65000, hk: 42000,
  sg: 28000, vn: 55000, ph: 35000, my: 22000, th: 38000,
  au: 18000, ca: 15000, id: 20000, fr: 12000, de: 10000,
  ru: 14000, gb: 11000, mn: 16000, etc: 45000,
};

const COUNTRY_MALE_RATIO = {
  cn: 0.52, jp: 0.48, tw: 0.51, us: 0.55, hk: 0.49,
  sg: 0.53, vn: 0.58, ph: 0.45, my: 0.54, th: 0.47,
  au: 0.52, ca: 0.54, id: 0.56, fr: 0.50, de: 0.51,
  ru: 0.55, gb: 0.49, mn: 0.60, etc: 0.52,
};

// 국가별 비자 유형 기준 비율 (B1, B2, nonB1B2)
const COUNTRY_VISA_RATIO = {
  cn: { b1: 0.12, b2: 0.52 },   // 중국: B2(관광통과) 압도적
  jp: { b1: 0.62, b2: 0.10 },   // 일본: B1(사증면제) 압도적
  tw: { b1: 0.55, b2: 0.18 },   // 타이완: B1 비중 높음
  us: { b1: 0.58, b2: 0.12 },   // 미국: B1 비중 높음
  hk: { b1: 0.48, b2: 0.22 },   // 홍콩: B1 비중 높음
  sg: { b1: 0.50, b2: 0.15 },   // 싱가포르: B1 비중 높음
  vn: { b1: 0.08, b2: 0.55 },   // 베트남: B2 비중 높음
  ph: { b1: 0.15, b2: 0.45 },   // 필리핀: B2 비중 높음
  my: { b1: 0.42, b2: 0.20 },   // 말레이시아
  th: { b1: 0.38, b2: 0.25 },   // 타이
  au: { b1: 0.52, b2: 0.14 },   // 오스트레일리아: B1 비중 높음
  ca: { b1: 0.56, b2: 0.11 },   // 캐나다: B1 비중 높음
  id: { b1: 0.10, b2: 0.48 },   // 인도네시아: B2 비중 높음
  fr: { b1: 0.45, b2: 0.18 },   // 프랑스
  de: { b1: 0.44, b2: 0.16 },   // 독일
  ru: { b1: 0.18, b2: 0.38 },   // 러시아
  gb: { b1: 0.50, b2: 0.13 },   // 영국
  mn: { b1: 0.06, b2: 0.58 },   // 몽골: B2 압도적
  etc: { b1: 0.30, b2: 0.30 },  // 기타
};

// 상세 테이블 목업 데이터 생성
function generateMockDetailTable() {
  const rows = [];
  const years = [];
  for (let y = 2015; y <= 2026; y++) years.push(y);
  for (const year of years) {
    const maxMonth = year === 2026 ? 2 : 12;
    for (let month = 1; month <= maxMonth; month++) {
      for (const country of COUNTRIES) {
        const base = COUNTRY_BASELINE[country.key] ?? 10000;
        const seasonal = seasonalBase(month);
        // 연도별 성장 팩터: 2015=0.55 → 2026=1.05 (점진적 성장 + 코로나 충격 반영)
        let yearFactor;
        if (year <= 2016) yearFactor = 0.58;
        else if (year <= 2018) yearFactor = 0.65;
        else if (year === 2019) yearFactor = 0.75;
        else if (year === 2020) yearFactor = 0.22;
        else if (year === 2021) yearFactor = 0.15;
        else if (year === 2022) yearFactor = 0.38;
        else if (year === 2023) yearFactor = 0.72;
        else if (year === 2024) yearFactor = 0.90;
        else if (year === 2025) yearFactor = 1.0;
        else yearFactor = 1.05;
        const total = Math.round(base * seasonal * yearFactor * (0.9 + Math.random() * 0.2));
        const maleRatio = COUNTRY_MALE_RATIO[country.key] ?? 0.5;
        const male = Math.round(total * maleRatio);
        const female = total - male;
        // 국가별 비자 비율 + 계절적 변동 (여름에 B2 관광 증가)
        const visaBase = COUNTRY_VISA_RATIO[country.key] ?? { b1: 0.30, b2: 0.30 };
        const b1Ratio = Math.max(0.02, Math.min(0.85, visaBase.b1 + (Math.random() - 0.5) * 0.08 + (month >= 6 && month <= 8 ? -0.04 : 0)));
        const b2Ratio = Math.max(0.02, Math.min(0.85, visaBase.b2 + (Math.random() - 0.5) * 0.08 + (month >= 6 && month <= 8 ? 0.05 : 0)));
        const nonRatio = Math.max(0.02, 1 - b1Ratio - b2Ratio);
        const b1Total = Math.round(total * b1Ratio);
        const b2Total = Math.round(total * b2Ratio);
        const nonTotal = total - b1Total - b2Total;
        rows.push({
          periodKey: `${year}-${String(month).padStart(2, "0")}`,
          year, month,
          normalizedCountryKey: country.key,
          normalizedCountryLabel: country.label,
          countryName: country.label,
          continentName: country.continent,
          shortTermVisitorsTotal: total,
          maleShortTermVisitors: male,
          femaleShortTermVisitors: female,
          totalPopulationCount: Math.round(total * (2.5 + Math.random())),
          shortTermVisaRatio: 0.3 + Math.random() * 0.5,
          monthlyShareRatio: Math.random() * 0.15,
          b1ShortTermVisitorsTotal: b1Total,
          maleB1ShortTermVisitors: Math.round(b1Total * maleRatio),
          femaleB1ShortTermVisitors: Math.round(b1Total * (1 - maleRatio)),
          b1MonthlyShareRatio: Math.random() * 0.1,
          b1ShortTermVisaRatio: 0.2 + Math.random() * 0.3,
          b2ShortTermVisitorsTotal: b2Total,
          maleB2ShortTermVisitors: Math.round(b2Total * maleRatio),
          femaleB2ShortTermVisitors: Math.round(b2Total * (1 - maleRatio)),
          b2MonthlyShareRatio: Math.random() * 0.08,
          b2ShortTermVisaRatio: 0.15 + Math.random() * 0.25,
          nonB1B2ShortTermVisitorsTotal: nonTotal,
          maleNonB1B2ShortTermVisitors: Math.round(nonTotal * maleRatio),
          femaleNonB1B2ShortTermVisitors: Math.round(nonTotal * (1 - maleRatio)),
          nonB1B2MonthlyShareRatio: Math.random() * 0.1,
          nonB1B2ShortTermVisaRatio: 0.1 + Math.random() * 0.2,
        });
      }
    }
  }
  return rows;
}

const state = {
  visitMode: "all",
  selectedCountries: [],
  selectedYears: [],
  selectedMonthsByYear: {},
  searchKeyword: "",
  currentPage: 1,
  pageSize: 20,
  detailTable: generateMockDetailTable(),
};

const BASE_VISIT_MODES = [
  { key: "all", label: "전체", shortLabel: "전체" },
  { key: "b1", label: "B1(사증면제)", shortLabel: "B1" },
  { key: "b2", label: "B2(관광통과)", shortLabel: "B2" },
  { key: "nonB1B2", label: "단기관광객(B1,B2 제외)", shortLabel: "B1,B2 제외" },
];

// ── 필터 로직 ──
function getMetricKeys() {
  if (state.visitMode === "b1") return { total: "b1ShortTermVisitorsTotal", male: "maleB1ShortTermVisitors", female: "femaleB1ShortTermVisitors", share: "b1MonthlyShareRatio", ratio: "b1ShortTermVisaRatio" };
  if (state.visitMode === "b2") return { total: "b2ShortTermVisitorsTotal", male: "maleB2ShortTermVisitors", female: "femaleB2ShortTermVisitors", share: "b2MonthlyShareRatio", ratio: "b2ShortTermVisaRatio" };
  if (state.visitMode === "nonB1B2") return { total: "nonB1B2ShortTermVisitorsTotal", male: "maleNonB1B2ShortTermVisitors", female: "femaleNonB1B2ShortTermVisitors", share: "nonB1B2MonthlyShareRatio", ratio: "nonB1B2ShortTermVisaRatio" };
  return { total: "shortTermVisitorsTotal", male: "maleShortTermVisitors", female: "femaleShortTermVisitors", share: "monthlyShareRatio", ratio: "shortTermVisaRatio" };
}

function getRowSnapshot(row) {
  const k = getMetricKeys();
  return {
    total: Number(row?.[k.total] ?? 0),
    male: row?.[k.male] ?? null,
    female: row?.[k.female] ?? null,
    shareRatio: row?.[k.share] ?? null,
    visaRatio: row?.[k.ratio] ?? null,
  };
}

function matchesCountry(row) {
  return state.selectedCountries.length === 0 || state.selectedCountries.includes(row.normalizedCountryLabel);
}

function matchesYearMonth(row) {
  if (state.selectedYears.length === 0) return true;
  const yk = String(row.year);
  if (!state.selectedYears.includes(yk)) return false;
  const sm = state.selectedMonthsByYear[yk] ?? [];
  return sm.length === 0 || sm.includes(String(row.month));
}

function matchesPeriod(p) {
  if (state.selectedYears.length === 0) return true;
  const yk = String(p.year);
  if (!state.selectedYears.includes(yk)) return false;
  const sm = state.selectedMonthsByYear[yk] ?? [];
  return sm.length === 0 || sm.includes(String(p.month));
}

function getFilteredRows() {
  return state.detailTable.filter(r => matchesCountry(r) && matchesYearMonth(r));
}

function getTableRows() {
  return getFilteredRows()
    .filter(r => r.countryName.toLowerCase().includes(state.searchKeyword.trim().toLowerCase()))
    .sort((a, b) => b.periodKey.localeCompare(a.periodKey) || a.normalizedCountryLabel.localeCompare(b.normalizedCountryLabel, "ko"));
}

function getModeLabel() {
  const m = BASE_VISIT_MODES.find(m => m.key === state.visitMode);
  return m ? m.label : "전체";
}

function summarizeSelection() {
  return {
    modeLabel: getModeLabel(),
    countryCount: state.selectedCountries.length > 0 ? state.selectedCountries.length : COUNTRIES.length,
    yearLabel: state.selectedYears.length > 0 ? `${state.selectedYears.length}개 연도` : "전체 연도",
    monthLabel: state.selectedYears.length === 0 ? "전체 월" : state.selectedYears.map(y => {
      const ms = state.selectedMonthsByYear[y] ?? [];
      return ms.length === 0 ? `${y}년 전체` : `${y}년 ${ms.length}개월`;
    }).join(" + "),
  };
}

// ── 필터 렌더링 ──
function createChip(label, selected, onClick) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = `filter-chip-button${selected ? " is-selected" : ""}`;
  btn.textContent = label;
  btn.addEventListener("click", onClick);
  return btn;
}

function renderFilters() {
  // 입국 구분
  const vmEl = document.getElementById("visit-mode-options");
  vmEl.replaceChildren(...BASE_VISIT_MODES.map(m =>
    createChip(m.label, state.visitMode === m.key, () => { state.visitMode = m.key; state.currentPage = 1; renderDashboard(); })
  ));

  // 국가
  const coEl = document.getElementById("country-filter-options");
  coEl.replaceChildren(
    createChip("전체", state.selectedCountries.length === 0, () => { state.selectedCountries = []; state.currentPage = 1; renderDashboard(); }),
    ...COUNTRIES.map(c => createChip(c.label, state.selectedCountries.includes(c.label), () => {
      state.selectedCountries = state.selectedCountries.includes(c.label)
        ? state.selectedCountries.filter(x => x !== c.label)
        : [...state.selectedCountries, c.label];
      state.currentPage = 1;
      renderDashboard();
    }))
  );

  // 연도
  const years = [...new Set(state.detailTable.map(r => r.year))].sort().map(String);
  const yrEl = document.getElementById("year-filter-options");
  yrEl.replaceChildren(...years.map(y =>
    createChip(`${y}년`, state.selectedYears.includes(y), () => {
      state.selectedYears = state.selectedYears.includes(y)
        ? state.selectedYears.filter(x => x !== y)
        : [...state.selectedYears, y].sort();
      state.selectedMonthsByYear = Object.fromEntries(state.selectedYears.map(y => [y, state.selectedMonthsByYear[y] ?? []]));
      state.currentPage = 1;
      renderDashboard();
    })
  ));

  // 월
  const moEl = document.getElementById("month-filter-options");
  if (state.selectedYears.length === 0) {
    moEl.replaceChildren(createEmptyState("연도를 먼저 선택하면 월 필터가 표시됩니다."));
    return;
  }

  const cards = state.selectedYears.map(y => {
    const card = document.createElement("section");
    card.className = "month-year-card";
    const header = document.createElement("div");
    header.className = "month-year-card-header";
    const title = document.createElement("strong");
    title.className = "month-year-card-title";
    title.textContent = `${y}년`;
    const actions = document.createElement("div");
    actions.className = "month-year-card-actions";
    actions.append(createChip("전체", (state.selectedMonthsByYear[y] ?? []).length === 0, () => {
      state.selectedMonthsByYear[y] = [];
      state.currentPage = 1;
      renderDashboard();
    }));
    header.append(title, actions);
    const chips = document.createElement("div");
    chips.className = "month-year-chip-list";
    for (let m = 1; m <= 12; m++) {
      chips.append(createChip(`${m}월`, (state.selectedMonthsByYear[y] ?? []).includes(String(m)), () => {
        const cur = state.selectedMonthsByYear[y] ?? [];
        state.selectedMonthsByYear[y] = cur.includes(String(m)) ? cur.filter(x => x !== String(m)) : [...cur, String(m)].sort();
        state.currentPage = 1;
        renderDashboard();
      }));
    }
    card.append(header, chips);
    return card;
  });
  moEl.replaceChildren(...cards);
}

// ── 빈 상태 ──
function createEmptyState(msg) {
  const d = document.createElement("div");
  d.style.cssText = "width:100%;padding:20px;text-align:center;color:var(--muted);font-size:0.88rem;";
  d.textContent = msg;
  return d;
}

function setPlaceholder(target, msg) {
  target.replaceChildren(createEmptyState(msg));
}

// ── KPI 렌더링 ──
function renderKPIs() {
  const rows = getFilteredRows();
  const total = rows.reduce((s, r) => s + getRowSnapshot(r).total, 0);
  const periods = [...new Set(rows.map(r => r.periodKey))].length;
  const avg = periods > 0 ? Math.round(total / periods) : 0;

  // 전월대비
  const sortedPeriods = [...new Set(rows.map(r => r.periodKey))].sort();
  const lastPeriod = sortedPeriods[sortedPeriods.length - 1];
  const prevPeriod = sortedPeriods[sortedPeriods.length - 2];
  const lastTotal = rows.filter(r => r.periodKey === lastPeriod).reduce((s, r) => s + getRowSnapshot(r).total, 0);
  const prevTotal = rows.filter(r => r.periodKey === prevPeriod).reduce((s, r) => s + getRowSnapshot(r).total, 0);
  const momChange = prevTotal > 0 ? ((lastTotal - prevTotal) / prevTotal) : 0;

  // 최다 국가
  const byCountry = new Map();
  for (const r of rows) {
    const cur = byCountry.get(r.normalizedCountryLabel) ?? 0;
    byCountry.set(r.normalizedCountryLabel, cur + getRowSnapshot(r).total);
  }
  const topCountry = [...byCountry.entries()].sort((a, b) => b[1] - a[1])[0];

  document.getElementById("kpi-total").textContent = fmt(total);
  document.getElementById("kpi-monthly-avg").textContent = fmt(avg);

  const momEl = document.getElementById("kpi-mom");
  momEl.textContent = `${momChange >= 0 ? "+" : ""}${(momChange * 100).toFixed(1)}%`;
  momEl.className = `kpi-value ${momChange >= 0 ? "kpi-up" : "kpi-down"}`;

  if (topCountry) {
    document.getElementById("kpi-top-country").textContent = topCountry[0];
    const share = total > 0 ? (topCountry[1] / total) : 0;
    document.querySelector("#kpi-top-country + .kpi-meta").textContent = `${fmt(topCountry[1])}명 · ${pct(share)}`;
  }
}

// ── 차트 01: 시계열 ──
function renderTrendChart() {
  const target = document.getElementById("monthly-trend-chart");
  const keys = getMetricKeys();

  // 필터링된 detailTable에서 월별 집산 (국가/연도/월/입국구분 모두 반영)
  const rows = getFilteredRows();
  const byPeriod = new Map();
  for (const r of rows) {
    const cur = byPeriod.get(r.periodKey) ?? { periodKey: r.periodKey, year: r.year, month: r.month, total: 0 };
    cur.total += Number(r[keys.total] ?? 0);
    byPeriod.set(r.periodKey, cur);
  }

  const points = [...byPeriod.values()]
    .filter(p => p.total > 0)
    .sort((a, b) => a.periodKey.localeCompare(b.periodKey));

  if (points.length === 0) { setPlaceholder(target, "데이터가 없습니다."); return; }

  const W = 860, H = 280, M = { top: 18, right: 20, bottom: 30, left: 64 };
  const cW = W - M.left - M.right, cH = H - M.top - M.bottom;
  const maxV = Math.max(...points.map(p => p.total), 1);
  const stepX = cW / Math.max(points.length - 1, 1);

  const coords = points.map((p, i) => ({
    ...p, x: M.left + stepX * i, y: M.top + cH - (p.total / maxV) * cH
  }));

  const areaPath = `M ${coords[0].x} ${M.top + cH} ` + coords.map(p => `L ${p.x} ${p.y}`).join(" ") + ` L ${coords[coords.length - 1].x} ${M.top + cH} Z`;
  const linePath = coords.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");

  const grid = Array.from({ length: 4 }, (_, i) => {
    const r = i / 3, v = Math.round(maxV * (1 - r)), y = M.top + cH * r;
    return `<line class="chart-grid-line" x1="${M.left}" y1="${y}" x2="${W - M.right}" y2="${y}"></line><text class="chart-axis" x="${M.left - 10}" y="${y + 4}" text-anchor="end">${fmt(v)}</text>`;
  }).join("");

  const ticks = Array.from({ length: Math.min(points.length, 6) }, (_, i) =>
    Math.round((points.length - 1) * i / Math.max(Math.min(points.length, 6) - 1, 1))
  );
  const xLabels = [...new Set(ticks)].map(i => {
    const p = coords[i];
    return `<text class="chart-axis" x="${p.x}" y="${H - 6}" text-anchor="middle">${period(p.periodKey)}</text>`;
  }).join("");

  const dots = coords.map((p, i) => `
    <circle class="chart-data-dot" cx="${p.x}" cy="${p.y}" r="3.5"></circle>
    <circle class="chart-hit-dot" cx="${p.x}" cy="${p.y}" r="12" tabindex="0" data-idx="${i}" aria-label="${period(p.periodKey)} ${fmt(p.total)}명"></circle>
  `).join("");

  const last = coords[coords.length - 1];
  const sel = summarizeSelection();

  target.innerHTML = `
    <div class="chart-layout">
      <div class="trend-chart-stage">
        <svg class="chart-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="시계열">
          ${grid}
          <path class="chart-area" d="${areaPath}"></path>
          <path class="chart-line" d="${linePath}"></path>
          ${dots}
          <circle class="chart-highlight-dot" cx="${last.x}" cy="${last.y}" r="5"></circle>
          ${xLabels}
        </svg>
        <div class="chart-tooltip" hidden></div>
      </div>
      <div class="chart-annotation">
        <span class="annotation-chip">${sel.modeLabel}</span>
        <span class="annotation-chip">${sel.countryCount}개 국가군</span>
        <span class="annotation-chip">${sel.yearLabel}</span>
        <span class="annotation-chip">${sel.monthLabel}</span>
        <span class="annotation-chip mono">최근값 ${fmt(last.total)} 명</span>
      </div>
    </div>
  `;

  const stage = target.querySelector(".trend-chart-stage");
  const tooltip = target.querySelector(".chart-tooltip");
  if (stage && tooltip) {
    stage.querySelectorAll("[data-idx]").forEach(n => {
      const p = coords[Number(n.dataset.idx)];
      if (!p) return;
      n.addEventListener("mouseenter", () => {
        const b = stage.getBoundingClientRect();
        tooltip.innerHTML = `<strong>${period(p.periodKey)}</strong><span>${fmt(p.total)}명</span>`;
        tooltip.style.left = `${(p.x / W) * b.width}px`;
        tooltip.style.top = `${(p.y / H) * b.height}px`;
        tooltip.hidden = false;
      });
      n.addEventListener("mouseleave", () => { tooltip.hidden = true; });
    });
  }
}

// ── 차트 02: 국가별 단기 비자 비율 ──
function renderVisaRatioChart() {
  const target = document.getElementById("top-country-chart");
  const rows = getFilteredRows();
  const byCountry = new Map();
  for (const r of rows) {
    const snap = getRowSnapshot(r);
    const cur = byCountry.get(r.normalizedCountryLabel) ?? { visitors: 0, total: 0 };
    cur.visitors += snap.total;
    cur.total += r.totalPopulationCount ?? 0;
    byCountry.set(r.normalizedCountryLabel, cur);
  }

  const series = [...byCountry.entries()]
    .map(([name, d]) => ({ name, ratio: d.total > 0 ? d.visitors / d.total : null, visitors: d.visitors }))
    .filter(d => d.ratio !== null && d.visitors > 0)
    .sort((a, b) => b.ratio - a.ratio);

  if (series.length === 0) { setPlaceholder(target, "데이터가 없습니다."); return; }

  const maxR = Math.max(...series.map(d => d.ratio), 0.01);
  const listHTML = series.map(d => `
    <div class="bar-row">
      <div class="bar-label">${d.name}</div>
      <div class="bar-track"><div class="bar-fill" style="width:${(d.ratio / maxR) * 100}%"></div></div>
      <div class="bar-meta">${pct(d.ratio)}</div>
    </div>
  `).join("");

  target.innerHTML = `
    <div class="chart-layout">
      <div class="chart-annotation">
        <span class="annotation-chip">${getModeLabel()}</span>
        <span class="annotation-chip">국가별 비율</span>
        <span class="annotation-chip mono">분모: 총 입국자</span>
      </div>
      <div class="bar-list">${listHTML}</div>
    </div>
  `;
}

// ── 차트 04: 국가별 단기 입국자 비중 ──
function renderCountryShareChart() {
  const target = document.getElementById("country-visitor-pie-chart");
  const rows = getFilteredRows();
  const byCountry = new Map();
  let totalAll = 0;
  for (const r of rows) {
    const snap = getRowSnapshot(r);
    const cur = byCountry.get(r.normalizedCountryLabel) ?? 0;
    byCountry.set(r.normalizedCountryLabel, cur + snap.total);
    totalAll += snap.total;
  }

  const series = [...byCountry.entries()]
    .map(([name, v]) => ({ name, value: v, share: totalAll > 0 ? v / totalAll : 0 }))
    .sort((a, b) => b.value - a.value);

  if (series.length === 0) { setPlaceholder(target, "데이터가 없습니다."); return; }

  const maxS = Math.max(...series.map(d => d.share), 0.01);
  const listHTML = series.map(d => `
    <div class="bar-row">
      <div class="bar-label">${d.name}</div>
      <div class="bar-track"><div class="bar-fill" style="width:${(d.share / maxS) * 100}%"></div></div>
      <div class="bar-meta">${fmt(d.value)}명 · ${pct(d.share)}</div>
    </div>
  `).join("");

  const sel = summarizeSelection();
  target.innerHTML = `
    <div class="chart-layout">
      <div class="chart-annotation">
        <span class="annotation-chip">${sel.modeLabel}</span>
        <span class="annotation-chip">${sel.yearLabel}</span>
        <span class="annotation-chip">${sel.monthLabel}</span>
        <span class="annotation-chip mono">총 ${fmt(totalAll)} 명</span>
      </div>
      <div class="bar-list">${listHTML}</div>
    </div>
  `;
}

// ── 차트 03: 성별 비중 ──
function renderGenderChart() {
  const target = document.getElementById("gender-share-chart");
  const rows = getFilteredRows();
  const byCountry = new Map();
  for (const r of rows) {
    const snap = getRowSnapshot(r);
    const cur = byCountry.get(r.normalizedCountryLabel) ?? { male: 0, female: 0 };
    cur.male += snap.male ?? 0;
    cur.female += snap.female ?? 0;
    byCountry.set(r.normalizedCountryLabel, cur);
  }

  const series = [...byCountry.entries()]
    .map(([name, d]) => {
      const total = d.male + d.female;
      return { name, male: d.male, female: d.female, total, maleR: total > 0 ? d.male / total : 0, femaleR: total > 0 ? d.female / total : 0 };
    })
    .filter(d => d.total > 0)
    .sort((a, b) => b.total - a.total);

  if (series.length === 0) { setPlaceholder(target, "데이터가 없습니다."); return; }

  const totalCount = series.reduce((s, d) => s + d.total, 0);
  const sel = summarizeSelection();

  const listHTML = series.map(d => `
    <article class="gender-stack-row">
      <div class="gender-stack-copy">
        <div><strong>${d.name}</strong><span class="panel-note">총 ${fmt(d.total)} 명</span></div>
        <span class="gender-stack-meta mono">${pct(d.maleR)} / ${pct(d.femaleR)}</span>
      </div>
      <div class="gender-stack-bar" aria-label="${d.name} 성별 비중">
        <div class="gender-stack-segment gender-stack-segment-male" style="width:${d.maleR * 100}%"><span>${pct(d.maleR)}</span></div>
        <div class="gender-stack-segment gender-stack-segment-female" style="width:${d.femaleR * 100}%"><span>${pct(d.femaleR)}</span></div>
      </div>
    </article>
  `).join("");

  target.innerHTML = `
    <div class="chart-layout">
      <div class="chart-annotation">
        <span class="annotation-chip">${sel.modeLabel}</span>
        <span class="annotation-chip">${sel.countryCount}개 국가군 비교</span>
        <span class="annotation-chip mono">총 ${fmt(totalCount)} 명</span>
      </div>
      <div class="chart-annotation">
        <span class="legend-chip"><span class="legend-swatch" style="background:#c95e2a;"></span>남성</span>
        <span class="legend-chip"><span class="legend-swatch" style="background:#2f7d4d;"></span>여성</span>
      </div>
      <div class="gender-stack-list">${listHTML}</div>
    </div>
  `;
}

// ── 차트 05: 히트맵 ──
function renderHeatmap() {
  const target = document.getElementById("heatmap-chart");
  const rows = getFilteredRows();

  // 최근 12개월 추출
  const allPeriods = [...new Set(rows.map(r => r.periodKey))].sort();
  const recentPeriods = allPeriods.slice(-12);
  if (recentPeriods.length === 0) { setPlaceholder(target, "데이터가 없습니다."); return; }

  // 상위 10개국 추출
  const byCountry = new Map();
  for (const r of rows) {
    const cur = byCountry.get(r.normalizedCountryLabel) ?? 0;
    byCountry.set(r.normalizedCountryLabel, cur + getRowSnapshot(r).total);
  }
  const topCountries = [...byCountry.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(e => e[0]);

  // 매트릭스 생성
  const matrix = new Map();
  let maxVal = 1;
  for (const r of rows) {
    if (!recentPeriods.includes(r.periodKey) || !topCountries.includes(r.normalizedCountryLabel)) continue;
    const key = `${r.normalizedCountryLabel}|${r.periodKey}`;
    const cur = matrix.get(key) ?? 0;
    matrix.set(key, cur + getRowSnapshot(r).total);
    if (cur + getRowSnapshot(r).total > maxVal) maxVal = cur + getRowSnapshot(r).total;
  }

  const headerCells = `<th></th>${recentPeriods.map(p => `<th>${period(p)}</th>`).join("")}`;
  const bodyRows = topCountries.map(country => {
    const cells = recentPeriods.map(p => {
      const val = matrix.get(`${country}|${p}`) ?? 0;
      const intensity = val / maxVal;
      const level = Math.min(8, Math.max(1, Math.ceil(intensity * 8)));
      return `<td class="heat-${level}" title="${country} ${period(p)}: ${fmt(val)}명">${fmt(val)}</td>`;
    }).join("");
    return `<tr><td class="heatmap-label">${country}</td>${cells}</tr>`;
  }).join("");

  const legendSwatches = [1,2,3,4,5,6,7,8].map(i => {
    const colors = [
      "rgba(47,125,77,0.18)", "rgba(47,125,77,0.28)", "rgba(47,125,77,0.40)",
      "rgba(184,134,11,0.22)", "rgba(184,134,11,0.34)",
      "rgba(196,100,32,0.28)", "rgba(196,67,50,0.24)", "rgba(196,67,50,0.40)"
    ];
    return `<span class="heatmap-legend-swatch" style="background:${colors[i-1]}"></span>`;
  }).join("");

  target.innerHTML = `
    <div style="overflow-x:auto;">
      <table class="heatmap-table">
        <thead><tr>${headerCells}</tr></thead>
        <tbody>${bodyRows}</tbody>
      </table>
    </div>
    <div class="heatmap-legend">
      <span class="heatmap-legend-label">적음</span>
      <div class="heatmap-legend-bar">${legendSwatches}</div>
      <span class="heatmap-legend-label">많음</span>
    </div>
  `;
}

// ── 차트 06: 대륙별 분포 ──
function renderContinentChart() {
  const target = document.getElementById("continent-chart");
  const rows = getFilteredRows();
  const byContinent = new Map();
  let totalAll = 0;
  for (const r of rows) {
    const cont = r.continentName ?? "기타";
    const cur = byContinent.get(cont) ?? 0;
    byContinent.set(cont, cur + getRowSnapshot(r).total);
    totalAll += getRowSnapshot(r).total;
  }

  const series = [...byContinent.entries()]
    .map(([name, v]) => ({ name, value: v, share: totalAll > 0 ? v / totalAll : 0, color: CONTINENT_COLORS[name] ?? "#999" }))
    .sort((a, b) => b.value - a.value);

  if (series.length === 0) { setPlaceholder(target, "데이터가 없습니다."); return; }

  // 간단한 수평 바 차트
  const maxV = Math.max(...series.map(d => d.value), 1);
  const listHTML = series.map(d => `
    <div class="bar-row">
      <div class="bar-label">${d.name}</div>
      <div class="bar-track">
        <div class="bar-fill" style="width:${(d.value / maxV) * 100}%;background:linear-gradient(90deg,${d.color},${d.color}cc)"></div>
      </div>
      <div class="bar-meta">${fmt(d.value)}명 · ${pct(d.share)}</div>
    </div>
  `).join("");

  target.innerHTML = `
    <div class="chart-layout">
      <div class="chart-annotation">
        ${series.map(d => `<span class="legend-chip"><span class="legend-swatch" style="background:${d.color}"></span>${d.name}</span>`).join("")}
      </div>
      <div class="bar-list">${listHTML}</div>
    </div>
  `;
}

// ── 차트 07: YoY 순위 ──
function renderYoYChart() {
  const target = document.getElementById("yoy-chart");
  const rows = getFilteredRows();

  // 최근월과 전년 동월 찾기
  const allPeriods = [...new Set(rows.map(r => r.periodKey))].sort();
  const lastP = allPeriods[allPeriods.length - 1];
  if (!lastP) { setPlaceholder(target, "데이터가 없습니다."); return; }

  const [lastY, lastM] = lastP.split("-");
  const prevYP = `${Number(lastY) - 1}-${lastM}`;

  const byCountryLast = new Map();
  const byCountryPrev = new Map();
  for (const r of rows) {
    const snap = getRowSnapshot(r);
    if (r.periodKey === lastP) byCountryLast.set(r.normalizedCountryLabel, (byCountryLast.get(r.normalizedCountryLabel) ?? 0) + snap.total);
    if (r.periodKey === prevYP) byCountryPrev.set(r.normalizedCountryLabel, (byCountryPrev.get(r.normalizedCountryLabel) ?? 0) + snap.total);
  }

  const allCountries = [...new Set([...byCountryLast.keys(), ...byCountryPrev.keys()])];
  const series = allCountries.map(name => {
    const cur = byCountryLast.get(name) ?? 0;
    const prev = byCountryPrev.get(name) ?? 0;
    const change = prev > 0 ? (cur - prev) / prev : null;
    return { name, cur, prev, change };
  }).filter(d => d.change !== null && d.cur > 0)
    .sort((a, b) => (b.change ?? 0) - (a.change ?? 0));

  if (series.length === 0) { setPlaceholder(target, "비교할 데이터가 없습니다."); return; }

  const maxAbs = Math.max(...series.map(d => Math.abs(d.change ?? 0)), 0.01);
  const listHTML = series.map((d, i) => {
    const isPositive = (d.change ?? 0) >= 0;
    const barWidth = (Math.abs(d.change ?? 0) / maxAbs) * 100;
    return `
      <div class="yoy-row">
        <span class="yoy-rank ${i < 3 ? "yoy-rank-top" : ""}">${i + 1}</span>
        <span class="yoy-label">${d.name}</span>
        <div class="yoy-bar-track">
          <div class="yoy-bar-fill ${isPositive ? "yoy-bar-positive" : "yoy-bar-negative"}" style="width:${barWidth}%"></div>
        </div>
        <span class="yoy-value ${isPositive ? "yoy-positive" : "yoy-negative"}">${isPositive ? "+" : ""}${((d.change ?? 0) * 100).toFixed(1)}%</span>
      </div>
    `;
  }).join("");

  target.innerHTML = `
    <div class="chart-layout">
      <div class="chart-annotation">
        <span class="annotation-chip">${period(lastP)} vs ${period(prevYP)}</span>
        <span class="annotation-chip mono">전년동월비</span>
      </div>
      <div class="yoy-list">${listHTML}</div>
    </div>
  `;
}

// ── 상세 테이블 ──
function renderTable() {
  const rows = getTableRows();
  const totalPages = Math.max(Math.ceil(rows.length / state.pageSize), 1);
  state.currentPage = Math.min(state.currentPage, totalPages);
  const pageStart = (state.currentPage - 1) * state.pageSize;
  const pageRows = rows.slice(pageStart, pageStart + state.pageSize);

  const tbody = document.getElementById("detail-table-body");
  if (pageRows.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:var(--muted);padding:24px;">조건에 맞는 데이터가 없습니다.</td></tr>`;
  } else {
    tbody.innerHTML = pageRows.map(r => {
      const snap = getRowSnapshot(r);
      return `<tr>
        <td class="mono">${period(r.periodKey)}</td>
        <td>${r.continentName ?? "-"}</td>
        <td>${r.normalizedCountryLabel}</td>
        <td>${fmt(snap.total)}</td>
        <td>${snap.male === null ? "-" : fmt(snap.male)}</td>
        <td>${snap.female === null ? "-" : fmt(snap.female)}</td>
        <td>${snap.shareRatio === null ? "-" : pct(snap.shareRatio)}</td>
      </tr>`;
    }).join("");
  }

  document.getElementById("table-summary").textContent = `${fmt(rows.length)}건 중 ${fmt(pageRows.length)}건 표시`;
  document.getElementById("table-page-info").textContent = `${state.currentPage} / ${totalPages}`;
  document.getElementById("table-prev-button").disabled = state.currentPage <= 1;
  document.getElementById("table-next-button").disabled = state.currentPage >= totalPages;
}

// ── 전체 렌더링 ──
function renderDashboard() {
  renderKPIs();
  renderFilters();
  renderTrendChart();       // Chart 01
  renderVisaRatioChart();   // Chart 02
  renderCountryShareChart();// Chart 03
  renderGenderChart();      // Chart 04
  renderHeatmap();          // Chart 05
  renderContinentChart();   // Chart 06
  renderYoYChart();         // Chart 07
  renderTable();
}

// ── 이벤트 바인딩 ──
function bindEvents() {
  document.getElementById("country-clear-button").addEventListener("click", () => { state.selectedCountries = []; state.currentPage = 1; renderDashboard(); });
  document.getElementById("year-clear-button").addEventListener("click", () => { state.selectedYears = []; state.selectedMonthsByYear = {}; state.currentPage = 1; renderDashboard(); });
  document.getElementById("month-clear-button").addEventListener("click", () => { state.selectedMonthsByYear = {}; state.currentPage = 1; renderDashboard(); });

  document.getElementById("country-search").addEventListener("input", e => { state.searchKeyword = e.target.value; state.currentPage = 1; renderTable(); });

  document.getElementById("table-prev-button").addEventListener("click", () => { state.currentPage = Math.max(1, state.currentPage - 1); renderTable(); });
  document.getElementById("table-next-button").addEventListener("click", () => {
    const totalPages = Math.max(Math.ceil(getTableRows().length / state.pageSize), 1);
    state.currentPage = Math.min(totalPages, state.currentPage + 1);
    renderTable();
  });

  document.getElementById("table-export-button").addEventListener("click", () => {
    alert("목업 대시보드에서는 Excel 다운로드가 비활성화되어 있습니다.");
  });

  // 도움말 모달
  document.getElementById("help-open-button").addEventListener("click", () => { document.getElementById("help-modal").hidden = false; document.body.classList.add("modal-open"); });
  document.getElementById("help-close-button").addEventListener("click", () => { document.getElementById("help-modal").hidden = true; document.body.classList.remove("modal-open"); });
  document.getElementById("help-close-backdrop").addEventListener("click", () => { document.getElementById("help-modal").hidden = true; document.body.classList.remove("modal-open"); });
  document.addEventListener("keydown", e => { if (e.key === "Escape" && !document.getElementById("help-modal").hidden) { document.getElementById("help-modal").hidden = true; document.body.classList.remove("modal-open"); } });
}

// ── 초기화 ──
renderDashboard();
bindEvents();
