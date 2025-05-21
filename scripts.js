let rawData = null;
let lineChart, donutChart, barChart;

// Load and initialize
fetch('data.json')
  .then(res => res.json())
  .then(json => {
    rawData = json;
    document.getElementById("generatedTime").textContent = `Generated: ${new Date(json.metadata.generatedAt).toLocaleString()}`;
    populateFilters(json.data);
    updateCharts();
  });

// Populate dropdown filters
function populateFilters(data) {
  populateSelect("month", ["All", ...data.months]);
  populateSelect("region", ["All", ...data.regions]);
  populateSelect("category", ["All", ...data.categories]);

  document.querySelectorAll("select").forEach(sel => {
    sel.addEventListener("change", updateCharts);
  });

  document.getElementById("upload-json").addEventListener("change", handleFileUpload);
  document.getElementById("downloadCSV").addEventListener("click", exportCSV);
  document.getElementById("toggleTheme").addEventListener("click", toggleTheme);

  applyStoredTheme();
}

function populateSelect(name, options) {
  const select = document.querySelector(`select[name="${name}"]`);
  select.innerHTML = options.map(opt => `<option value="${opt}">${opt}</option>`).join("");
}

function updateCharts() {
  const sales = rawData.data.sales;
  const months = rawData.data.months;
  const categories = rawData.data.categories;
  const regions = rawData.data.regions;

  const selectedMonth = document.querySelector("select[name='month']").value;
  const selectedRegion = document.querySelector("select[name='region']").value;
  const selectedCategory = document.querySelector("select[name='category']").value;

  const filtered = sales.filter(s => {
    const matchMonth = selectedMonth === "All" || s.month === selectedMonth;
    const matchRegion = selectedRegion === "All" || s.region === selectedRegion;
    return matchMonth && matchRegion;
  });

  // Line Chart Data
  const monthlyTotals = months.map(month => {
    const byMonth = filtered.filter(s => s.month === month);
    return byMonth.reduce((acc, s) => {
      const val = selectedCategory === "All"
        ? Object.values(s.values).reduce((a, b) => a + b, 0)
        : (s.values[selectedCategory] || 0);
      return acc + val;
    }, 0);
  });

  // Donut Chart Data
  const categoryTotals = categories.map(cat => {
    return filtered.reduce((acc, s) => acc + (s.values[cat] || 0), 0);
  });

  // Bar Chart Data
  const barData = regions.map(region => {
    const byRegion = filtered.filter(s => s.region === region);
    return categories.map(cat =>
      byRegion.reduce((acc, s) => acc + (s.values[cat] || 0), 0)
    );
  });

  drawLineChart(months, monthlyTotals);
  drawDonutChart(categories, categoryTotals);
  drawStackedBarChart(regions, categories, barData);
  updateSummary(filtered, categories);
}

// Charts
function drawLineChart(labels, data) {
  if (lineChart) lineChart.destroy();
  lineChart = new Chart(document.getElementById('lineChart'), {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Total Sales',
        data,
        borderColor: '#36A2EB',
        backgroundColor: 'rgba(54, 162, 235, 0.2)',
        tension: 0.4,
        fill: true
      }]
    },
    options: {
      responsive: true,
      plugins: {
        tooltip: {
          callbacks: {
            label: ctx => `$${ctx.raw.toLocaleString()}`
          }
        },
        legend: {
          onClick: toggleLegend
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            callback: val => `$${val}`
          }
        }
      }
    }
  });
}

function drawDonutChart(labels, data) {
  if (donutChart) donutChart.destroy();
  donutChart = new Chart(document.getElementById('donutChart'), {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: ['#36A2EB', '#FF6384', '#FFCE56'],
        hoverOffset: 10
      }]
    },
    options: {
      plugins: {
        tooltip: {
          callbacks: {
            label: ctx => `${ctx.label}: $${ctx.raw.toLocaleString()}`
          }
        },
        legend: {
          position: 'bottom',
          onClick: toggleLegend
        }
      }
    }
  });
}

