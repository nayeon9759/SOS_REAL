document.addEventListener("DOMContentLoaded", () => {
  // 🚨 1. Google Apps Script URL (고객님 링크 삽입 완료)
  const API_URL = 'https://script.google.com/macros/s/AKfycbwfqm6JLNMXqL1MTumvEMuCp_IeBnddDMmIKocbQaMqOzXXayFz9DzdUWHnyt4LZEZ6AA/exec';
  
  const form = document.getElementById("petSurveyForm");
  const msg = document.getElementById("msg");
  const submissionsList = document.getElementById("submissionsList");
  const regionOtherInput = document.querySelector('input[name="regionOther"]');
  const tabBtns = document.querySelectorAll(".tab-btn");

  let localSubmissions = [];
  const chartInstances = new Map(); // 차트 인스턴스 관리용

  const keyMap = {
    hasPet: "반려동물 보유", region: "지역", regionOther: "직접 입력 지역",
    priorityCriteria: "병원 선택 기준", concernAndFeature: "불만/필요 기능",
    priority1: "1순위 정보", priority2: "2순위 정보", priceRange: "최대 지불 의향"
  };

  /**
   * 2. 서버에서 최신 데이터를 가져와 localSubmissions를 갱신
   */
  const fetchSubmissions = async (render=false) => { // render 플래그 추가
    try {
      const uniqueApiUrl = `${API_URL}?t=${new Date().getTime()}`;
      submissionsList.innerHTML = '<div class="placeholder">제출된 기록을 불러오는 중입니다...</div>';

      const res = await fetch(uniqueApiUrl);
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      
      const data = await res.json();
      
      if (Array.isArray(data)) {
        localSubmissions = data; 
        renderSubmissions(); 
        if (render) { // ⭐️ render 플래그가 true일 때만 차트 갱신
          renderCharts();
        }
      } else {
        submissionsList.innerHTML = '<div class="placeholder">데이터 로딩 실패: 서버 응답 형식이 올바르지 않습니다.</div>';
      }
    } catch (error) {
      console.error("서버 데이터 로딩 오류:", error);
      submissionsList.innerHTML = '<div class="placeholder">네트워크 오류 또는 GAS 서버 오류로 데이터를 불러올 수 없습니다.</div>';
    }
  };


  // 3. 폼 제출
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    msg.textContent = "✅ 제출 중...";

    const data = new FormData(form);
    const payload = {};
    for (const [k, v] of data.entries()) payload[k] = v;

    try {
      await fetch(API_URL, {
        method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      msg.textContent = "💌 제출이 완료되었습니다! 최신 데이터로 그래프를 갱신합니다.";
      
      await fetchSubmissions(true); // ⭐️ 제출 후 바로 차트 렌더링 요청
      form.reset();
      regionOtherInput.style.display = "none";
      
      // '다른 사람 의견 보기' 탭으로 자동 전환 및 활성화
      document.querySelector('.tab-btn[data-target="submissions"]').click();

    } catch (error) {
      msg.textContent = "⚠️ 서버 응답 오류 발생. 데이터 갱신을 시도합니다.";
      await fetchSubmissions(true);
      document.querySelector('.tab-btn[data-target="submissions"]').click();
    }
  });

  // 4. submissions 렌더링 (이전과 동일)
  const renderSubmissions = () => {
    submissionsList.innerHTML = "";
    
    if (localSubmissions.length === 0) {
        submissionsList.innerHTML = '<div class="placeholder">아직 제출된 기록이 없습니다.</div>';
        return;
    }
    
    localSubmissions.slice().reverse().forEach((sub) => {
      const card = document.createElement("div");
      card.className = "record";
      let html = Object.entries(sub)
        .filter(([k,v]) => !(k === "regionOther" && sub.region !== "기타") && v !== "")
        .map(([k,v]) => `<div><strong>${keyMap[k]||k}:</strong> ${v}</div>`)
        .join("");
      if (!html) html = "<div>제출된 정보 없음</div>";
      card.innerHTML = html;
      submissionsList.appendChild(card);
    });
  };

  // 5. 그래프 렌더링 (이전과 동일)
  const renderCharts = () => {
    const regionCount = {};
    const priceCount = {};

    localSubmissions.forEach(sub => {
      const reg = sub.region === "기타" ? sub.regionOther : sub.region;
      if (reg) regionCount[reg] = (regionCount[reg] || 0) + 1;
      if (sub.priceRange) priceCount[sub.priceRange] = (priceCount[sub.priceRange] || 0) + 1;
    });

    const renderBarChart = (ctxId, labels, data, color) => {
      // ⭐️ 캔버스 엘리먼트가 실제로 존재하는지 확인
      const canvasEl = document.getElementById(ctxId);
      if (!canvasEl) return;
      
      const ctx = canvasEl.getContext("2d");
      if (!ctx) return; 

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

  // 6. 탭 클릭 이벤트 (⭐️ 탭 클릭 시 차트 렌더링을 강제 요청)
  tabBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      tabBtns.forEach(b => b.classList.remove("active"));
      document.querySelectorAll(".tab-panel").forEach(p => p.classList.remove("active"));
      
      btn.classList.add("active");
      document.getElementById(btn.dataset.target).classList.add("active");

      if (btn.dataset.target === "submissions") {
        // ⭐️ 탭 클릭 시 이미 불러온 데이터로 일단 차트만 렌더링하고, 이후에 서버 데이터를 갱신 (더 빠른 UI 피드백)
        renderCharts(); 
        fetchSubmissions(true); // 서버 데이터를 새로 불러오고 갱신
      }
    });
  });

  // 7. 초기 서버 데이터 로드
  // 초기 로드 시에는 차트 렌더링을 요청하지 않고, 탭 클릭 시에 렌더링되도록 함
  fetchSubmissions(false); 

  // "기타" 입력 토글 (이전과 동일)
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
