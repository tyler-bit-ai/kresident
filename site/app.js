const DATASET_PATH = "./data/dashboard_data.json";
const VISIT_MODES = [
  { key: "all", label: "전체", shortLabel: "전체" },
  { key: "b1", label: "B1(무비자)", shortLabel: "B1" },
  { key: "nonB1", label: "단기관광객(B1제외)", shortLabel: "B1 제외" },
];

const CHART_COLORS = {
  accent: "#c46a35",
  accentSoft: "rgba(196, 106, 53, 0.12)",
  green: "#3f7554",
  greenSoft: "rgba(63, 117, 84, 0.14)",
};

const state = {
  dataset: null,
  visitMode: "all",
  selectedCountries: [],
  selectedYears: [],
  selectedMonthsByYear: {},
  searchKeyword: "",
  currentPage: 1,
  pageSize: 20,
};

const elements = {
  generatedAt: document.getElementById("generated-at"),
  coverageRange: document.getElementById("coverage-range"),
  sourceCount: document.getElementById("source-count"),
  statusText: document.getElementById("status-text"),
  datasetNote: document.getElementById("dataset-note"),
  visitModeOptions: document.getElementById("visit-mode-options"),
  countryFilterOptions: document.getElementById("country-filter-options"),
  yearFilterOptions: document.getElementById("year-filter-options"),
  monthFilterOptions: document.getElementById("month-filter-options"),
  countryClearButton: document.getElementById("country-clear-button"),
  yearClearButton: document.getElementById("year-clear-button"),
  monthClearButton: document.getElementById("month-clear-button"),
  monthlyTrendChart: document.getElementById("monthly-trend-chart"),
  topCountryChart: document.getElementById("top-country-chart"),
  genderShareChart: document.getElementById("gender-share-chart"),
  countryVisitorPieChart: document.getElementById("country-visitor-pie-chart"),
  helpModal: document.getElementById("help-modal"),
  helpOpenButton: document.getElementById("help-open-button"),
  helpCloseButton: document.getElementById("help-close-button"),
  helpCloseBackdrop: document.getElementById("help-close-backdrop"),
  countrySearch: document.getElementById("country-search"),
  detailValueHeader: document.getElementById("detail-value-header"),
  detailMaleHeader: document.getElementById("detail-male-header"),
  detailFemaleHeader: document.getElementById("detail-female-header"),
  detailShareHeader: document.getElementById("detail-share-header"),
  detailTableBody: document.getElementById("detail-table-body"),
  tableSummary: document.getElementById("table-summary"),
  tableExportButton: document.getElementById("table-export-button"),
  tableExportButton2: document.getElementById("table-export-button-2"),
  tablePrevButton: document.getElementById("table-prev-button"),
  tableNextButton: document.getElementById("table-next-button"),
  tablePageInfo: document.getElementById("table-page-info"),
  emptyStateTemplate: document.getElementById("empty-state-template"),
};

function formatNumber(value) {
  return new Intl.NumberFormat("ko-KR").format(value ?? 0);
}

function formatRatio(value) {
  return `${((value ?? 0) * 100).toFixed(1)}%`;
}

function formatPeriod(periodKey) {
  if (!periodKey) {
    return "-";
  }

  const [year, month] = periodKey.split("-");
  return `${year}.${month}`;
}

function createEmptyState(message) {
  const node = elements.emptyStateTemplate.content.firstElementChild.cloneNode(true);
  node.textContent = message;
  return node;
}

function setChartPlaceholder(target, message) {
  target.replaceChildren(createEmptyState(message));
}

function getVisitModeMeta() {
  return VISIT_MODES.find((mode) => mode.key === state.visitMode) ?? VISIT_MODES[0];
}

function getMetricKeys() {
  if (state.visitMode === "b1") {
    return {
      total: "b1ShortTermVisitorsTotal",
      male: "maleB1ShortTermVisitors",
      female: "femaleB1ShortTermVisitors",
      share: "b1MonthlyShareRatio",
      ratio: "b1ShortTermVisaRatio",
    };
  }

  if (state.visitMode === "nonB1") {
    return {
      total: "nonB1ShortTermVisitorsTotal",
      male: "maleNonB1ShortTermVisitors",
      female: "femaleNonB1ShortTermVisitors",
      share: "nonB1MonthlyShareRatio",
      ratio: "nonB1ShortTermVisaRatio",
    };
  }

  return {
    total: "shortTermVisitorsTotal",
    male: "maleShortTermVisitors",
    female: "femaleShortTermVisitors",
    share: "monthlyShareRatio",
    ratio: "shortTermVisaRatio",
  };
}

