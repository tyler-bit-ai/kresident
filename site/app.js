const DATASET_PATH = "./data/dashboard_data.json";
const CHART_COLORS = {
  accent: "#c46a35",
  accentSoft: "rgba(196, 106, 53, 0.12)",
  green: "#3f7554",
  greenSoft: "rgba(63, 117, 84, 0.14)",
  inkSoft: "rgba(29, 36, 28, 0.08)",
  piePalette: [
    "#c46a35",
    "#3f7554",
    "#d48b59",
    "#8e9f71",
    "#c39b67",
    "#5b8d7c",
    "#b65a42",
    "#8a6a52",
    "#7d8f4f",
    "#cf7a4a",
    "#55745d",
    "#b48d74",
  ],
};

const state = {
  dataset: null,
  selectedCountries: [],
  selectedYears: [],
  selectedMonths: [],
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
  countrySearch: document.getElementById("country-search"),
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

function getAvailableCountries() {
  return state.dataset.metadata.supportedCountryGroups;
}

function getAvailableYears() {
  return [...new Set(state.dataset.detailTable.map((row) => row.year))]
    .sort((left, right) => left - right)
    .map(String);
}

function getAvailableMonths() {
  return [...new Set(state.dataset.detailTable.map((row) => row.month))]
    .sort((left, right) => left - right)
    .map((month) => String(month));
}

function toggleSelection(collection, value) {
  return collection.includes(value)
    ? collection.filter((item) => item !== value)
    : [...collection, value];
}

function matchesFilter(value, selectedValues) {
  return selectedValues.length === 0 || selectedValues.includes(String(value));
}

function getChartFilteredRows() {
  return state.dataset.detailTable.filter(
    (row) =>
      matchesFilter(row.normalizedCountryLabel, state.selectedCountries) &&
      matchesFilter(row.year, state.selectedYears) &&
      matchesFilter(row.month, state.selectedMonths),
  );
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

function getTrendSeries() {
  const byPeriod = new Map();

  for (const row of getChartFilteredRows()) {
    const current = byPeriod.get(row.periodKey) ?? {
      year: row.year,
      month: row.month,
      periodKey: row.periodKey,
      shortTermVisitorsTotal: 0,
    };
    current.shortTermVisitorsTotal += row.shortTermVisitorsTotal;
    byPeriod.set(row.periodKey, current);
  }

  return [...byPeriod.values()].sort((left, right) =>
    left.periodKey.localeCompare(right.periodKey),
  );
}

function getCountryVisitorShareSeries() {
  const byCountry = new Map();
  let totalVisitors = 0;

  for (const row of getChartFilteredRows()) {
    const current = byCountry.get(row.normalizedCountryKey) ?? {
      normalizedCountryKey: row.normalizedCountryKey,
      countryName: row.normalizedCountryLabel,
      shortTermVisitorsTotal: 0,
    };

    current.shortTermVisitorsTotal += row.shortTermVisitorsTotal;
    totalVisitors += row.shortTermVisitorsTotal;
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
  const visitorSeries = getCountryVisitorShareSeries();
  const byCountry = new Map(
    visitorSeries.map((row) => [
      row.normalizedCountryKey,
      {
        ...row,
        totalPopulationCount: 0,
        shortTermVisaRatio: null,
      },
    ]),
  );

  for (const row of getChartFilteredRows()) {
    const current = byCountry.get(row.normalizedCountryKey);
    if (!current) {
      continue;
    }

    current.totalPopulationCount += row.totalPopulationCount ?? 0;
  }

  return [...byCountry.values()]
    .map((row) => ({
      ...row,
      shortTermVisaRatio:
        row.totalPopulationCount > 0
          ? row.shortTermVisitorsTotal / row.totalPopulationCount
          : null,
    }))
    .filter((row) => row.shortTermVisaRatio !== null)
    .sort((left, right) => {
      const leftRatio = left.shortTermVisaRatio ?? -1;
      const rightRatio = right.shortTermVisaRatio ?? -1;
      return rightRatio - leftRatio;
    });
}

function getGenderComparisonSeries() {
  const byCountry = new Map();

  for (const row of getChartFilteredRows()) {
    const current = byCountry.get(row.normalizedCountryKey) ?? {
      normalizedCountryKey: row.normalizedCountryKey,
      countryName: row.normalizedCountryLabel,
      male: 0,
      female: 0,
      total: 0,
    };

    current.male += row.maleShortTermVisitors ?? 0;
    current.female += row.femaleShortTermVisitors ?? 0;
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

function getSelectionSummary() {
  return {
    countryCount:
      state.selectedCountries.length > 0
        ? state.selectedCountries.length
        : getAvailableCountries().length,
    yearLabel:
      state.selectedYears.length > 0
        ? `${state.selectedYears.length}개 연도`
        : "전체 연도",
    monthLabel:
      state.selectedMonths.length > 0
        ? `${state.selectedMonths.length}개 월`
        : "전체 월",
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
    state.selectedMonths.length > 0
      ? `months-${state.selectedMonths.join("-")}`
      : "months-all";

  return [countryPart, yearPart, monthPart].join("_");
}

function buildYearlyShortTermWorkbookRows(rows) {
  const byYear = new Map();

  for (const row of rows) {
    const yearBucket = byYear.get(row.year) ?? new Map();
    const countryBucket = yearBucket.get(row.normalizedCountryLabel) ?? {
      countryName: row.normalizedCountryLabel,
      months: Array.from({ length: 12 }, () => 0),
      total: 0,
    };

    const monthIndex = row.month - 1;
    if (monthIndex >= 0 && monthIndex < 12) {
      countryBucket.months[monthIndex] += row.shortTermVisitorsTotal;
    }
    countryBucket.total += row.shortTermVisitorsTotal;
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

function renderFilterChips(target, options, selectedValues, toggleHandler, formatter) {
  target.replaceChildren(
    ...options.map((option) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `filter-chip-button${selectedValues.includes(option) ? " is-selected" : ""}`;
      button.textContent = formatter(option);
      button.addEventListener("click", () => toggleHandler(option));
      return button;
    }),
  );
}

function updateSelection(type, value) {
  if (type === "country") {
    state.selectedCountries = toggleSelection(state.selectedCountries, value);
  }
  if (type === "year") {
    state.selectedYears = toggleSelection(state.selectedYears, value);
  }
  if (type === "month") {
    state.selectedMonths = toggleSelection(state.selectedMonths, value);
  }
  state.currentPage = 1;
  renderDashboard();
}

function clearSelection(type) {
  if (type === "country") {
    state.selectedCountries = [];
  }
  if (type === "year") {
    state.selectedYears = [];
  }
  if (type === "month") {
    state.selectedMonths = [];
  }
  state.currentPage = 1;
  renderDashboard();
}

function renderFilters() {
  renderFilterChips(
    elements.countryFilterOptions,
    getAvailableCountries(),
    state.selectedCountries,
    (value) => updateSelection("country", value),
    (value) => value,
  );
  renderFilterChips(
    elements.yearFilterOptions,
    getAvailableYears(),
    state.selectedYears,
    (value) => updateSelection("year", value),
    (value) => `${value}년`,
  );
  renderFilterChips(
    elements.monthFilterOptions,
    getAvailableMonths(),
    state.selectedMonths,
    (value) => updateSelection("month", value),
    (value) => `${value}월`,
  );
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
  const maxValue = Math.max(...points.map((point) => point.shortTermVisitorsTotal), 1);
  const stepX = chartWidth / Math.max(points.length - 1, 1);
  const summary = getSelectionSummary();

  const coords = points.map((point, index) => {
    const x = margin.left + stepX * index;
    const y =
      margin.top +
      chartHeight -
      (point.shortTermVisitorsTotal / maxValue) * chartHeight;
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

  elements.monthlyTrendChart.innerHTML = `
    <div class="chart-layout">
      <svg class="chart-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="단기 관광객 시계열">
        ${gridLines}
        <path class="chart-area" d="${areaPath}"></path>
        <path class="chart-line" d="${linePath}"></path>
        <circle class="chart-highlight-dot" cx="${lastPoint.x}" cy="${lastPoint.y}" r="5"></circle>
        ${xLabels}
      </svg>
      <div class="chart-annotation">
        <span class="annotation-chip">${summary.countryCount}개 국가군</span>
        <span class="annotation-chip">${summary.yearLabel}</span>
        <span class="annotation-chip">${summary.monthLabel}</span>
        <span class="annotation-chip mono">최근값 ${formatNumber(lastPoint.shortTermVisitorsTotal)} 명</span>
      </div>
    </div>
  `;
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
        <span class="annotation-chip">선택 결과 국가별 비율</span>
        <span class="annotation-chip mono">분모: 총합계</span>
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
    .map((row, index) => {
      return `
        <div class="bar-row">
          <div class="bar-label">${row.countryName}</div>
          <div class="bar-track">
            <div class="bar-fill" style="width: ${(row.shareRatio / maxRatio) * 100}%"></div>
          </div>
          <div class="bar-meta">${formatNumber(row.shortTermVisitorsTotal)}명 · ${formatRatio(row.shareRatio)}</div>
        </div>
      `;
    })
    .join("");

  elements.countryVisitorPieChart.innerHTML = `
    <div class="chart-layout">
      <div class="chart-annotation">
        <span class="annotation-chip">${summary.countryCount}개 국가군</span>
        <span class="annotation-chip">${summary.yearLabel}</span>
        <span class="annotation-chip">${summary.monthLabel}</span>
        <span class="annotation-chip mono">총 ${formatNumber(totalVisitors)} 명</span>
        <span class="annotation-chip">분모: 전체 단기 입국자</span>
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
            <div class="gender-stack-segment gender-stack-segment-male" style="width: ${row.maleRatio * 100}%;">
              <span>${formatRatio(row.maleRatio)}</span>
            </div>
            <div class="gender-stack-segment gender-stack-segment-female" style="width: ${row.femaleRatio * 100}%;">
              <span>${formatRatio(row.femaleRatio)}</span>
            </div>
          </div>
        </article>
      `,
    )
    .join("");

  elements.genderShareChart.innerHTML = `
    <div class="chart-layout">
      <div class="chart-annotation">
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

function renderTable() {
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
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td class="mono">${formatPeriod(row.periodKey)}</td>
        <td>${row.continentName ?? "-"}</td>
        <td>${row.normalizedCountryLabel}</td>
        <td>${formatNumber(row.shortTermVisitorsTotal)}</td>
        <td>${row.maleShortTermVisitors === null ? "-" : formatNumber(row.maleShortTermVisitors)}</td>
        <td>${row.femaleShortTermVisitors === null ? "-" : formatNumber(row.femaleShortTermVisitors)}</td>
        <td>${row.shortTermVisaRatio === null ? "-" : formatRatio(row.shortTermVisaRatio)}</td>
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

function bindEvents() {
  elements.countryClearButton.addEventListener("click", () => clearSelection("country"));
  elements.yearClearButton.addEventListener("click", () => clearSelection("year"));
  elements.monthClearButton.addEventListener("click", () => clearSelection("month"));

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
    const totalPages = Math.max(
      Math.ceil(getTableFilteredRows().length / state.pageSize),
      1,
    );
    state.currentPage = Math.min(totalPages, state.currentPage + 1);
    renderTable();
  });

  elements.tableExportButton.addEventListener("click", () => {
    const rows = getTableFilteredRows();
    if (rows.length === 0) {
      return;
    }

    const exportRows = rows.map((row) => ({
      period: row.periodKey,
      country_group: row.normalizedCountryLabel,
      continent: row.continentName ?? "",
      short_term_visitors_total: row.shortTermVisitorsTotal,
      total_population_count: row.totalPopulationCount ?? "",
      short_term_visa_ratio: row.shortTermVisaRatio === null ? "" : Number((row.shortTermVisaRatio * 100).toFixed(2)),
      male_short_term_visitors: row.maleShortTermVisitors ?? "",
      female_short_term_visitors: row.femaleShortTermVisitors ?? "",
    }));

    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(exportRows);
    XLSX.utils.book_append_sheet(workbook, worksheet, "detail_table");

    const stamp = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(
      workbook,
      `kresident_filtered_detail_${buildFilterStamp()}_${stamp}.xlsx`,
    );
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
  }
}

void init();
