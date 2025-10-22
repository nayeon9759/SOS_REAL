document.addEventListener("DOMContentLoaded", () => {
  // 🚨 1. Google Apps Script URL
  const API_URL = 'https://script.google.com/macros/s/AKfycbwfqm6JLNMXqL1MTumvEMuCp_IeBnddDMmIKocbQaMqOzXXayFz9DzdUWHnyt4LZEZ6AA/exec';
  
  const form = document.getElementById("petSurveyForm");
  const msg = document.getElementById("msg");
  const submissionsList = document.getElementById("submissionsList");
  const regionOtherInput = document.querySelector('input[name="regionOther"]');
  const tabBtns = document.querySelectorAll(".tab-btn");

  let localSubmissions = [];
  const chartInstances = new Map();

  const keyMap = { /* ... */ };

  const fetchSubmissions = async (render=false) => {
    try {
      const uniqueApiUrl = `${API_URL}?t=${new Date().getTime()}`;
      submissionsList.innerHTML = '<div class="placeholder">제출된 기록을 불러오는 중입니다...</div>';

      const res = await fetch(uniqueApiUrl);
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      
      const data = await res.json();
      
      if (Array.isArray(data)) {
        localSubmissions = data; 
        renderSubmissions(); 
        if (render) {
          renderCharts();
        }
      } else {
        console.error("데이터 로딩 실패: 서버 응답 형식이 올바르지 않음");
        submissionsList.innerHTML = '<div class="placeholder">데이터 로딩 실패: 서버 응답 형식이 올바르지 않습니다.</div>';
      }
    } catch (error) {
      console.error("서버 데이터 로딩 오류:", error);
      submissionsList.innerHTML = '<div class="placeholder">네트워크 오류 또는 GAS 서버 오류로 데이터를 불러올 수 없습니다.</div>';
    }
  };

  // 폼 제출 (생략 - 이전과 동일)
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    msg.textContent = "✅ 제출 중...";
    const data = new FormData(form);
    const payload = {};
    for (const [k, v] of data.entries()) payload[k] = v;
    try {
      await fetch(API_URL, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      msg.textContent = "💌 제출이 완료되었습니다! 최신 데이터로 그래프를 갱신합니다.";
      await fetchSubmissions(true);
      form.reset();
      regionOtherInput.style.display = "none";
      document.querySelector('.tab-btn[data-target="submissions"]').click();
    } catch (error) {
      msg.textContent = "⚠️ 서버 응답 오류 발생. 데이터 갱신을 시도합니다.";
      await fetchSubmissions(true);
      document.querySelector('.tab-btn[data-target="submissions"]').click();
    }
  });

  const renderSubmissions = () => { /* ... 이전과 동일 ... */ };

  // 5. 그래프 렌더링 (최종 수정)
  const renderCharts = () => {
    const regionCount = {};
    const priceCount = {};

    localSubmissions.forEach(sub => {
      const reg = sub.region === "기타" ? sub.regionOther : sub.region;
      if (reg) regionCount[reg] = (regionCount[reg] || 0) + 1;
      if (sub.priceRange) priceCount[sub.priceRange] = (priceCount[sub.priceRange] || 0) + 1;
    });

    const renderBarChart = (ctxId, labels, data, color) => {
      // ⭐️⭐️⭐️ 문제 해결: 캔버스를 찾고 getContext까지 한 줄로 안전하게 처리
      const ctx = document.getElementById(ctxId)?.getContext("2d");
      if (!ctx) {
        console.error(`[Chart Error] Canvas or 2D context not available for: ${ctxId}`);
        return;
      }
      
      if (chartInstances.has(ctxId)) {
        chartInstances.get(ctxId).destroy();
        chartInstances.delete(ctxId);
      }

      const newChart = new Chart(ctx, {
        type: "bar",
        data: { labels: labels, datasets: [{ label: "응답 수", data: data, backgroundColor: color }] },
        options: { 
            responsive: true, 
            plugins: { legend: { display: false } },
            scales: { 
                y: { 
                    beginAtZero: true, 
                    suggestedMin: 0,
                    ticks: { stepSize: 1 } 
                } 
            }
        }
      });
      
      chartInstances.set(ctxId, newChart);
    };

    const priceLabelsOrdered = ["50만원 미만", "50만원 ~ 100만원", "100만원 ~ 200만원", "200만원 이상"];
    const priceDataOrdered = priceLabelsOrdered.map(label => priceCount[label] || 0);

    renderBarChart("regionChart", Object.keys(regionCount), Object.values(regionCount), "rgba(255,77,79,0.7)");
    renderBarChart("priceChart", priceLabelsOrdered, priceDataOrdered, "rgba(255,159,67,0.7)");
  };

  // 6. 탭 클릭 이벤트 (⭐️ 탭 클릭 시 차트 렌더링 타이밍을 비동기로 미룸)
  tabBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      tabBtns.forEach(b => b.classList.remove("active"));
      document.querySelectorAll(".tab-panel").forEach(p => p.classList.remove("active"));
      
      btn.classList.add("active");
      document.getElementById(btn.dataset.target).classList.add("active");

      if (btn.dataset.target === "submissions") {
        // ⭐️ 탭 전환 후 브라우저가 DOM을 완전히 렌더링할 시간을 100ms 정도 줍니다.
        setTimeout(() => {
          renderCharts(); 
          fetchSubmissions(true);
        }, 100);
      }
    });
  });

  // 7. 초기 서버 데이터 로드
  fetchSubmissions(false); 
  
  // 기타 입력 토글 로직 (생략 - 이전과 동일)
  document.querySelectorAll('input[name="region"]').forEach(radio => {
    radio.addEventListener('change', () => {
      if (radio.value === "기타") {
        regionOtherInput.style.display = "block";
        regionOtherInput.required = true;
      } else {
        regionOtherInput.style.display = "none";
        regionOtherInput.required = false;
      }
    });
  });
});
