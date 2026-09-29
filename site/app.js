/* ── kresident Dashboard ── */
/* 실제 집계 dataset을 로딩해 정적 대시보드를 렌더링합니다 */

const fmt = (value) => new Intl.NumberFormat("ko-KR").format(value ?? 0);
const pct = (value) => `${((value ?? 0) * 100).toFixed(1)}%`;
const period = (periodKey) => {
  if (!periodKey) return "-";
  const [year, month] = periodKey.split("-");
  return `${year}.${month.padStart(2, "0")}`;
};

/* 대륙 색상: 원본 값(아시아주, 북아메리카주 …)의 '주'를 떼고 매칭한다 */
const CONTINENT_COLORS = {
  "아시아": "var(--s1)",
  "유럽": "var(--s3)",
  "북아메리카": "var(--s2)",
  "남아메리카": "var(--s5)",
  "오세아니아": "var(--s4)",
  "아프리카": "var(--s6)",
  "기타": "var(--text-tertiary)",
};

function continentColor(name) {
  const key = String(name ?? "기타").replace(/주$/, "");
  return CONTINENT_COLORS[key] ?? CONTINENT_COLORS["기타"];
}

/* 입국 구분: fields는 detailTable 행에서 값을 읽는 필드명 */
const SHORT_VISIT_MODES = [
  {
    key: "all", label: "전체", shortLabel: "전체",
    fields: { total: "shortTermVisitorsTotal", male: "maleShortTermVisitors", female: "femaleShortTermVisitors", share: "monthlyShareRatio", ratio: "shortTermVisaRatio" },
  },
  {
    key: "b1", label: "B1(사증면제)", shortLabel: "B1",
    fields: { total: "b1ShortTermVisitorsTotal", male: "maleB1ShortTermVisitors", female: "femaleB1ShortTermVisitors", share: "b1MonthlyShareRatio", ratio: "b1ShortTermVisaRatio" },
  },
  {
    key: "b2", label: "B2(관광통과)", shortLabel: "B2",
    fields: { total: "b2ShortTermVisitorsTotal", male: "maleB2ShortTermVisitors", female: "femaleB2ShortTermVisitors", share: "b2MonthlyShareRatio", ratio: "b2ShortTermVisaRatio" },
  },
  {
    key: "nonB1B2", label: "단기관광객(B1,B2 제외)", shortLabel: "B1,B2 제외",
    fields: { total: "nonB1B2ShortTermVisitorsTotal", male: "maleNonB1B2ShortTermVisitors", female: "femaleNonB1B2ShortTermVisitors", share: "nonB1B2MonthlyShareRatio", ratio: "nonB1B2ShortTermVisaRatio" },
  },
];

/* 단기/장기 데이터셋 설정. 장기 modes는 long_term_data.json의 metadata.visitModes를 사용한다. */
const DATASETS = {
  short: {
    key: "short",
    label: "단기",
    file: "./data/dashboard_data.json",
    exportPrefix: "kresident-detail",
    modes: SHORT_VISIT_MODES,
    text: {
      kpiTotal: "총 단기 입국자",
      chart01: "단기 관광객 시계열",
      chart02: "국가별 단기 비자 비율",
      chart03: "국가별 단기 입국자 비중",
      tableTotal: "단기 관광객",
      ratioLabel: "단기 비자 비율",
      footerDesc: "법무부 출입국 통계월보 기반 외국인 입국자 분석 대시보드",
      helpOverview: `
        법무부 출입국 통계월보의 외국인 입국자 원본 엑셀을 월별로 읽어, 단기 입국자와
        국가별 입국 분포를 정적 대시보드로 정리한 화면입니다. 상단 필터를 바꾸면
        아래 모든 차트와 상세 데이터가 같은 조건으로 함께 갱신됩니다.`,
      helpModes: `
        <strong>전체</strong>는 B1, B2, C1, C3, C4를 합산한 단기 입국자 기준입니다.
        <strong>B1(사증면제)</strong>는 사증면제 입국만 따로 보고,
        <strong>B2(관광통과)</strong>는 관광통과 입국만 따로 봅니다.
        <strong>단기관광객(B1, B2 제외)</strong>는 전체 단기 입국자에서 B1과 B2를 제외한 값입니다.
        입국 구분은 여러 개를 함께 선택할 수 있으며, 이 경우 선택한 구분의 합계로 계산합니다(선택이 없으면 전체).`,
      helpCharts: `
        <strong>시계열 차트</strong>는 월별 입국자 흐름을, <strong>히트맵</strong>은 국가×월 교차 분석을,
        <strong>비자 비율</strong>은 단기 관광객 비중을, <strong>대륙별 분포</strong>는 대륙 단위 비교를,
        <strong>성별 비중</strong>은 남녀 비율을, <strong>YoY</strong>는 전년동월비 증감을 보여줍니다.`,
    },
  },
  long: {
    key: "long",
    label: "장기",
    file: "./data/long_term_data.json",
    exportPrefix: "kresident-long-detail",
    modes: null,
    text: {
      kpiTotal: "총 장기 입국자",
      chart01: "장기 입국자 시계열",
      chart02: "국가별 장기 비자 비율",
      chart03: "국가별 장기 입국자 비중",
      tableTotal: "장기 입국자",
      ratioLabel: "장기 비자 비율",
      footerDesc: "법무부 출입국 통계월보 기반 외국인 장기 입국자 분석 대시보드",
      helpOverview: `
        법무부 출입국 통계월보의 외국인 입국자 원본 엑셀에서 <strong>장기 체류자격</strong>
        (D1~D10, E1~E10, F1~F6, G1, H1, H2) 입국자를 월별로 읽어 국가별 입국 분포를
        정적 대시보드로 정리한 화면입니다. 상단 필터를 바꾸면 아래 모든 차트와 상세 데이터가
        같은 조건으로 함께 갱신됩니다. 단기 입국자는 상단의 <strong>단기</strong> 토글에서 볼 수 있습니다.`,
      helpModes: `
        <strong>전체</strong>는 D1~H2 장기 체류자격을 합산한 장기 입국자 기준입니다(원본의 '기타' 열은 제외).
        <strong>D2(유학)</strong>, <strong>D4(일반연수)</strong>, <strong>F4(재외동포)</strong>는 각각 따로 봅니다.
        <strong>장기관광객(D2,D4,F4 제외)</strong>는 전체 장기 입국자에서 D2, D4, F4를 제외한 값으로,
        비전문취업(E9)·결혼이민(F6)·방문동거(F1) 등 나머지 장기 체류자격이 모두 포함됩니다.
        입국 구분은 여러 개를 함께 선택할 수 있으며, 이 경우 선택한 구분의 합계로 계산합니다(선택이 없으면 전체).`,
      helpCharts: `
        <strong>시계열 차트</strong>는 월별 입국자 흐름을, <strong>히트맵</strong>은 국가×월 교차 분석을,
        <strong>비자 비율</strong>은 국가별 총 입국자 중 선택한 입국 구분의 비중을, <strong>대륙별 분포</strong>는 대륙 단위 비교를,
        <strong>성별 비중</strong>은 남녀 비율을, <strong>YoY</strong>는 전년동월비 증감을 보여줍니다.`,
    },
  },
};