function drawStackedBarChart(labels, categories, barData) {
  if (barChart) barChart.destroy();
  const datasets = categories.map((cat, i) => ({
    label: cat,
    data: barData.map(row => row[i]),
    backgroundColor: ['#36A2EB', '#FF6384', '#FFCE56'][i]
  }));

  barChart = new Chart(document.getElementById('barChart'), {
    type: 'bar',
    data: {
      labels,
      datasets
    },
    options: {
      responsive: true,
      plugins: {
        tooltip: {
          callbacks: {
            label: ctx => `${ctx.dataset.label} in ${ctx.label}: $${ctx.raw.toLocaleString()}`
          }
        },
        legend: {
          onClick: toggleLegend
        }
      },
      scales: {
        x: { stacked: true },
        y: {
          stacked: true,
          beginAtZero: true,
          ticks: {
            callback: val => `$${val}`
          }
        }
      }
    }
  });
}

// Toggle visibility from legend
function toggleLegend(e, legendItem, legend) {
  const index = legendItem.datasetIndex || legendItem.index;
  const chart = legend.chart;
  chart.toggleDataVisibility(index);
  chart.update();
}

// Summary Stats Panel
function updateSummary(filtered, categories) {
  let total = 0;
  const regionTotals = {};

  filtered.forEach(s => {
    const sum = Object.values(s.values).reduce((a, b) => a + b, 0);
    total += sum;
    regionTotals[s.region] = (regionTotals[s.region] || 0) + sum;
  });

  const avg = total / categories.length || 0;
  const sorted = Object.entries(regionTotals).sort((a, b) => b[1] - a[1]);

  document.getElementById('totalSales').textContent = `$${total.toLocaleString()}`;
  document.getElementById('avgPerCat').textContent = `$${avg.toFixed(0)}`;
  document.getElementById('topRegion').textContent = sorted[0]?.[0] || '-';
  document.getElementById('bottomRegion').textContent = sorted.at(-1)?.[0] || '-';
}

// Upload custom JSON
function handleFileUpload(e) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const json = JSON.parse(reader.result);
      rawData = json;
      populateFilters(json.data);
      updateCharts();
    } catch {
      alert("Invalid JSON file.");
    }
  };
  reader.readAsText(e.target.files[0]);
}

// Export CSV
function exportCSV() {
  const selectedMonth = document.querySelector("select[name='month']").value;
  const selectedRegion = document.querySelector("select[name='region']").value;
  const selectedCategory = document.querySelector("select[name='category']").value;

  const filtered = rawData.data.sales.filter(s => {
    const matchMonth = selectedMonth === "All" || s.month === selectedMonth;
    const matchRegion = selectedRegion === "All" || s.region === selectedRegion;
    return matchMonth && matchRegion;
  });

  const csv = ["Month,Region,Category,Value"];
  filtered.forEach(s => {
    const month = s.month;
    const region = s.region;
    const vals = s.values;
    Object.entries(vals).forEach(([cat, val]) => {
      if (selectedCategory === "All" || selectedCategory === cat) {
        csv.push(`${month},${region},${cat},${val}`);
      }
    });
  });

  const blob = new Blob([csv.join("\n")], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'filtered-data.csv';
  a.click();
}

// Theme toggle
function toggleTheme() {
  const dark = document.body.classList.toggle("light-theme");
  localStorage.setItem("theme", dark ? "light" : "dark");
}

function applyStoredTheme() {
  const theme = localStorage.getItem("theme");
  if (theme === "light") document.body.classList.add("light-theme");
}
function updateGeneratedTime() {
  const generatedTimeElem = document.getElementById('generatedTime');
  if (!generatedTimeElem) return;
  
  const now = new Date();
  // Format date & time as "YYYY-MM-DD HH:MM:SS"
  const formattedTime = now.toLocaleString('en-US', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  }).replace(',', '');
  
  generatedTimeElem.textContent = `Generated: ${formattedTime}`;
}

// Update immediately and then every second
updateGeneratedTime();
setInterval(updateGeneratedTime, 1000);