function getRowMetricValue(row, metricKey) {
  return row?.[metricKey] ?? 0;
}

function getRowMetricSnapshot(row) {
  const keys = getMetricKeys();
  return {
    total: Number(getRowMetricValue(row, keys.total) ?? 0),
    male: row?.[keys.male] ?? null,
    female: row?.[keys.female] ?? null,
    shareRatio: row?.[keys.share] ?? null,
    visaRatio: row?.[keys.ratio] ?? null,
  };
}

function getModeMetricLabel() {
  if (state.visitMode === "b1") {
    return "B1 입국자";
  }
  if (state.visitMode === "nonB1") {
    return "단기관광객(B1제외)";
  }
  return "단기 관광객";
}

function getAvailableCountries() {
  return state.dataset.metadata.supportedCountryGroups;
}

function getAvailableYears() {
  return [...new Set(state.dataset.detailTable.map((row) => row.year))]
    .sort((left, right) => left - right)
    .map(String);
}

function getAvailableMonths() {
  return Array.from({ length: 12 }, (_, index) => String(index + 1));
}

function toggleSelection(collection, value) {
  return collection.includes(value)
    ? collection.filter((item) => item !== value)
    : [...collection, value];
}

function matchesCountry(row) {
  return (
    state.selectedCountries.length === 0 ||
    state.selectedCountries.includes(row.normalizedCountryLabel)
  );
}

function matchesYearMonth(row) {
  if (state.selectedYears.length === 0) {
    return true;
  }

  const yearKey = String(row.year);
  if (!state.selectedYears.includes(yearKey)) {
    return false;
  }

  const selectedMonths = state.selectedMonthsByYear[yearKey] ?? [];
  return selectedMonths.length === 0 || selectedMonths.includes(String(row.month));
}

function getChartFilteredRows() {
  return state.dataset.detailTable.filter((row) => matchesCountry(row) && matchesYearMonth(row));
}

function getTableFilteredRows() {
  return getChartFilteredRows()
    .filter((row) =>
      row.countryName.toLowerCase().includes(state.searchKeyword.trim().toLowerCase()),
    )
    .sort((left, right) => {
      const periodCompare = right.periodKey.localeCompare(left.periodKey);
      if (periodCompare !== 0) {
        return periodCompare;
      }

      return left.normalizedCountryLabel.localeCompare(right.normalizedCountryLabel, "ko");
    });
}

function summarizeMonthSelection() {
  if (state.selectedYears.length === 0) {
    return "전체 월";
  }

  const parts = state.selectedYears.map((year) => {
    const months = state.selectedMonthsByYear[year] ?? [];
    if (months.length === 0) {
      return `${year}년 전체`;
    }
    return `${year}년 ${months.length}개 월`;
  });

  return parts.join(" + ");
}

function getSelectionSummary() {
  return {
    modeLabel: getVisitModeMeta().label,
    countryCount:
      state.selectedCountries.length > 0
        ? state.selectedCountries.length
        : getAvailableCountries().length,
    yearLabel:
      state.selectedYears.length > 0
        ? `${state.selectedYears.length}개 연도`
        : "전체 연도",
    monthLabel: summarizeMonthSelection(),
  };
}

function buildFilterStamp() {
  const countryPart =
    state.selectedCountries.length > 0
      ? `countries-${state.selectedCountries.length}`
      : "countries-all";
  const yearPart =
    state.selectedYears.length > 0
      ? `years-${state.selectedYears.join("-")}`
      : "years-all";
  const monthPart =
    state.selectedYears.length > 0
      ? state.selectedYears
          .map((year) => {
            const months = state.selectedMonthsByYear[year] ?? [];
            return `${year}-${months.length > 0 ? months.join(".") : "all"}`;
          })
          .join("_")
      : "months-all";

  return [`mode-${state.visitMode}`, countryPart, yearPart, monthPart].join("_");
}

