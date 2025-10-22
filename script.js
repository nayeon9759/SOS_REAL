document.addEventListener("DOMContentLoaded", () => {
  const API_URL = "https://script.google.com/macros/s/AKfycbwfqm6JLNMXqL1MTumvEMuCp_IeBnddDMmIKocbQaMqOzXXayFz9DzdUWHnyt4LZEZ6AA/exec";
  const form = document.getElementById("petSurveyForm");
  const msg = document.getElementById("msg");
  const submissionsList = document.getElementById("submissionsList");
  const regionOtherInput = document.querySelector('input[name="regionOther"]');
  const tabBtns = document.querySelectorAll(".tab-btn");

  let localSubmissions = [];
  const chartInstances = new Map();

  const fetchSubmissions = async (render = false) => {
    try {
      const res = await fetch(`${API_URL}?t=${Date.now()}`);
      const data = await res.json();
      localSubmissions = data;
      renderSubmissions();
      if (render) renderCharts();
    } catch (err) {
      console.error("데이터 로딩 오류:", err);
    }
  };

  const renderSubmissions = () => {
    submissionsList.innerHTML = "";
    if (localSubmissions.length === 0) {
      submissionsList.innerHTML = `<div class="placeholder">아직 제출된 기록이 없습니다.</div>`;
      return;
    }
    localSubmissions.slice(-10).forEach(sub => {
      const div = document.createElement("div");
      div.className = "record";
      div.innerHTML = `
        <div class="meta">${sub.region || "지역 미입력"} · ${sub.priceRange || "금액 미입력"}</div>
        <div class="txt">${sub.concernAndFeature || ""}</div>
      `;
      submissionsList.appendChild(div);
    });
  };

  const renderCharts = () => {
    const regionCount = {};
    const priceCount = {};

    localSubmissions.forEach(sub => {
      const reg = sub.region === "기타" ? sub.regionOther : sub.region;
      if (reg) regionCount[reg] = (regionCount[reg] || 0) + 1;
      if (sub.priceRange) priceCount[sub.priceRange] = (priceCount[sub.priceRange] || 0) + 1;
    });

    const renderBarChart = (id, labels, data, color) => {
      const ctx = document.getElementById(id)?.getContext("2d");
      if (!ctx) return;
      if (chartInstances.has(id)) chartInstances.get(id).destroy();

      const chart = new Chart(ctx, {
        type: "bar",
        data: { labels, datasets: [{ data, backgroundColor: color }] },
        options: {
          responsive: true,
          plugins: { legend: { display: false } },
          scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } }
        }
      });
      chartInstances.set(id, chart);
    };

    renderBarChart("regionChart", Object.keys(regionCount), Object.values(regionCount), "#ff4d4f");
    renderBarChart("priceChart", ["50만원 미만", "50만원 ~ 100만원", "100만원 ~ 200만원", "200만원 이상"],
      ["50만원 미만", "50만원 ~ 100만원", "100만원 ~ 200만원", "200만원 이상"].map(v => priceCount[v] || 0),
      "#ff9f43");
  };

  form.addEventListener("submit", async e => {
    e.preventDefault();
    msg.textContent = "✅ 제출 중...";
    const data = Object.fromEntries(new FormData(form).entries());
    try {
      await fetch(API_URL, { method: "POST", mode: "no-cors", body: JSON.stringify(data) });
      msg.textContent = "💌 제출 완료! 그래프 갱신 중...";
      await fetchSubmissions(true);
      form.reset();
      regionOtherInput.style.display = "none";
      document.querySelector('.tab-btn[data-target="submissions"]').click();
    } catch {
      msg.textContent = "⚠️ 서버 오류, 데이터 갱신을 시도합니다.";
    }
  });

  tabBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      tabBtns.forEach(b => b.classList.remove("active"));
      document.querySelectorAll(".tab-panel").forEach(p => p.classList.remove("active"));
      btn.classList.add("active");
      document.getElementById(btn.dataset.target).classList.add("active");
      if (btn.dataset.target === "submissions") {
        setTimeout(() => renderCharts(), 200);
      }
    });
  });

  document.querySelectorAll('input[name="region"]').forEach(radio => {
    radio.addEventListener("change", () => {
      regionOtherInput.style.display = radio.value === "기타" ? "block" : "none";
    });
  });

  fetchSubmissions(true);
});