const state = {
  datasetKey: "short",
  visitModes: SHORT_VISIT_MODES,
  dataset: null,
  selectedModes: [],
  monthlyTotals: new Map(),
  selectedCountries: [],
  selectedYears: [],
  selectedMonthsByYear: {},
  searchKeyword: "",
  currentPage: 1,
  pageSize: 20,
  detailTable: [],
  countryOptions: [],
  yearMonthMap: new Map(),
};

/* 입국 구분 중 '전체'를 제외한 개별 구분(서로 겹치지 않는 분할) */
function getPartitionModes() {
  return state.visitModes.filter((mode) => mode.key !== "all");
}

/* 선택이 없으면 '전체', 있으면 선택한 개별 구분들 */
function getActiveModes() {
  const selected = getPartitionModes().filter((mode) => state.selectedModes.includes(mode.key));
  if (selected.length > 0) return selected;
  return [state.visitModes.find((mode) => mode.key === "all") ?? state.visitModes[0]];
}

function getModeLabel() {
  return getActiveModes().map((mode) => mode.label).join(" + ");
}

/* 월별 전국 합계(입국 구분별). 여러 구분을 합칠 때 월 비중의 분모로 사용한다. */
function buildMonthlyTotals(trend, modes) {
  const totals = new Map();
  for (const point of trend) {
    const entry = {};
    for (const mode of modes) entry[mode.key] = Number(point?.[mode.fields.total] ?? 0);
    totals.set(point.periodKey, entry);
  }
  return totals;
}

function getRowSnapshot(row) {
  const modes = getActiveModes();
  if (modes.length === 1) {
    const fields = modes[0].fields;
    return {
      total: Number(row?.[fields.total] ?? 0),
      male: row?.[fields.male] ?? null,
      female: row?.[fields.female] ?? null,
      shareRatio: row?.[fields.share] ?? null,
      visaRatio: row?.[fields.ratio] ?? null,
    };
  }

  const sumOf = (field) => {
    let sum = 0;
    let seen = false;
    for (const mode of modes) {
      const value = row?.[mode.fields[field]];
      if (value !== null && value !== undefined) {
        sum += Number(value);
        seen = true;
      }
    }
    return seen ? sum : null;
  };
  const total = Number(sumOf("total") ?? 0);
  const monthly = state.monthlyTotals.get(row?.periodKey);
  const denominator = monthly ? modes.reduce((sum, mode) => sum + (monthly[mode.key] ?? 0), 0) : 0;
  const population = row?.totalPopulationCount ?? 0;
  return {
    total,
    male: sumOf("male"),
    female: sumOf("female"),
    shareRatio: denominator > 0 ? total / denominator : null,
    visaRatio: population > 0 ? total / population : null,
  };
}

function matchesCountry(row) {
  return state.selectedCountries.length === 0
    || state.selectedCountries.includes(row.normalizedCountryLabel);
}

function matchesYearMonth(row) {
  if (state.selectedYears.length === 0) return true;
  const yearKey = String(row.year);
  if (!state.selectedYears.includes(yearKey)) return false;
  const selectedMonths = state.selectedMonthsByYear[yearKey] ?? [];
  return selectedMonths.length === 0 || selectedMonths.includes(String(row.month));
}

function getFilteredRows() {
  return state.detailTable.filter((row) => matchesCountry(row) && matchesYearMonth(row));
}

function getTableRows() {
  const keyword = state.searchKeyword.trim().toLowerCase();
  return getFilteredRows()
    .filter((row) => {
      if (!keyword) return true;
      return [row.countryName, row.normalizedCountryLabel, row.continentName ?? "", row.periodKey]
        .some((value) => String(value).toLowerCase().includes(keyword));
    })
    .sort((left, right) => right.periodKey.localeCompare(left.periodKey)
      || left.normalizedCountryLabel.localeCompare(right.normalizedCountryLabel, "ko"));
}

function summarizeSelection() {
  return {
    modeLabel: getModeLabel(),
    countryCount: state.selectedCountries.length > 0 ? state.selectedCountries.length : state.countryOptions.length,
    yearLabel: state.selectedYears.length > 0 ? `${state.selectedYears.length}개 연도` : "전체 연도",
    monthLabel: state.selectedYears.length === 0
      ? "전체 월"
      : state.selectedYears.map((year) => {
        const selectedMonths = state.selectedMonthsByYear[year] ?? [];
        return selectedMonths.length === 0 ? `${year}년 전체` : `${year}년 ${selectedMonths.length}개월`;
      }).join(" + "),
  };
}

function createChip(label, selected, onClick) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = `filter-chip-button${selected ? " is-selected" : ""}`;
  button.textContent = label;
  button.addEventListener("click", onClick);
  return button;
}

function createEmptyState(message) {
  const element = document.createElement("div");
  element.style.cssText = "width:100%;padding:20px;text-align:center;color:var(--muted);font-size:0.88rem;";
  element.textContent = message;
  return element;
}