function buildYearlyShortTermWorkbookRows(rows) {
  const byYear = new Map();

  for (const row of rows) {
    const rowMetric = getRowMetricSnapshot(row);
    const yearBucket = byYear.get(row.year) ?? new Map();
    const countryBucket = yearBucket.get(row.normalizedCountryLabel) ?? {
      countryName: row.normalizedCountryLabel,
      months: Array.from({ length: 12 }, () => 0),
      total: 0,
    };

    const monthIndex = row.month - 1;
    if (monthIndex >= 0 && monthIndex < 12) {
      countryBucket.months[monthIndex] += rowMetric.total;
    }
    countryBucket.total += rowMetric.total;
    yearBucket.set(row.normalizedCountryLabel, countryBucket);
    byYear.set(row.year, yearBucket);
  }

  return [...byYear.entries()]
    .sort((left, right) => left[0] - right[0])
    .map(([year, countries]) => {
      const countryRows = [...countries.values()].sort((left, right) => right.total - left.total);
      const yearTotal = countryRows.reduce((sum, row) => sum + row.total, 0);

      return {
        year,
        rows: countryRows.map((row) => ({
          국가: row.countryName,
          ...Object.fromEntries(
            row.months.map((value, index) => [`${index + 1}월`, value === 0 ? "" : value]),
          ),
          총합계: row.total,
          비율: yearTotal > 0 ? Number((row.total / yearTotal).toFixed(4)) : 0,
        })),
      };
    });
}

function getTrendSeries() {
  const byPeriod = new Map();

  for (const row of getChartFilteredRows()) {
    const rowMetric = getRowMetricSnapshot(row);
    const current = byPeriod.get(row.periodKey) ?? {
      year: row.year,
      month: row.month,
      periodKey: row.periodKey,
      total: 0,
    };
    current.total += rowMetric.total;
    byPeriod.set(row.periodKey, current);
  }

  return [...byPeriod.values()]
    .filter((row) => row.total > 0)
    .sort((left, right) => left.periodKey.localeCompare(right.periodKey));
}

function getCountryVisitorShareSeries() {
  const byCountry = new Map();
  let totalVisitors = 0;

  for (const row of getChartFilteredRows()) {
    const rowMetric = getRowMetricSnapshot(row);
    const current = byCountry.get(row.normalizedCountryKey) ?? {
      normalizedCountryKey: row.normalizedCountryKey,
      countryName: row.normalizedCountryLabel,
      shortTermVisitorsTotal: 0,
    };

    current.shortTermVisitorsTotal += rowMetric.total;
    totalVisitors += rowMetric.total;
    byCountry.set(row.normalizedCountryKey, current);
  }

  return [...byCountry.values()]
    .map((row) => ({
      ...row,
      shareRatio: totalVisitors > 0 ? row.shortTermVisitorsTotal / totalVisitors : 0,
    }))
    .filter((row) => row.shortTermVisitorsTotal > 0)
    .sort((left, right) => right.shortTermVisitorsTotal - left.shortTermVisitorsTotal);
}

function getCountryRatioSeries() {
  const byCountry = new Map();

  for (const row of getChartFilteredRows()) {
    const rowMetric = getRowMetricSnapshot(row);
    const current = byCountry.get(row.normalizedCountryKey) ?? {
      normalizedCountryKey: row.normalizedCountryKey,
      countryName: row.normalizedCountryLabel,
      shortTermVisitorsTotal: 0,
      totalPopulationCount: 0,
    };

    current.shortTermVisitorsTotal += rowMetric.total;
    current.totalPopulationCount += row.totalPopulationCount ?? 0;
    byCountry.set(row.normalizedCountryKey, current);
  }

  return [...byCountry.values()]
    .map((row) => ({
      ...row,
      shortTermVisaRatio:
        row.totalPopulationCount > 0
          ? row.shortTermVisitorsTotal / row.totalPopulationCount
          : null,
    }))
    .filter((row) => row.shortTermVisaRatio !== null && row.shortTermVisitorsTotal > 0)
    .sort((left, right) => (right.shortTermVisaRatio ?? 0) - (left.shortTermVisaRatio ?? 0));
}

function getGenderComparisonSeries() {
  const byCountry = new Map();

  for (const row of getChartFilteredRows()) {
    const rowMetric = getRowMetricSnapshot(row);
    const current = byCountry.get(row.normalizedCountryKey) ?? {
      normalizedCountryKey: row.normalizedCountryKey,
      countryName: row.normalizedCountryLabel,
      male: 0,
      female: 0,
      total: 0,
    };

    current.male += rowMetric.male ?? 0;
    current.female += rowMetric.female ?? 0;
    current.total = current.male + current.female;
    byCountry.set(row.normalizedCountryKey, current);
  }

  return [...byCountry.values()]
    .filter((row) => row.total > 0)
    .map((row) => ({
      ...row,
      maleRatio: row.total > 0 ? row.male / row.total : 0,
      femaleRatio: row.total > 0 ? row.female / row.total : 0,
    }))
    .sort((left, right) => right.total - left.total);
}

