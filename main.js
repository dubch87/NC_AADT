const map = L.map('map').setView([35.25, -82.25], 12);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19,
}).addTo(map);

const stationsLayer = L.esri.featureLayer({
  url: 'https://services.arcgis.com/NuWFvHYDMVmmxMeM/ArcGIS/rest/services/NCDOT_AADT_Web_Map_WFL_2023Nov7/FeatureServer/3',
  pointToLayer: function(feature, latlng) {
    return L.circleMarker(latlng, {
      radius: 6,
      fillColor: '#3388ff',
      color: '#0055ff',
      weight: 1,
      opacity: 1,
      fillOpacity: 0.8,
      cursor: 'pointer'
    });
  }
}).addTo(map);

let currentChart = null;

// Close chart button logic
document.getElementById('closeChartBtn').addEventListener('click', () => {
  const chartContainer = document.getElementById('chart-container');
  chartContainer.style.display = 'none';

  if (currentChart) {
    currentChart.destroy();
    currentChart = null;
  }
});

stationsLayer.on('click', function(e) {
  const props = e.layer.feature.properties;

  // Gather all years and values (including zeros/NaNs)
  const allYears = [];
  const allValues = [];

  for (let year = 2002; year <= 2023; year++) {
    const fieldName = `AADT_${year}`;
    const rawVal = props[fieldName];
    const val = Number(rawVal);
    allYears.push(year);
    allValues.push(isNaN(val) ? 0 : val);
  }

  // Prepare filtered arrays for regression (only positive values)
  const filteredData = allYears
    .map((y, i) => ({ year: y, val: allValues[i] }))
    .filter(d => d.val > 0);

  const filteredYears = filteredData.map(d => d.year);
  const filteredValues = filteredData.map(d => d.val);

  const extrapYearsCount = 10;
  const extrapYears = [];
  const extrapValues = [];

  if (filteredValues.length >= 10) {
    const n = filteredValues.length;
    const sumX = filteredYears.reduce((a, b) => a + b, 0);
    const sumY = filteredValues.reduce((a, b) => a + b, 0);
    const sumXY = filteredYears.reduce((sum, x, i) => sum + x * filteredValues[i], 0);
    const sumX2 = filteredYears.reduce((sum, x) => sum + x * x, 0);

    const denominator = n * sumX2 - sumX * sumX;

    if (denominator !== 0) {
      const slope = (n * sumXY - sumX * sumY) / denominator;
      const intercept = (sumY - slope * sumX) / n;

      const lastYear = filteredYears[filteredYears.length - 1];

      for (let i = 1; i <= extrapYearsCount; i++) {
        const nextYear = lastYear + i;
        const extrapValue = slope * nextYear + intercept;
        extrapYears.push(nextYear.toString());
        extrapValues.push(Math.max(0, Math.round(extrapValue / 100) * 100));
      }
    }
  }

  // Show chart container
  const chartContainer = document.getElementById('chart-container');
  chartContainer.style.display = 'block';

  const ctx = document.getElementById('aadtChart').getContext('2d');

  // Destroy old chart if exists
  if (currentChart) {
    currentChart.destroy();
  }

  const route = props.ROUTE || 'UnknownRoute';
  const location = props.LOCATION || 'UnknownLocation';

  currentChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: allYears.map(y => y.toString()).concat(extrapYears),
      datasets: [
        {
          label: `AADT for ${route} ${location}`,
          data: allValues.concat(Array(extrapValues.length).fill(null)), // bars for all years, gaps for extrapolation
          backgroundColor: 'rgba(54, 162, 235, 0.7)',
          yAxisID: 'y-axis-1',
        },
        {
          label: 'Future AADT (Linear Regression)',
          data: Array(allValues.length).fill(null).concat(extrapValues), // gaps for known data, values for extrapolation
          type: 'line',
          fill: false,
          borderColor: 'rgba(255, 99, 132, 0.8)',
          backgroundColor: 'rgba(255, 99, 132, 0.5)',
          pointRadius: 4,
          borderWidth: 2,
          yAxisID: 'y-axis-1',
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      legend: { display: true },
      scales: {
        yAxes: [{
          id: 'y-axis-1',
          position: 'left',
          ticks: { beginAtZero: true },
        }],
        xAxes: [{
          ticks: {
            maxRotation: 90,
            minRotation: 45
          }
        }]
      },
      tooltips: {
        callbacks: {
          title: () => '',
          label: (tooltipItem) => tooltipItem.yLabel,
        }
      }
    }

  });
});