function setPlaceholder(target, message) {
  target.replaceChildren(createEmptyState(message));
}

function formatGeneratedAt(value) {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString("ko-KR", {
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function getCoverageRange() {
  const points = state.dataset?.monthlyTrend ?? [];
  const first = points[0]?.periodKey;
  const last = points[points.length - 1]?.periodKey;
  return { first: first ? period(first) : "-", last: last ? period(last) : "-" };
}

function syncSelectedMonths() {
  const selected = {};
  for (const year of state.selectedYears) {
    const availableMonths = state.yearMonthMap.get(year) ?? [];
    const current = state.selectedMonthsByYear[year] ?? [];
    selected[year] = current.filter((month) => availableMonths.includes(month));
  }
  state.selectedMonthsByYear = selected;
}

function updateMeta() {
  const metadata = state.dataset?.metadata;
  const sourceCount = metadata?.sourceRecordCount ?? 0;
  const coverage = getCoverageRange();

  document.getElementById("generated-at").textContent = formatGeneratedAt(metadata?.generatedAt);
  document.getElementById("source-count").textContent = `${fmt(sourceCount)} files`;
  document.getElementById("source-count-hero").textContent = fmt(sourceCount);
  document.getElementById("coverage-range-hero").textContent = `${coverage.first} — ${coverage.last}`;
  document.getElementById("status-text").textContent = "ready";
}

function renderFilters() {
  const visitModeElement = document.getElementById("visit-mode-options");
  visitModeElement.replaceChildren(
    createChip("전체", state.selectedModes.length === 0, () => {
      state.selectedModes = [];
      state.currentPage = 1;
      renderDashboard();
    }),
    ...getPartitionModes().map((mode) => createChip(mode.label, state.selectedModes.includes(mode.key), () => {
      const next = new Set(state.selectedModes);
      if (next.has(mode.key)) next.delete(mode.key);
      else next.add(mode.key);
      state.selectedModes = getPartitionModes().filter((item) => next.has(item.key)).map((item) => item.key);
      state.currentPage = 1;
      renderDashboard();
    })),
  );

  const countryElement = document.getElementById("country-filter-options");
  countryElement.replaceChildren(
    createChip("전체", state.selectedCountries.length === 0, () => {
      state.selectedCountries = [];
      state.currentPage = 1;
      renderDashboard();
    }),
    ...state.countryOptions.map((country) => createChip(country, state.selectedCountries.includes(country), () => {
      state.selectedCountries = state.selectedCountries.includes(country)
        ? state.selectedCountries.filter((item) => item !== country)
        : [...state.selectedCountries, country];
      state.currentPage = 1;
      renderDashboard();
    })),
  );

  const yearElement = document.getElementById("year-filter-options");
  const years = [...state.yearMonthMap.keys()].sort();
  yearElement.replaceChildren(
    ...years.map((year) => createChip(`${year}년`, state.selectedYears.includes(year), () => {
      state.selectedYears = state.selectedYears.includes(year)
        ? state.selectedYears.filter((item) => item !== year)
        : [...state.selectedYears, year].sort();
      syncSelectedMonths();
      state.currentPage = 1;
      renderDashboard();
    })),
  );

  const monthElement = document.getElementById("month-filter-options");
  if (state.selectedYears.length === 0) {
    monthElement.replaceChildren(createEmptyState("연도를 먼저 선택하면 월 필터가 표시됩니다."));
    return;
  }

  const cards = state.selectedYears.map((year) => {
    const card = document.createElement("section");
    card.className = "month-year-card";

    const header = document.createElement("div");
    header.className = "month-year-card-header";

    const title = document.createElement("strong");
    title.className = "month-year-card-title";
    title.textContent = `${year}년`;

    const actions = document.createElement("div");
    actions.className = "month-year-card-actions";
    actions.append(createChip("전체", (state.selectedMonthsByYear[year] ?? []).length === 0, () => {
      state.selectedMonthsByYear[year] = [];
      state.currentPage = 1;
      renderDashboard();
    }));

    header.append(title, actions);

    const chips = document.createElement("div");
    chips.className = "month-year-chip-list";
    const months = state.yearMonthMap.get(year) ?? [];
    for (const month of months) {
      chips.append(createChip(`${month}월`, (state.selectedMonthsByYear[year] ?? []).includes(month), () => {
        const current = state.selectedMonthsByYear[year] ?? [];
        state.selectedMonthsByYear[year] = current.includes(month)
          ? current.filter((item) => item !== month)
          : [...current, month].sort((left, right) => Number(left) - Number(right));
        state.currentPage = 1;
        renderDashboard();
      }));
    }

    card.append(header, chips);
    return card;
  });

  monthElement.replaceChildren(...cards);
}

function renderKPIs() {
  const rows = getFilteredRows();
  const total = rows.reduce((sum, row) => sum + getRowSnapshot(row).total, 0);
  const periods = [...new Set(rows.map((row) => row.periodKey))].length;
  const average = periods > 0 ? Math.round(total / periods) : 0;

  const sortedPeriods = [...new Set(rows.map((row) => row.periodKey))].sort();
  const lastPeriod = sortedPeriods[sortedPeriods.length - 1];
  const prevPeriod = sortedPeriods[sortedPeriods.length - 2];
  const lastTotal = rows
    .filter((row) => row.periodKey === lastPeriod)
    .reduce((sum, row) => sum + getRowSnapshot(row).total, 0);
  const prevTotal = rows
    .filter((row) => row.periodKey === prevPeriod)
    .reduce((sum, row) => sum + getRowSnapshot(row).total, 0);
  const monthOverMonth = prevTotal > 0 ? (lastTotal - prevTotal) / prevTotal : 0;

  const byCountry = new Map();
  for (const row of rows) {
    byCountry.set(
      row.normalizedCountryLabel,
      (byCountry.get(row.normalizedCountryLabel) ?? 0) + getRowSnapshot(row).total,
    );
  }
  const topCountry = [...byCountry.entries()].sort((left, right) => right[1] - left[1])[0];

  document.getElementById("kpi-total").textContent = fmt(total);
  document.getElementById("kpi-monthly-avg").textContent = fmt(average);

  const monthOverMonthElement = document.getElementById("kpi-mom");
  monthOverMonthElement.textContent = `${monthOverMonth >= 0 ? "+" : ""}${(monthOverMonth * 100).toFixed(1)}%`;
  monthOverMonthElement.className = `kpi-value ${monthOverMonth >= 0 ? "kpi-up" : "kpi-down"}`;

  if (topCountry) {
    document.getElementById("kpi-top-country").textContent = topCountry[0];
    const share = total > 0 ? topCountry[1] / total : 0;
    document.querySelector("#kpi-top-country + .kpi-meta").textContent = `${fmt(topCountry[1])}명 · ${pct(share)}`;
  } else {
    document.getElementById("kpi-top-country").textContent = "-";
    document.querySelector("#kpi-top-country + .kpi-meta").textContent = "집계 가능한 데이터 없음";
  }
}

function renderTrendChart() {
  const target = document.getElementById("monthly-trend-chart");
  const rows = getFilteredRows();
  const byPeriod = new Map();

  for (const row of rows) {
    const current = byPeriod.get(row.periodKey) ?? {
      periodKey: row.periodKey,
      year: row.year,
      month: row.month,
      total: 0,
    };
    current.total += getRowSnapshot(row).total;
    byPeriod.set(row.periodKey, current);
  }

  const points = [...byPeriod.values()]
    .filter((item) => item.total > 0)
    .sort((left, right) => left.periodKey.localeCompare(right.periodKey));

  if (points.length === 0) {
    setPlaceholder(target, "데이터가 없습니다.");
    return;
  }

  const width = 860;
  const height = 280;
  const margin = { top: 18, right: 20, bottom: 30, left: 64 };
  const chartWidth = width - margin.left - margin.right;
  const chartHeight = height - margin.top - margin.bottom;
  const maxValue = Math.max(...points.map((item) => item.total), 1);
  const stepX = chartWidth / Math.max(points.length - 1, 1);

  const coordinates = points.map((item, index) => ({
    ...item,
    x: margin.left + stepX * index,
    y: margin.top + chartHeight - (item.total / maxValue) * chartHeight,
  }));

  const areaPath = `M ${coordinates[0].x} ${margin.top + chartHeight} `
    + coordinates.map((item) => `L ${item.x} ${item.y}`).join(" ")
    + ` L ${coordinates[coordinates.length - 1].x} ${margin.top + chartHeight} Z`;
  const linePath = coordinates
    .map((item, index) => `${index === 0 ? "M" : "L"} ${item.x} ${item.y}`)
    .join(" ");

  const grid = Array.from({ length: 4 }, (_, index) => {
    const ratio = index / 3;
    const value = Math.round(maxValue * (1 - ratio));
    const y = margin.top + chartHeight * ratio;
    return `<line class="chart-grid-line" x1="${margin.left}" y1="${y}" x2="${width - margin.right}" y2="${y}"></line><text class="chart-axis" x="${margin.left - 10}" y="${y + 4}" text-anchor="end">${fmt(value)}</text>`;
  }).join("");

  const tickCount = Math.min(points.length, 6);
  const ticks = Array.from({ length: tickCount }, (_, index) => (
    Math.round((points.length - 1) * index / Math.max(tickCount - 1, 1))
  ));
  const xLabels = [...new Set(ticks)].map((index) => {
    const item = coordinates[index];
    return `<text class="chart-axis" x="${item.x}" y="${height - 6}" text-anchor="middle">${period(item.periodKey)}</text>`;
  }).join("");

  const dots = coordinates.map((item, index) => `
    <circle class="chart-data-dot" cx="${item.x}" cy="${item.y}" r="3.5"></circle>
    <circle class="chart-hit-dot" cx="${item.x}" cy="${item.y}" r="12" tabindex="0" data-idx="${index}" aria-label="${period(item.periodKey)} ${fmt(item.total)}명"></circle>
  `).join("");

  const last = coordinates[coordinates.length - 1];
  const selection = summarizeSelection();

  target.innerHTML = `
    <div class="chart-layout">
      <div class="trend-chart-stage">
        <svg class="chart-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="시계열">
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
        <span class="annotation-chip">${selection.modeLabel}</span>
        <span class="annotation-chip">${selection.countryCount}개 국가군</span>
        <span class="annotation-chip">${selection.yearLabel}</span>
        <span class="annotation-chip">${selection.monthLabel}</span>
        <span class="annotation-chip mono">최근값 ${fmt(last.total)} 명</span>
      </div>
    </div>
  `;

  const stage = target.querySelector(".trend-chart-stage");
  const tooltip = target.querySelector(".chart-tooltip");
  if (stage && tooltip) {
    stage.querySelectorAll("[data-idx]").forEach((node) => {
      const item = coordinates[Number(node.dataset.idx)];
      if (!item) return;
      const showTooltip = () => {
        const bounds = stage.getBoundingClientRect();
        tooltip.innerHTML = `<strong>${period(item.periodKey)}</strong><span>${fmt(item.total)}명</span>`;
        tooltip.style.left = `${(item.x / width) * bounds.width}px`;
        tooltip.style.top = `${(item.y / height) * bounds.height}px`;
        tooltip.hidden = false;
      };
      node.addEventListener("mouseenter", showTooltip);
      node.addEventListener("focus", showTooltip);
      node.addEventListener("mouseleave", () => { tooltip.hidden = true; });
      node.addEventListener("blur", () => { tooltip.hidden = true; });
    });
  }
}

function renderVisaRatioChart() {
  const target = document.getElementById("top-country-chart");
  const rows = getFilteredRows();
  const byCountry = new Map();

  for (const row of rows) {
    const snapshot = getRowSnapshot(row);
    const current = byCountry.get(row.normalizedCountryLabel) ?? { visitors: 0, total: 0 };
    current.visitors += snapshot.total;
    current.total += row.totalPopulationCount ?? 0;
    byCountry.set(row.normalizedCountryLabel, current);
  }

  const series = [...byCountry.entries()]
    .map(([name, value]) => ({
      name,
      ratio: value.total > 0 ? value.visitors / value.total : null,
      visitors: value.visitors,
    }))
    .filter((item) => item.ratio !== null && item.visitors > 0)
    .sort((left, right) => right.ratio - left.ratio);

  if (series.length === 0) {
    setPlaceholder(target, "데이터가 없습니다.");
    return;
  }

  const maxRatio = Math.max(...series.map((item) => item.ratio), 0.01);
  const listHtml = series.map((item) => `
    <div class="bar-row">
      <div class="bar-label">${item.name}</div>
      <div class="bar-track"><div class="bar-fill" style="width:${(item.ratio / maxRatio) * 100}%"></div></div>
      <div class="bar-meta">${pct(item.ratio)}</div>
    </div>
  `).join("");

  target.innerHTML = `
    <div class="chart-layout">
      <div class="chart-annotation">
        <span class="annotation-chip">${getModeLabel()}</span>
        <span class="annotation-chip">국가별 비율</span>
        <span class="annotation-chip mono">분모: 총 입국자</span>
      </div>
      <div class="bar-list">${listHtml}</div>
    </div>
  `;
}

function renderCountryShareChart() {
  const target = document.getElementById("country-visitor-pie-chart");
  const rows = getFilteredRows();
  const byCountry = new Map();
  let totalAll = 0;

  for (const row of rows) {
    const snapshot = getRowSnapshot(row);
    byCountry.set(row.normalizedCountryLabel, (byCountry.get(row.normalizedCountryLabel) ?? 0) + snapshot.total);
    totalAll += snapshot.total;
  }

  const series = [...byCountry.entries()]
    .map(([name, value]) => ({ name, value, share: totalAll > 0 ? value / totalAll : 0 }))
    .sort((left, right) => right.value - left.value);

  if (series.length === 0) {
    setPlaceholder(target, "데이터가 없습니다.");
    return;
  }

  const maxShare = Math.max(...series.map((item) => item.share), 0.01);
  const listHtml = series.map((item) => `
    <div class="bar-row">
      <div class="bar-label">${item.name}</div>
      <div class="bar-track"><div class="bar-fill" style="width:${(item.share / maxShare) * 100}%"></div></div>
      <div class="bar-meta">${fmt(item.value)}명 · ${pct(item.share)}</div>
    </div>
  `).join("");

  const selection = summarizeSelection();
  target.innerHTML = `
    <div class="chart-layout">
      <div class="chart-annotation">
        <span class="annotation-chip">${selection.modeLabel}</span>
        <span class="annotation-chip">${selection.yearLabel}</span>
        <span class="annotation-chip">${selection.monthLabel}</span>
        <span class="annotation-chip mono">총 ${fmt(totalAll)} 명</span>
      </div>
      <div class="bar-list">${listHtml}</div>
    </div>
  `;
}

function renderGenderChart() {
  const target = document.getElementById("gender-share-chart");
  const rows = getFilteredRows();
  const byCountry = new Map();

  for (const row of rows) {
    const snapshot = getRowSnapshot(row);
    const current = byCountry.get(row.normalizedCountryLabel) ?? { male: 0, female: 0 };
    current.male += snapshot.male ?? 0;
    current.female += snapshot.female ?? 0;
    byCountry.set(row.normalizedCountryLabel, current);
  }

  const series = [...byCountry.entries()]
    .map(([name, value]) => {
      const total = value.male + value.female;
      return {
        name,
        male: value.male,
        female: value.female,
        total,
        maleRatio: total > 0 ? value.male / total : 0,
        femaleRatio: total > 0 ? value.female / total : 0,
      };
    })
    .filter((item) => item.total > 0)
    .sort((left, right) => right.total - left.total);

  if (series.length === 0) {
    setPlaceholder(target, "데이터가 없습니다.");
    return;
  }

  const totalCount = series.reduce((sum, item) => sum + item.total, 0);
  const selection = summarizeSelection();
  const listHtml = series.map((item) => `
    <article class="gender-stack-row">
      <div class="gender-stack-copy">
        <div><strong>${item.name}</strong><span class="panel-note">총 ${fmt(item.total)} 명</span></div>
        <span class="gender-stack-meta mono">${pct(item.maleRatio)} / ${pct(item.femaleRatio)}</span>
      </div>
      <div class="gender-stack-bar" aria-label="${item.name} 성별 비중">
        <div class="gender-stack-segment gender-stack-segment-male" style="width:${item.maleRatio * 100}%"><span>${pct(item.maleRatio)}</span></div>
        <div class="gender-stack-segment gender-stack-segment-female" style="width:${item.femaleRatio * 100}%"><span>${pct(item.femaleRatio)}</span></div>
      </div>
    </article>
  `).join("");

  target.innerHTML = `
    <div class="chart-layout">
      <div class="chart-annotation">
        <span class="annotation-chip">${selection.modeLabel}</span>
        <span class="annotation-chip">${selection.countryCount}개 국가군 비교</span>
        <span class="annotation-chip mono">총 ${fmt(totalCount)} 명</span>
      </div>
      <div class="chart-annotation">
        <span class="legend-chip"><span class="legend-swatch" style="background:var(--s1);"></span>남성</span>
        <span class="legend-chip"><span class="legend-swatch" style="background:var(--s2);"></span>여성</span>
      </div>
      <div class="gender-stack-list">${listHtml}</div>
    </div>
  `;
}

function renderHeatmap() {
  const target = document.getElementById("heatmap-chart");
  const rows = getFilteredRows();
  const allPeriods = [...new Set(rows.map((row) => row.periodKey))].sort();
  const recentPeriods = allPeriods.slice(-12);

  if (recentPeriods.length === 0) {
    setPlaceholder(target, "데이터가 없습니다.");
    return;
  }

  const byCountry = new Map();
  for (const row of rows) {
    byCountry.set(row.normalizedCountryLabel, (byCountry.get(row.normalizedCountryLabel) ?? 0) + getRowSnapshot(row).total);
  }
  const topCountries = [...byCountry.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, 10)
    .map(([name]) => name);

  const matrix = new Map();
  let maxValue = 1;
  for (const row of rows) {
    if (!recentPeriods.includes(row.periodKey) || !topCountries.includes(row.normalizedCountryLabel)) continue;
    const key = `${row.normalizedCountryLabel}|${row.periodKey}`;
    const nextValue = (matrix.get(key) ?? 0) + getRowSnapshot(row).total;
    matrix.set(key, nextValue);
    if (nextValue > maxValue) maxValue = nextValue;
  }

  const headerCells = `<th></th>${recentPeriods.map((value) => `<th>${period(value)}</th>`).join("")}`;
  const bodyRows = topCountries.map((country) => {
    const cells = recentPeriods.map((periodKey) => {
      const value = matrix.get(`${country}|${periodKey}`) ?? 0;
      const intensity = value / maxValue;
      const level = value === 0 ? 1 : Math.min(8, Math.max(1, Math.ceil(intensity * 8)));
      return `<td class="heat-${level}" title="${country} ${period(periodKey)}: ${fmt(value)}명">${fmt(value)}</td>`;
    }).join("");
    return `<tr><td class="heatmap-label">${country}</td>${cells}</tr>`;
  }).join("");

  const legendSwatches = [1, 2, 3, 4, 5, 6, 7, 8]
    .map((index) => `<span class="heatmap-legend-swatch heat-${index}"></span>`)
    .join("");

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

function renderContinentChart() {
  const target = document.getElementById("continent-chart");
  const rows = getFilteredRows();
  const byContinent = new Map();
  let totalAll = 0;

  for (const row of rows) {
    const continent = row.continentName ?? "기타";
    byContinent.set(continent, (byContinent.get(continent) ?? 0) + getRowSnapshot(row).total);
    totalAll += getRowSnapshot(row).total;
  }

  const series = [...byContinent.entries()]
    .map(([name, value]) => ({
      name,
      value,
      share: totalAll > 0 ? value / totalAll : 0,
      color: continentColor(name),
    }))
    .sort((left, right) => right.value - left.value);

  if (series.length === 0) {
    setPlaceholder(target, "데이터가 없습니다.");
    return;
  }

  const maxValue = Math.max(...series.map((item) => item.value), 1);
  const listHtml = series.map((item) => `
    <div class="bar-row">
      <div class="bar-label">${item.name}</div>
      <div class="bar-track">
        <div class="bar-fill" style="width:${(item.value / maxValue) * 100}%;background:${item.color}"></div>
      </div>
      <div class="bar-meta">${fmt(item.value)}명 · ${pct(item.share)}</div>
    </div>
  `).join("");

  target.innerHTML = `
    <div class="chart-layout">
      <div class="chart-annotation">
        ${series.map((item) => `<span class="legend-chip"><span class="legend-swatch" style="background:${item.color}"></span>${item.name}</span>`).join("")}
      </div>
      <div class="bar-list">${listHtml}</div>
    </div>
  `;
}

function renderYoYChart() {
  const target = document.getElementById("yoy-chart");
  const rows = getFilteredRows();
  const allPeriods = [...new Set(rows.map((row) => row.periodKey))].sort();
  const latestPeriod = allPeriods[allPeriods.length - 1];

  if (!latestPeriod) {
    setPlaceholder(target, "데이터가 없습니다.");
    return;
  }

  const [latestYear, latestMonth] = latestPeriod.split("-");
  const previousYearPeriod = `${Number(latestYear) - 1}-${latestMonth}`;

  const byCountryLatest = new Map();
  const byCountryPrevious = new Map();
  for (const row of rows) {
    const total = getRowSnapshot(row).total;
    if (row.periodKey === latestPeriod) {
      byCountryLatest.set(row.normalizedCountryLabel, (byCountryLatest.get(row.normalizedCountryLabel) ?? 0) + total);
    }
    if (row.periodKey === previousYearPeriod) {
      byCountryPrevious.set(row.normalizedCountryLabel, (byCountryPrevious.get(row.normalizedCountryLabel) ?? 0) + total);
    }
  }

  const allCountries = [...new Set([...byCountryLatest.keys(), ...byCountryPrevious.keys()])];
  const series = allCountries
    .map((name) => {
      const current = byCountryLatest.get(name) ?? 0;
      const previous = byCountryPrevious.get(name) ?? 0;
      const change = previous > 0 ? (current - previous) / previous : null;
      return { name, current, change };
    })
    .filter((item) => item.change !== null && item.current > 0)
    .sort((left, right) => (right.change ?? 0) - (left.change ?? 0));

  if (series.length === 0) {
    setPlaceholder(target, "비교할 데이터가 없습니다.");
    return;
  }

  const maxAbs = Math.max(...series.map((item) => Math.abs(item.change ?? 0)), 0.01);
  const listHtml = series.map((item, index) => {
    const isPositive = (item.change ?? 0) >= 0;
    const barWidth = (Math.abs(item.change ?? 0) / maxAbs) * 100;
    return `
      <div class="yoy-row">
        <span class="yoy-rank ${index < 3 ? "yoy-rank-top" : ""}">${index + 1}</span>
        <span class="yoy-label">${item.name}</span>
        <div class="yoy-bar-track">
          <div class="yoy-bar-fill ${isPositive ? "yoy-bar-positive" : "yoy-bar-negative"}" style="width:${barWidth}%"></div>
        </div>
        <span class="yoy-value ${isPositive ? "yoy-positive" : "yoy-negative"}">${isPositive ? "+" : ""}${((item.change ?? 0) * 100).toFixed(1)}%</span>
      </div>
    `;
  }).join("");

  target.innerHTML = `
    <div class="chart-layout">
      <div class="chart-annotation">
        <span class="annotation-chip">${period(latestPeriod)} vs ${period(previousYearPeriod)}</span>
        <span class="annotation-chip mono">전년동월비</span>
      </div>
      <div class="yoy-list">${listHtml}</div>
    </div>
  `;
}

function renderTable() {
  const rows = getTableRows();
  const totalPages = Math.max(Math.ceil(rows.length / state.pageSize), 1);
  state.currentPage = Math.min(state.currentPage, totalPages);
  const pageStart = (state.currentPage - 1) * state.pageSize;
  const pageRows = rows.slice(pageStart, pageStart + state.pageSize);

  const tableBody = document.getElementById("detail-table-body");
  if (pageRows.length === 0) {
    tableBody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:var(--muted);padding:24px;">조건에 맞는 데이터가 없습니다.</td></tr>`;
  } else {
    tableBody.innerHTML = pageRows.map((row) => {
      const snapshot = getRowSnapshot(row);
      return `<tr>
        <td class="mono">${period(row.periodKey)}</td>
        <td>${row.continentName ?? "-"}</td>
        <td>${row.normalizedCountryLabel}</td>
        <td class="is-num">${fmt(snapshot.total)}</td>
        <td class="is-num">${snapshot.male === null ? "-" : fmt(snapshot.male)}</td>
        <td class="is-num">${snapshot.female === null ? "-" : fmt(snapshot.female)}</td>
        <td class="is-num">${snapshot.shareRatio === null ? "-" : pct(snapshot.shareRatio)}</td>
      </tr>`;
    }).join("");
  }

  document.getElementById("table-summary").textContent = `${fmt(rows.length)}건 중 ${fmt(pageRows.length)}건 표시`;
  document.getElementById("table-page-info").textContent = `${state.currentPage} / ${totalPages}`;
  document.getElementById("table-prev-button").disabled = state.currentPage <= 1;
  document.getElementById("table-next-button").disabled = state.currentPage >= totalPages;
}

function renderDashboard() {
  renderKPIs();
  renderFilters();
  renderTrendChart();
  renderVisaRatioChart();
  renderCountryShareChart();
  renderGenderChart();
  renderHeatmap();
  renderContinentChart();
  renderYoYChart();
  renderTable();
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;");
}

function buildExportFileName() {
  const periods = getTableRows().map((row) => row.periodKey).sort();
  const from = periods[0] ? period(periods[0]).replace(".", "-") : "na";
  const to = periods[periods.length - 1] ? period(periods[periods.length - 1]).replace(".", "-") : "na";
  const modePart = state.selectedModes.length > 0 ? state.selectedModes.join("-") : "all";
  return `${DATASETS[state.datasetKey].exportPrefix}-${modePart}-${from}-${to}.xls`;
}

function downloadCurrentTableAsExcel() {
  const rows = getTableRows();
  if (rows.length === 0) {
    alert("현재 필터 조건에 맞는 데이터가 없어 다운로드할 수 없습니다.");
    return;
  }

  const { text } = DATASETS[state.datasetKey];
  const workbookHtml = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office"
      xmlns:x="urn:schemas-microsoft-com:office:excel"
      xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta charset="utf-8">
        <!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet><x:Name>Detail Data</x:Name><x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions></x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]-->
      </head>
      <body>
        <table border="1">
          <tr>
            <th>기준월</th>
            <th>대륙</th>
            <th>국가</th>
            <th>입국 구분</th>
            <th>${escapeHtml(text.tableTotal)}</th>
            <th>남성</th>
            <th>여성</th>
            <th>월 비중</th>
            <th>${escapeHtml(text.ratioLabel)}</th>
            <th>원본 게시글</th>
            <th>원본 게시일</th>
          </tr>
          ${rows.map((row) => {
            const snapshot = getRowSnapshot(row);
            const percent = (value) => (value == null ? "" : `${(value * 100).toFixed(2)}%`);
            return `
            <tr>
              <td>${escapeHtml(period(row.periodKey))}</td>
              <td>${escapeHtml(row.continentName ?? "-")}</td>
              <td>${escapeHtml(row.normalizedCountryLabel)}</td>
              <td>${escapeHtml(getModeLabel())}</td>
              <td>${snapshot.total}</td>
              <td>${snapshot.male ?? ""}</td>
              <td>${snapshot.female ?? ""}</td>
              <td>${percent(snapshot.shareRatio)}</td>
              <td>${percent(snapshot.visaRatio)}</td>
              <td>${escapeHtml(row.sourceFile?.articleTitle ?? "")}</td>
              <td>${escapeHtml(row.sourceFile?.publishedAt ?? "")}</td>
            </tr>
          `;
          }).join("")}
        </table>
      </body>
    </html>
  `.trim();

  const blob = new Blob(["\ufeff", workbookHtml], {
    type: "application/vnd.ms-excel;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = buildExportFileName();
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function bindEvents() {
  document.getElementById("visit-mode-clear-button").addEventListener("click", () => {
    state.selectedModes = [];
    state.currentPage = 1;
    renderDashboard();
  });
  document.querySelectorAll("#dataset-toggle [data-dataset]").forEach((button) => {
    button.addEventListener("click", () => {
      const key = button.dataset.dataset;
      if (key && key !== state.datasetKey) {
        void activateDataset(key);
      }
    });
  });
  window.addEventListener("hashchange", () => {
    const key = readDatasetFromHash();
    if (key !== state.datasetKey) {
      void activateDataset(key, { updateHash: false });
    }
  });
  document.getElementById("theme-toggle-button").addEventListener("click", () => {
    applyTheme(document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark");
  });
  document.getElementById("country-clear-button").addEventListener("click", () => {
    state.selectedCountries = [];
    state.currentPage = 1;
    renderDashboard();
  });
  document.getElementById("year-clear-button").addEventListener("click", () => {
    state.selectedYears = [];
    state.selectedMonthsByYear = {};
    state.currentPage = 1;
    renderDashboard();
  });
  document.getElementById("month-clear-button").addEventListener("click", () => {
    for (const year of state.selectedYears) {
      state.selectedMonthsByYear[year] = [];
    }
    state.currentPage = 1;
    renderDashboard();
  });

  document.getElementById("country-search").addEventListener("input", (event) => {
    state.searchKeyword = event.target.value;
    state.currentPage = 1;
    renderTable();
  });
  document.getElementById("table-prev-button").addEventListener("click", () => {
    state.currentPage = Math.max(1, state.currentPage - 1);
    renderTable();
  });
  document.getElementById("table-next-button").addEventListener("click", () => {
    const totalPages = Math.max(Math.ceil(getTableRows().length / state.pageSize), 1);
    state.currentPage = Math.min(totalPages, state.currentPage + 1);
    renderTable();
  });
  document.getElementById("table-export-button").addEventListener("click", () => {
    downloadCurrentTableAsExcel();
  });

  document.getElementById("help-open-button").addEventListener("click", () => {
    document.getElementById("help-modal").hidden = false;
    document.body.classList.add("modal-open");
  });
  document.getElementById("help-close-button").addEventListener("click", () => {
    document.getElementById("help-modal").hidden = true;
    document.body.classList.remove("modal-open");
  });
  document.getElementById("help-close-backdrop").addEventListener("click", () => {
    document.getElementById("help-modal").hidden = true;
    document.body.classList.remove("modal-open");
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !document.getElementById("help-modal").hidden) {
      document.getElementById("help-modal").hidden = true;
      document.body.classList.remove("modal-open");
    }
  });
}

function buildYearMonthMap(detailTable) {
  const yearMonthMap = new Map();
  for (const row of detailTable) {
    const yearKey = String(row.year);
    const monthKey = String(row.month);
    if (!yearMonthMap.has(yearKey)) yearMonthMap.set(yearKey, new Set());
    yearMonthMap.get(yearKey).add(monthKey);
  }
  return new Map(
    [...yearMonthMap.entries()]
      .sort((left, right) => Number(left[0]) - Number(right[0]))
      .map(([year, months]) => [year, [...months].sort((left, right) => Number(left) - Number(right))]),
  );
}

const datasetCache = new Map();
let activationSeq = 0;

async function loadDataset(key) {
  if (datasetCache.has(key)) return datasetCache.get(key);
  const response = await fetch(DATASETS[key].file, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Failed to load dashboard dataset: ${response.status}`);
  }
  const dataset = await response.json();
  datasetCache.set(key, dataset);
  return dataset;
}

function readDatasetFromHash() {
  return window.location.hash.replace("#", "") === "long" ? "long" : "short";
}

function writeDatasetToHash(key) {
  const url = key === "long"
    ? "#long"
    : `${window.location.pathname}${window.location.search}`;
  window.history.replaceState(null, "", url);
}

function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  try {
    localStorage.setItem("theme", theme);
  } catch (error) {
    /* 저장소 접근 불가 시 세션 동안만 유지 */
  }
  document.getElementById("theme-toggle-button").textContent = theme === "dark" ? "라이트" : "다크";
}