function renderMeta() {
  const generatedAt = new Date(state.dataset.metadata.generatedAt);
  const firstPeriod = state.dataset.monthlyTrend[0]?.periodKey ?? "";
  const lastPeriod =
    state.dataset.monthlyTrend[state.dataset.monthlyTrend.length - 1]?.periodKey ?? "";

  elements.generatedAt.textContent = generatedAt.toLocaleString("ko-KR");
  elements.coverageRange.textContent = `${formatPeriod(firstPeriod)} - ${formatPeriod(lastPeriod)}`;
  elements.sourceCount.textContent = `${formatNumber(state.dataset.metadata.sourceRecordCount)} files`;
  elements.statusText.textContent =
    state.dataset.metadata.skippedSourceRecordCount > 0
      ? `${state.dataset.metadata.skippedSourceRecordCount} file skipped`
      : "ready";
  elements.datasetNote.textContent = state.dataset.metadata.notes.join(" · ");
}

function createChipButton(label, selected, onClick, extraClassName = "") {
  const button = document.createElement("button");
  button.type = "button";
  button.className = `filter-chip-button${selected ? " is-selected" : ""}${extraClassName ? ` ${extraClassName}` : ""}`;
  button.textContent = label;
  button.addEventListener("click", onClick);
  return button;
}

function renderFilterChips(target, options, selectedValues, toggleHandler, formatter) {
  target.replaceChildren(
    ...options.map((option) =>
      createChipButton(
        formatter(option),
        selectedValues.includes(option),
        () => toggleHandler(option),
      ),
    ),
  );
}

function renderVisitModeFilters() {
  elements.visitModeOptions.replaceChildren(
    ...VISIT_MODES.map((mode) =>
      createChipButton(mode.label, state.visitMode === mode.key, () => {
        state.visitMode = mode.key;
        state.currentPage = 1;
        renderDashboard();
      }),
    ),
  );
}

function renderCountryFilters() {
  const buttons = [
    createChipButton("전체", state.selectedCountries.length === 0, () => {
      state.selectedCountries = [];
      state.currentPage = 1;
      renderDashboard();
    }, "filter-chip-button-all"),
    ...getAvailableCountries().map((country) =>
      createChipButton(country, state.selectedCountries.includes(country), () => {
        state.selectedCountries = toggleSelection(state.selectedCountries, country);
        state.currentPage = 1;
        renderDashboard();
      }),
    ),
  ];

  elements.countryFilterOptions.replaceChildren(...buttons);
}

function pruneMonthSelections() {
  const next = {};
  for (const year of state.selectedYears) {
    next[year] = state.selectedMonthsByYear[year] ?? [];
  }
  state.selectedMonthsByYear = next;
}

function toggleYearSelection(year) {
  state.selectedYears = toggleSelection(state.selectedYears, year).sort();
  pruneMonthSelections();
  state.currentPage = 1;
  renderDashboard();
}

function toggleMonthSelection(year, month) {
  const currentMonths = state.selectedMonthsByYear[year] ?? [];
  state.selectedMonthsByYear = {
    ...state.selectedMonthsByYear,
    [year]: toggleSelection(currentMonths, month).sort(
      (left, right) => Number(left) - Number(right),
    ),
  };
  state.currentPage = 1;
  renderDashboard();
}

function clearYearMonths(year) {
  state.selectedMonthsByYear = {
    ...state.selectedMonthsByYear,
    [year]: [],
  };
  state.currentPage = 1;
  renderDashboard();
}

function renderMonthFilterGroups() {
  if (state.selectedYears.length === 0) {
    elements.monthFilterOptions.replaceChildren(
      createEmptyState("연도를 먼저 선택하면 연도별 월 필터가 표시됩니다."),
    );
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
    actions.append(
      createChipButton(
        "전체",
        (state.selectedMonthsByYear[year] ?? []).length === 0,
        () => clearYearMonths(year),
        "filter-chip-button-inline",
      ),
    );

    header.append(title, actions);

    const chips = document.createElement("div");
    chips.className = "month-year-chip-list";
    for (const month of getAvailableMonths()) {
      chips.append(
        createChipButton(
          `${month}월`,
          (state.selectedMonthsByYear[year] ?? []).includes(month),
          () => toggleMonthSelection(year, month),
        ),
      );
    }

    const note = document.createElement("p");
    note.className = "panel-note month-year-card-note";
    const selectedMonths = state.selectedMonthsByYear[year] ?? [];
    note.textContent =
      selectedMonths.length === 0
        ? "전체 월 선택 상태"
        : `${selectedMonths.map((month) => `${month}월`).join(", ")} 선택`;

    card.append(header, chips, note);
    return card;
  });

  elements.monthFilterOptions.replaceChildren(...cards);
}

function clearSelection(type) {
  if (type === "country") {
    state.selectedCountries = [];
  }
  if (type === "year") {
    state.selectedYears = [];
    state.selectedMonthsByYear = {};
  }
  if (type === "month") {
    state.selectedMonthsByYear = {};
  }
  state.currentPage = 1;
  renderDashboard();
}

function renderFilters() {
  renderVisitModeFilters();
  renderCountryFilters();
  renderFilterChips(
    elements.yearFilterOptions,
    getAvailableYears(),
    state.selectedYears,
    (value) => toggleYearSelection(value),
    (value) => `${value}년`,
  );
  renderMonthFilterGroups();
}

function attachTrendTooltip(stage, tooltip, points, width, height) {
  function showTooltip(point) {
    const bounds = stage.getBoundingClientRect();
    const left = (point.x / width) * bounds.width;
    const top = (point.y / height) * bounds.height;
    tooltip.innerHTML = `
      <strong>${formatPeriod(point.periodKey)}</strong>
      <span>${formatNumber(point.total)}명</span>
    `;
    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${top}px`;
    tooltip.hidden = false;
  }

  function hideTooltip() {
    tooltip.hidden = true;
  }

  stage.querySelectorAll("[data-point-index]").forEach((node) => {
    const point = points[Number(node.getAttribute("data-point-index"))];
    if (!point) {
      return;
    }

    node.addEventListener("mouseenter", () => showTooltip(point));
    node.addEventListener("focus", () => showTooltip(point));
    node.addEventListener("mouseleave", hideTooltip);
    node.addEventListener("blur", hideTooltip);
  });
}

function renderMonthlyTrendChart() {
  const points = getTrendSeries();
  if (points.length === 0) {
    setChartPlaceholder(elements.monthlyTrendChart, "선택 조건에 맞는 시계열 데이터가 없습니다.");
    return;
  }

  const width = 860;
  const height = 280;
  const margin = { top: 18, right: 20, bottom: 30, left: 64 };
  const chartWidth = width - margin.left - margin.right;
  const chartHeight = height - margin.top - margin.bottom;
  const maxValue = Math.max(...points.map((point) => point.total), 1);
  const stepX = chartWidth / Math.max(points.length - 1, 1);
  const summary = getSelectionSummary();

  const coords = points.map((point, index) => {
    const x = margin.left + stepX * index;
    const y = margin.top + chartHeight - (point.total / maxValue) * chartHeight;
    return { ...point, x, y };
  });

  const areaPath = [
    `M ${coords[0].x} ${margin.top + chartHeight}`,
    ...coords.map((point) => `L ${point.x} ${point.y}`),
    `L ${coords[coords.length - 1].x} ${margin.top + chartHeight}`,
    "Z",
  ].join(" ");

  const linePath = coords
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
    .join(" ");

  const lastPoint = coords[coords.length - 1];
  const gridLines = Array.from({ length: 4 }, (_, index) => {
    const ratio = index / 3;
    const value = Math.round(maxValue * (1 - ratio));
    const y = margin.top + chartHeight * ratio;
    return `
      <line class="chart-grid-line" x1="${margin.left}" y1="${y}" x2="${width - margin.right}" y2="${y}"></line>
      <text class="chart-axis" x="${margin.left - 10}" y="${y + 4}" text-anchor="end">${formatNumber(value)}</text>
    `;
  }).join("");

  const tickIndexes = Array.from({ length: Math.min(points.length, 6) }, (_, index) =>
    Math.round(((points.length - 1) * index) / Math.max(Math.min(points.length, 6) - 1, 1)),
  );
  const xLabels = [...new Set(tickIndexes)].map((index) => {
    const point = coords[index];
    return `
      <text class="chart-axis" x="${point.x}" y="${height - 6}" text-anchor="middle">
        ${formatPeriod(point.periodKey)}
      </text>
    `;
  }).join("");

  const pointMarkup = coords
    .map(
      (point, index) => `
        <circle class="chart-data-dot" cx="${point.x}" cy="${point.y}" r="3.5"></circle>
        <circle class="chart-hit-dot" cx="${point.x}" cy="${point.y}" r="12" tabindex="0" data-point-index="${index}" aria-label="${formatPeriod(point.periodKey)} ${formatNumber(point.total)}명"></circle>
      `,
    )
    .join("");

  elements.monthlyTrendChart.innerHTML = `
    <div class="chart-layout">
      <div class="trend-chart-stage">
        <svg class="chart-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="${getModeMetricLabel()} 시계열">
          ${gridLines}
          <path class="chart-area" d="${areaPath}"></path>
          <path class="chart-line" d="${linePath}"></path>
          ${pointMarkup}
          <circle class="chart-highlight-dot" cx="${lastPoint.x}" cy="${lastPoint.y}" r="5"></circle>
          ${xLabels}
        </svg>
        <div class="chart-tooltip" hidden></div>
      </div>
      <div class="chart-annotation">
        <span class="annotation-chip">${summary.modeLabel}</span>
        <span class="annotation-chip">${summary.countryCount}개 국가군</span>
        <span class="annotation-chip">${summary.yearLabel}</span>
        <span class="annotation-chip">${summary.monthLabel}</span>
        <span class="annotation-chip mono">최근값 ${formatNumber(lastPoint.total)} 명</span>
      </div>
    </div>
  `;

  const stage = elements.monthlyTrendChart.querySelector(".trend-chart-stage");
  const tooltip = elements.monthlyTrendChart.querySelector(".chart-tooltip");
  if (stage && tooltip) {
    attachTrendTooltip(stage, tooltip, coords, width, height);
  }
}

function renderCountryRatioChart() {
  const rows = getCountryRatioSeries();
  if (rows.length === 0) {
    setChartPlaceholder(elements.topCountryChart, "선택 조건에 맞는 국가 비율 데이터가 없습니다.");
    return;
  }

  const maxRatio = Math.max(...rows.map((row) => row.shortTermVisaRatio ?? 0), 0.01);
  const listMarkup = rows
    .map(
      (row) => `
        <div class="bar-row">
          <div class="bar-label">${row.countryName}</div>
          <div class="bar-track">
            <div class="bar-fill" style="width: ${((row.shortTermVisaRatio ?? 0) / maxRatio) * 100}%"></div>
          </div>
          <div class="bar-meta">${row.shortTermVisaRatio === null ? "-" : formatRatio(row.shortTermVisaRatio)}</div>
        </div>
      `,
    )
    .join("");

  elements.topCountryChart.innerHTML = `
    <div class="chart-layout">
      <div class="chart-annotation">
        <span class="annotation-chip">${getVisitModeMeta().label}</span>
        <span class="annotation-chip">선택 결과 국가별 비율</span>
        <span class="annotation-chip mono">분모: 총 체류외국인</span>
      </div>
      <div class="bar-list">${listMarkup}</div>
    </div>
  `;
}

function renderCountryVisitorPieChart() {
  const rows = getCountryVisitorShareSeries();
  if (rows.length === 0) {
    setChartPlaceholder(elements.countryVisitorPieChart, "선택 조건에 맞는 국가 비중 데이터가 없습니다.");
    return;
  }

  const summary = getSelectionSummary();
  const totalVisitors = rows.reduce((sum, row) => sum + row.shortTermVisitorsTotal, 0);
  const maxRatio = Math.max(...rows.map((row) => row.shareRatio), 0.01);
  const listMarkup = rows
    .map(
      (row) => `
        <div class="bar-row">
          <div class="bar-label">${row.countryName}</div>
          <div class="bar-track">
            <div class="bar-fill" style="width: ${(row.shareRatio / maxRatio) * 100}%"></div>
          </div>
          <div class="bar-meta">${formatNumber(row.shortTermVisitorsTotal)}명 · ${formatRatio(row.shareRatio)}</div>
        </div>
      `,
    )
    .join("");

  elements.countryVisitorPieChart.innerHTML = `
    <div class="chart-layout">
      <div class="chart-annotation">
        <span class="annotation-chip">${summary.modeLabel}</span>
        <span class="annotation-chip">${summary.yearLabel}</span>
        <span class="annotation-chip">${summary.monthLabel}</span>
        <span class="annotation-chip mono">총 ${formatNumber(totalVisitors)} 명</span>
        <span class="annotation-chip">분모: 선택 필터 기준 전체 입국자</span>
      </div>
      <div class="bar-list">${listMarkup}</div>
    </div>
  `;
}

function renderGenderCompositionChart() {
  const rows = getGenderComparisonSeries();

  if (rows.length === 0) {
    setChartPlaceholder(elements.genderShareChart, "선택 조건에 맞는 성별 데이터가 없습니다.");
    return;
  }

  const totalCount = rows.reduce((sum, row) => sum + row.total, 0);
  const summary = getSelectionSummary();
  const listMarkup = rows
    .map(
      (row) => `
        <article class="gender-stack-row">
          <div class="gender-stack-copy">
            <div>
              <strong>${row.countryName}</strong>
              <span class="panel-note">총 ${formatNumber(row.total)} 명</span>
            </div>
            <span class="gender-stack-meta mono">${formatRatio(row.maleRatio)} / ${formatRatio(row.femaleRatio)}</span>
          </div>
          <div class="gender-stack-bar" aria-label="${row.countryName} 성별 비중">
            <div class="gender-stack-segment gender-stack-segment-male" style="width: ${row.maleRatio * 100}%;"><span>${formatRatio(row.maleRatio)}</span></div>
            <div class="gender-stack-segment gender-stack-segment-female" style="width: ${row.femaleRatio * 100}%;"><span>${formatRatio(row.femaleRatio)}</span></div>
          </div>
        </article>
      `,
    )
    .join("");

  elements.genderShareChart.innerHTML = `
    <div class="chart-layout">
      <div class="chart-annotation">
        <span class="annotation-chip">${summary.modeLabel}</span>
        <span class="annotation-chip">${summary.countryCount}개 국가군 비교</span>
        <span class="annotation-chip">${summary.yearLabel}</span>
        <span class="annotation-chip">${summary.monthLabel}</span>
        <span class="annotation-chip mono">총 ${formatNumber(totalCount)} 명</span>
      </div>
      <div class="chart-annotation">
        <span class="legend-chip"><span class="legend-swatch" style="background: ${CHART_COLORS.accent};"></span>남성</span>
        <span class="legend-chip"><span class="legend-swatch" style="background: ${CHART_COLORS.green};"></span>여성</span>
        <span class="annotation-chip">선택 기간 합산 후 국가 내부 비율</span>
      </div>
      <div class="gender-stack-list">${listMarkup}</div>
    </div>
  `;
}

function renderTableHeaders() {
  elements.detailValueHeader.textContent = getModeMetricLabel();
  elements.detailMaleHeader.textContent = `${getVisitModeMeta().shortLabel} 남성`;
  elements.detailFemaleHeader.textContent = `${getVisitModeMeta().shortLabel} 여성`;
  elements.detailShareHeader.textContent = "월 비중";
}

function renderTable() {
  renderTableHeaders();

  const filteredRows = getTableFilteredRows();
  const totalPages = Math.max(Math.ceil(filteredRows.length / state.pageSize), 1);
  state.currentPage = Math.min(state.currentPage, totalPages);
  const pageStart = (state.currentPage - 1) * state.pageSize;
  const rows = filteredRows.slice(pageStart, pageStart + state.pageSize);

  if (rows.length === 0) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 7;
    td.appendChild(createEmptyState("조건에 맞는 데이터가 없습니다."));
    tr.appendChild(td);
    elements.detailTableBody.replaceChildren(tr);
    elements.tableSummary.textContent = "0건 표시 중";
    elements.tablePageInfo.textContent = "1 / 1";
    elements.tablePrevButton.disabled = true;
    elements.tableNextButton.disabled = true;
    return;
  }

  elements.detailTableBody.replaceChildren(
    ...rows.map((row) => {
      const rowMetric = getRowMetricSnapshot(row);
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td class="mono">${formatPeriod(row.periodKey)}</td>
        <td>${row.continentName ?? "-"}</td>
        <td>${row.normalizedCountryLabel}</td>
        <td>${formatNumber(rowMetric.total)}</td>
        <td>${rowMetric.male === null ? "-" : formatNumber(rowMetric.male)}</td>
        <td>${rowMetric.female === null ? "-" : formatNumber(rowMetric.female)}</td>
        <td>${rowMetric.shareRatio === null ? "-" : formatRatio(rowMetric.shareRatio)}</td>
      `;
      return tr;
    }),
  );

  elements.tableSummary.textContent = `${formatNumber(filteredRows.length)}건 중 ${formatNumber(rows.length)}건 표시`;
  elements.tablePageInfo.textContent = `${state.currentPage} / ${totalPages}`;
  elements.tablePrevButton.disabled = state.currentPage <= 1;
  elements.tableNextButton.disabled = state.currentPage >= totalPages;
}