/* 데이터셋(단기/장기)에 따라 달라지는 문구·토글 상태를 반영한다 */
function applyDatasetText() {
  const config = DATASETS[state.datasetKey];
  document.querySelectorAll("[data-text]").forEach((element) => {
    const value = config.text[element.dataset.text];
    if (value !== undefined) element.textContent = value;
  });
  document.querySelectorAll("[data-html]").forEach((element) => {
    const value = config.text[element.dataset.html];
    if (value !== undefined) element.innerHTML = value.trim();
  });
  document.getElementById("dataset-badge").textContent = config.label;
  document.title = `국내 외국인 입국자 대시보드 (${config.label})`;
  document.querySelectorAll("#dataset-toggle [data-dataset]").forEach((button) => {
    const active = button.dataset.dataset === state.datasetKey;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
  });
}

function resetSelections() {
  state.selectedModes = [];
  state.selectedCountries = [];
  state.selectedYears = [];
  state.selectedMonthsByYear = {};
  state.searchKeyword = "";
  state.currentPage = 1;
  document.getElementById("country-search").value = "";
}

function showLoadError(key) {
  const file = DATASETS[key].file.replace("./", "site/");
  document.getElementById("status-text").textContent = "error";
  document.getElementById("monthly-trend-chart").replaceChildren(
    createEmptyState(`대시보드 데이터를 불러오지 못했습니다. \`${file}\` 생성 상태를 확인하세요.`),
  );
  ["top-country-chart", "country-visitor-pie-chart", "gender-share-chart", "heatmap-chart", "continent-chart", "yoy-chart", "detail-table-body"]
    .forEach((id) => {
      const element = document.getElementById(id);
      if (!element) return;
      if (id === "detail-table-body") {
        element.innerHTML = `<tr><td colspan="7" style="text-align:center;color:var(--muted);padding:24px;">대시보드 데이터를 불러오지 못했습니다.</td></tr>`;
        return;
      }
      element.replaceChildren(createEmptyState("데이터 로딩 실패"));
    });
}