function renderDashboard() {
  renderMeta();
  renderFilters();
  renderMonthlyTrendChart();
  renderGenderCompositionChart();
  renderCountryRatioChart();
  renderCountryVisitorPieChart();
  renderTable();
}

function openHelpModal() {
  elements.helpModal.hidden = false;
  document.body.classList.add("modal-open");
}

function closeHelpModal() {
  elements.helpModal.hidden = true;
  document.body.classList.remove("modal-open");
}

function bindEvents() {
  elements.countryClearButton.addEventListener("click", () => clearSelection("country"));
  elements.yearClearButton.addEventListener("click", () => clearSelection("year"));
  elements.monthClearButton.addEventListener("click", () => clearSelection("month"));
  elements.helpOpenButton.addEventListener("click", openHelpModal);
  elements.helpCloseButton.addEventListener("click", closeHelpModal);
  elements.helpCloseBackdrop.addEventListener("click", closeHelpModal);

  elements.countrySearch.addEventListener("input", (event) => {
    state.searchKeyword = event.target.value;
    state.currentPage = 1;
    renderTable();
  });

  elements.tablePrevButton.addEventListener("click", () => {
    state.currentPage = Math.max(1, state.currentPage - 1);
    renderTable();
  });

  elements.tableNextButton.addEventListener("click", () => {
    const totalPages = Math.max(Math.ceil(getTableFilteredRows().length / state.pageSize), 1);
    state.currentPage = Math.min(totalPages, state.currentPage + 1);
    renderTable();
  });

  elements.tableExportButton.addEventListener("click", () => {
    const rows = getTableFilteredRows();
    if (rows.length === 0) {
      return;
    }

    const exportRows = rows.map((row) => {
      const rowMetric = getRowMetricSnapshot(row);
      return {
        period: row.periodKey,
        mode: getVisitModeMeta().label,
        country_group: row.normalizedCountryLabel,
        continent: row.continentName ?? "",
        visitors_total: rowMetric.total,
        total_population_count: row.totalPopulationCount ?? "",
        monthly_share_ratio: rowMetric.shareRatio === null ? "" : Number((rowMetric.shareRatio * 100).toFixed(2)),
        short_term_visa_ratio: rowMetric.visaRatio === null ? "" : Number((rowMetric.visaRatio * 100).toFixed(2)),
        male_visitors: rowMetric.male ?? "",
        female_visitors: rowMetric.female ?? "",
      };
    });

    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(exportRows);
    XLSX.utils.book_append_sheet(workbook, worksheet, "detail_table");

    const stamp = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(workbook, `kresident_filtered_detail_${buildFilterStamp()}_${stamp}.xlsx`);
  });

  elements.tableExportButton2.addEventListener("click", () => {
    const rows = getChartFilteredRows();
    if (rows.length === 0) {
      return;
    }

    const workbook = XLSX.utils.book_new();
    const yearlySheets = buildYearlyShortTermWorkbookRows(rows);

    for (const yearlySheet of yearlySheets) {
      const worksheet = XLSX.utils.json_to_sheet(yearlySheet.rows, {
        header: [
          "국가",
          "1월",
          "2월",
          "3월",
          "4월",
          "5월",
          "6월",
          "7월",
          "8월",
          "9월",
          "10월",
          "11월",
          "12월",
          "총합계",
          "비율",
        ],
      });

      XLSX.utils.book_append_sheet(workbook, worksheet, String(yearlySheet.year));
    }

    const stamp = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(
      workbook,
      `kresident_short_term_by_year_${buildFilterStamp()}_${stamp}.xlsx`,
    );
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !elements.helpModal.hidden) {
      closeHelpModal();
    }
  });
}

async function loadDataset() {
  const response = await fetch(DATASET_PATH);
  if (!response.ok) {
    throw new Error(`Failed to load dataset: ${response.status}`);
  }

  return await response.json();
}

async function init() {
  try {
    state.dataset = await loadDataset();
    renderDashboard();
    bindEvents();
  } catch (error) {
    elements.statusText.textContent = "load failed";
    elements.datasetNote.textContent =
      error instanceof Error ? error.message : String(error);
    setChartPlaceholder(elements.monthlyTrendChart, "데이터를 불러오지 못했습니다.");
    setChartPlaceholder(elements.topCountryChart, "데이터를 불러오지 못했습니다.");
    setChartPlaceholder(elements.genderShareChart, "데이터를 불러오지 못했습니다.");
    setChartPlaceholder(elements.countryVisitorPieChart, "데이터를 불러오지 못했습니다.");
  }
}

void init();