async function activateDataset(key, { updateHash = true } = {}) {
  const sequence = ++activationSeq;
  document.getElementById("status-text").textContent = "loading";
  try {
    const dataset = await loadDataset(key);
    if (sequence !== activationSeq) return;

    state.datasetKey = key;
    state.dataset = dataset;
    state.visitModes = DATASETS[key].modes ?? dataset.metadata?.visitModes ?? SHORT_VISIT_MODES;
    state.detailTable = dataset.detailTable ?? [];
    state.monthlyTotals = buildMonthlyTotals(dataset.monthlyTrend ?? [], state.visitModes);
    state.countryOptions = [...new Set(state.detailTable.map((row) => row.normalizedCountryLabel).filter(Boolean))]
      .sort((left, right) => left.localeCompare(right, "ko"));
    state.yearMonthMap = buildYearMonthMap(state.detailTable);
    resetSelections();

    if (updateHash) writeDatasetToHash(key);
    applyDatasetText();
    updateMeta();
    renderDashboard();
  } catch (error) {
    if (sequence !== activationSeq) return;
    console.error(error);
    state.datasetKey = key;
    applyDatasetText();
    showLoadError(key);
  }
}

function initializeDashboard() {
  applyTheme(document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light");
  bindEvents();
  void activateDataset(readDatasetFromHash(), { updateHash: false });
}

initializeDashboard();
