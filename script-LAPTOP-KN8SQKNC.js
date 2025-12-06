// ====================================================================================
// 1. بيانات المنظمة (Company Data)
// ====================================================================================

/**
 * تحديث الإحصائيات الرئيسية في لوحة التحكم العامة.
 */
// تهيئة آمنة للمتغيرات العالمية عند عدم توفر بيانات بعد
window.departments = Array.isArray(window.departments) ? window.departments : [];
window.employees = Array.isArray(window.employees) ? window.employees : [];
window.kpis = Array.isArray(window.kpis) ? window.kpis : [];
window.goals = Array.isArray(window.goals) ? window.goals : [];
window.performanceRecords = (window.performanceRecords && typeof window.performanceRecords === 'object') ? window.performanceRecords : {};

function loadDataFromStorage(){
    try {
        const raw = localStorage.getItem('pms_data');
        if (!raw) return;
        const data = JSON.parse(raw);
        if (data && Array.isArray(data.departments)) departments = data.departments;
        if (data && Array.isArray(data.employees)) employees = data.employees;
        if (data && Array.isArray(data.kpis)) kpis = data.kpis;
        if (data && Array.isArray(data.goals)) goals = data.goals;
        if (data && typeof data.performanceRecords === 'object') performanceRecords = data.performanceRecords;
    } catch {}
}

// حساب متوسط الأداء للموظف خلال فترة محددة
function calculateAveragePerformance(empId, startDate, endDate) {
    try {
        const records = performanceRecords[empId] || [];
        const filtered = records.filter(rec => {
            const d = parseDateSafe(rec.date);
            return d >= startDate && d <= endDate;
        });
        if (!filtered.length) return null;
        const avg = filtered.reduce((sum, rec) => sum + (rec.totalScore || 0), 0) / filtered.length;
        return avg;
    } catch (_) {
        return null;
    }
}

function normalizeScore(raw, type) {
    const val = parseFloat(raw ?? '0') || 0;
    const clamped = Math.max(0, Math.min(100, val));
    return type === 'negative' ? (100 - clamped) : clamped;
}

// تحويل الأرقام العربية-الهندية إلى إنجليزية لضمان تحليل صحيح
function toWesternDigits(str){
    if (typeof str !== 'string') return str;
    const map = {'٠':'0','١':'1','٢':'2','٣':'3','٤':'4','٥':'5','٦':'6','٧':'7','٨':'8','٩':'9'};
    return str.replace(/[٠-٩]/g, d => map[d] || d);
}

// توحيد تمثيل التاريخ إلى صيغة YYYY-MM-DD من مختلف الصيغ
function canonicalizeDateString(str){
    if (!str) return '';
    let s = toWesternDigits(String(str).trim()).replace(/\//g,'-');
    const ymd = s.match(/^\d{4}-\d{1,2}-\d{1,2}$/);
    const dmy = s.match(/^\d{1,2}-\d{1,2}-\d{4}$/);
    if (ymd) {
        const [y,m,d] = s.split('-');
        return `${y.padStart(4,'0')}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`;
    }
    if (dmy) {
        const [d,m,y] = s.split('-');
        return `${y.padStart(4,'0')}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`;
    }
    return s;
}

// تحليل تاريخ آمن عبر فرض منتصف الليل لتفادي اختلاف المنطقة الزمنية
function parseDateSafe(str){
    const iso = canonicalizeDateString(str);
    return new Date(`${iso}T00:00:00`);
}

function updateDashboardStats() {
    const filteredEmployees = getFilteredEmployees();
    document.getElementById('stat-total-employees').textContent = filteredEmployees.length;
    // الأقسام في الفلتر: إن كان قسم محدد نعرض 1، وإلا العدد الكلي
    const deptFilter = window.dashboardDeptFilter || 'all';
    document.getElementById('stat-total-departments').textContent = deptFilter === 'all' ? departments.length : 1;
    document.getElementById('stat-active-kpis').textContent = kpis.length;
    const days = getGlobalPeriodDays();
    const startWindow = new Date();
    startWindow.setDate(startWindow.getDate() - days);
    const today = new Date();

    let allScores = [];
    filteredEmployees.forEach(emp => {
        const records = performanceRecords[emp.id] || [];
        records.forEach(rec => {
            const recDate = new Date(rec.date);
            if (recDate >= startWindow && recDate <= today) {
                allScores.push(rec.totalScore);
            }
        });
    });

    const avgPerformance = allScores.length > 0 
        ? (allScores.reduce((sum, score) => sum + score, 0) / allScores.length).toFixed(1)
        : 0;

    document.getElementById('stat-avg-performance').textContent = `${avgPerformance}%`;
    // Δ مقابل 30 يوماً سابقة
    const prevStart = new Date(startWindow);
    prevStart.setDate(prevStart.getDate() - days);
    const prevEnd = new Date(startWindow);
    let prevScores = [];
    filteredEmployees.forEach(emp => {
        const recs = performanceRecords[emp.id] || [];
        recs.forEach(rec => {
            const d = new Date(rec.date);
            if (d >= prevStart && d <= prevEnd) prevScores.push(rec.totalScore);
        });
    });
    const prevAvg = prevScores.length ? (prevScores.reduce((s,v)=>s+v,0) / prevScores.length).toFixed(1) : 0;
    const delta = (parseFloat(avgPerformance) - parseFloat(prevAvg)).toFixed(1);
    const deltaEl = document.getElementById('stat-avg-performance-delta');
    if (deltaEl) {
        const sign = (parseFloat(delta) >= 0) ? '+' : '';
        deltaEl.textContent = `${sign}${delta}% مقابل الفترة السابقة`;
        deltaEl.className = `delta-badge ${parseFloat(delta) >= 0 ? 'up' : 'down'}`;
    }

    renderTopEmployees();
    renderDepartmentPerformanceChart();
    renderOverallTrendChart();
    renderCriticalKpis();
}

/**
 * عرض أفضل 5 موظفين.
 */
function renderTopEmployees() {
    const tableBody = document.querySelector('#top-employees-table tbody');
    const panel = document.getElementById('top-employees-panel');
    if (panel) panel.classList.add('loading');
    tableBody.innerHTML = '';
    
    const today = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const employeeAverages = getFilteredEmployees().map(emp => {
        const avg = calculateAveragePerformance(emp.id, thirtyDaysAgo, today);
        const dept = departments.find(d => d.id === emp.deptId);
        return {
            name: emp.name,
            deptName: dept ? dept.name : 'N/A',
            averageScore: avg !== null ? parseFloat(avg.toFixed(1)) : 0
        };
    }).sort((a, b) => b.averageScore - a.averageScore)
      .slice(0, 5); // أفضل 5

    employeeAverages.forEach((emp, index) => {
        const row = tableBody.insertRow();
        row.innerHTML = `
            <td>${index + 1}</td>
            <td>${emp.name}</td>
            <td>${emp.deptName}</td>
            <td>${emp.averageScore}%</td>
        `;
    });
    if (panel) panel.classList.remove('loading');
}

/**
 * رسم بياني لأداء الأقسام.
 */
let deptChart;
function renderDepartmentPerformanceChart() {
    const panel = document.getElementById('dept-performance-panel');
    if (panel) panel.classList.add('loading');
    const canvasEl = document.getElementById('department-performance-chart');
    if (typeof Chart === 'undefined' || !canvasEl) { if (panel) panel.classList.remove('loading'); return; }
    const ctx = canvasEl.getContext('2d');
    const today = new Date();
    const days = getGlobalPeriodDays();
    const start = new Date();
    start.setDate(start.getDate() - days);

    const deptAverages = departments.map(dept => {
        const baseEmployees = getFilteredEmployees();
        const deptEmployees = baseEmployees.filter(emp => String(emp.deptId) === String(dept.id));
        
        let deptScores = [];
        deptEmployees.forEach(emp => {
            const records = performanceRecords[emp.id] || [];
            records.forEach(rec => {
                const recDate = new Date(rec.date);
                if (recDate >= start && recDate <= today) {
                    deptScores.push(rec.totalScore);
                }
            });
        });

        const avg = deptScores.length > 0 
            ? deptScores.reduce((sum, score) => sum + score, 0) / deptScores.length
            : 0;
        
        return { name: dept.name, average: parseFloat(avg.toFixed(1)) };
    }).filter(d => d.average > 0); // إظهار الأقسام ذات الأداء فقط

    const data = {
        labels: deptAverages.map(d => d.name),
        datasets: [{
            label: translate('subtitle_dept_perf'),
            data: deptAverages.map(d => d.average),
            backgroundColor: '#1abc9c',
            borderColor: '#16a085',
            borderWidth: 1
        }]
    };

    if (deptChart) deptChart.destroy();
    deptChart = new Chart(ctx, {
        type: 'bar',
        data: data,
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    max: 100,
                    title: { display: true, text: 'متوسط الأداء (%)' }
                }
            },
            plugins: {
                legend: { display: false }
            }
        }
    });
    if (panel) panel.classList.remove('loading');
}

// مخطط الاتجاه العام للأداء عبر جميع الأقسام والموظفين (آخر 60 يوماً)
let overallTrendChart;
function renderOverallTrendChart() {
    const el = document.getElementById('overall-trend-chart');
    if (!el) return;
    const panel = document.getElementById('overall-trend-panel');
    if (panel) panel.classList.add('loading');
    if (typeof Chart === 'undefined') { if (panel) panel.classList.remove('loading'); return; }
    const ctx = el.getContext('2d');

    // قراءة الفترة المختارة (30/60/90)، الافتراضي 60
    const days = getGlobalPeriodDays();

    const today = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // توليد قائمة الأيام
    const formatDate = (d) => {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    };

    const dates = [];
    for (let d = new Date(startDate); d <= today; d.setDate(d.getDate() + 1)) {
        dates.push(formatDate(new Date(d)));
    }

    // تجميع متوسط الأداء لكل يوم عبر جميع الموظفين
    const dailyAverages = dates.map(dateStr => {
        let scores = [];
        getFilteredEmployees().forEach(emp => {
            const records = performanceRecords[emp.id] || [];
            records.forEach(rec => {
                const recStr = formatDate(new Date(rec.date));
                if (recStr === dateStr) {
                    scores.push(rec.totalScore);
                }
            });
        });
        const avg = scores.length ? (scores.reduce((s, v) => s + v, 0) / scores.length) : 0;
        return parseFloat(avg.toFixed(1));
    });

    // إنشاء تدرّج لوني لطيف للخط والتعبئة
    const gradient = ctx.createLinearGradient(0, 0, 0, el.height || 300);
    gradient.addColorStop(0, 'rgba(26, 188, 156, 0.35)');
    gradient.addColorStop(1, 'rgba(26, 188, 156, 0.05)');

    const data = {
        labels: dates,
        datasets: [{
            label: translate('subtitle_overall_trend_base') || 'Overall Performance Trend',
            data: dailyAverages,
            borderColor: '#1abc9c',
            backgroundColor: gradient,
            fill: true,
            tension: 0.3,
            pointRadius: 0,
            borderWidth: 2
        }]
    };

    if (overallTrendChart) overallTrendChart.destroy();
    overallTrendChart = new Chart(ctx, {
        type: 'line',
        data,
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    max: 100,
                    title: { display: true, text: 'متوسط الأداء (%)' }
                },
                x: {
                    ticks: {
                        maxRotation: 0,
                        autoSkip: true,
                        maxTicksLimit: 8
                    }
                }
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    callbacks: {
                        label: (ctx) => `${ctx.parsed.y.toFixed(1)}%`
                    }
                }
            }
        }
    });
    if (panel) panel.classList.remove('loading');
}

/**
 * تحديث قائمة الموظفين في لوحة التحكم الشخصية.
 */
function updateDashboardEmployeeSelect() {
    const select = document.getElementById('dashboard-employee-select');
    select.innerHTML = '';
    select.appendChild(new Option(translate('select_emp_placeholder'), ''));

    employees.forEach(emp => {
        select.appendChild(new Option(emp.name, emp.id));
    });

    // تعيين الموظف الأول افتراضياً إن لم يكن هناك اختيار
    if (select.options.length > 1 && !select.value) {
        select.value = select.options[1].value;
    }

    updateEmployeeDashboard(); // عرض لوحة التحكم الشخصية للموظف المختار (إن وجد)
}

/**
 * تحديث لوحة التحكم الشخصية للموظف المختار.
 */
let personalChart;
function updateEmployeeDashboard() {
    const employeeId = document.getElementById('dashboard-employee-select').value;
    const contentDiv = document.getElementById('personal-dashboard-content');
    const messageP = document.querySelector('#personal-dashboard-content > p');
    const scoreCardDiv = document.getElementById('employee-score-card');
    const chartContainer = document.getElementById('personal-kpi-chart-container');
    
    // إخفاء المحتوى إذا لم يتم اختيار موظف
    if (!employeeId) {
        scoreCardDiv.style.display = 'none';
        chartContainer.style.display = 'none';
        messageP.style.display = 'block';
        return;
    }
    
    messageP.style.display = 'none';
    scoreCardDiv.style.display = 'grid';
    chartContainer.style.display = 'block';

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const today = new Date();

    // 1. حساب متوسط الأداء
    const avgScore = calculateAveragePerformance(employeeId, thirtyDaysAgo, today);
    document.getElementById('current-score').textContent = avgScore !== null ? `${avgScore.toFixed(1)}%` : 'N/A';

    // 2. حالة الهدف (مرتبطة بالموظف المختار)
    const activeGoal = goals.find(g => g.status === 'active' && String(g.employeeId) === String(employeeId));
    const goalStatusP = document.getElementById('goal-status');

    if (activeGoal) {
        const goalKpi = kpis.find(k => k.id === activeGoal.kpiId);
        if (goalKpi) {
            // جلب القيمة الأخيرة للمؤشر المستهدف
            const records = performanceRecords[employeeId] || [];
            const lastRecord = records.length > 0 ? records[records.length - 1] : null;

            if (lastRecord && lastRecord.scores[activeGoal.kpiId] !== undefined) {
                const lastScore = normalizeScore(lastRecord.scores[activeGoal.kpiId], goalKpi.type);
                
                if (lastScore >= activeGoal.target) {
                    goalStatusP.innerHTML = `<span style="color: ${lastScore >= 90 ? '#2ecc71' : '#f39c12'}">${translate('stat_goal_achieved')}</span> (${lastScore.toFixed(1)}% / ${activeGoal.target}%)`;
                } else {
                    goalStatusP.innerHTML = `<span style="color: #e74c3c">${translate('stat_goal_behind')}</span> (${lastScore.toFixed(1)}% / ${activeGoal.target}%)`;
                }
            } else {
                goalStatusP.innerHTML = translate('stat_no_goals'); // لا يوجد سجلات للمؤشر المستهدف
            }
        } else {
            goalStatusP.innerHTML = translate('stat_no_goals'); // المؤشر محذوف
        }
    } else {
        goalStatusP.innerHTML = translate('stat_no_goals');
    }

    // 3. رسم بياني لتطور الأداء اليومي (آخر 30 سجل)
    const records = performanceRecords[employeeId] || [];
    const recentRecords = records.slice(-30); // آخر 30 سجل
    
    // إذا لا توجد سجلات لهذا الموظف، نخفي المخطط ونُظهر رسالة مساعدة
    if (!recentRecords.length) {
        chartContainer.style.display = 'none';
        messageP.textContent = translate('msg_no_records_in_period') || 'لا توجد سجلات أداء لهذا الموظف في الفترة الأخيرة.';
        messageP.style.display = 'block';
        return;
    }

    const chartData = {
        labels: recentRecords.map(rec => rec.date),
        datasets: [{
            label: translate('stat_current_score'),
            data: recentRecords.map(rec => rec.totalScore.toFixed(1)),
            borderColor: '#3498db',
            backgroundColor: 'rgba(52, 152, 219, 0.2)',
            fill: true,
            tension: 0.4 // لجعل الخطوط أكثر نعومة
        }]
    };

    const canvasEl = document.getElementById('personal-kpi-chart');
    if (!canvasEl) return;
    const ctx = canvasEl.getContext('2d');

    // حماية عند غياب مكتبة Chart
    if (typeof Chart === 'undefined') {
        chartContainer.style.display = 'none';
        return;
    }

    if (personalChart) personalChart.destroy();
    
    personalChart = new Chart(ctx, {
        type: 'line',
        data: chartData,
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    max: 100,
                    title: { display: true, text: 'النتيجة الموزونة (%)' }
                }
            },
            plugins: {
                legend: { display: false }
            }
        }
    });
}


// ====================================================================================
// 9. التقارير والإحصائيات (Reports)
// ====================================================================================

/**
 * تحديث قائمة الموظفين في نموذج التقارير.
 */
function updateReportTargetSelect() {
    const select = document.getElementById('report-employee-select');
    if (!select) return;
    select.innerHTML = '';
    select.appendChild(new Option(translate('select_emp_placeholder'), ''));
    const deptFilterEl = document.getElementById('report-dept-filter');
    const deptFilterVal = deptFilterEl ? deptFilterEl.value : 'all';
    const list = deptFilterVal === 'all' ? employees : employees.filter(e => String(e.deptId) === String(deptFilterVal));
    list.forEach(emp => {
        select.appendChild(new Option(emp.name, emp.id));
    });
    // تعيين اختيار افتراضي لأول موظف بعد العنوان إن لم يكن هناك اختيار
    const hasCurrent = Array.from(select.options).some(o => o.value === select.value && o.value !== '');
    if (!hasCurrent && select.options.length > 1) {
        select.value = select.options[1].value;
    }
}

/**
 * توليد تقرير أداء موظف لفترة محددة.
 */
function generateReport() {
    let employeeId = document.getElementById('report-employee-select').value;
    let startDateStr = document.getElementById('report-start-date').value;
    let endDateStr = document.getElementById('report-end-date').value;
    const reportOutput = document.getElementById('report-output');
    const tableBody = document.querySelector('#daily-performance-table tbody');

    // تعبئة افتراضية عند النقص
    const empSelect = document.getElementById('report-employee-select');
    if (!employeeId && empSelect && empSelect.options.length > 1) {
        empSelect.value = empSelect.options[1].value;
        employeeId = empSelect.value;
    }
    const fmt = (d) => d.toISOString().slice(0,10);
    if (!startDateStr) {
        const d = new Date(); d.setDate(d.getDate() - 30);
        document.getElementById('report-start-date').value = fmt(d);
        startDateStr = document.getElementById('report-start-date').value;
    }
    if (!endDateStr) {
        document.getElementById('report-end-date').value = fmt(new Date());
        endDateStr = document.getElementById('report-end-date').value;
    }

    if (!employeeId || !startDateStr || !endDateStr) {
        alert(translate('alert_fill_all_report_fields'));
        return;
    }
    
    const startDate = parseDateSafe(startDateStr);
    const endDate = parseDateSafe(endDateStr);

    if (startDate > endDate) {
        alert(translate('alert_start_date_after_end'));
        return;
    }
    
    const employee = employees.find(e => String(e.id) === String(employeeId));
    const records = performanceRecords[employeeId] || [];

    const targetRecords = records.filter(rec => {
        const recordDate = parseDateSafe(rec.date);
        return recordDate >= startDate && recordDate <= endDate;
    }).sort((a, b) => parseDateSafe(a.date) - parseDateSafe(b.date));

    tableBody.innerHTML = '';
    
    if (targetRecords.length === 0) {
        reportOutput.style.display = 'none';
        alert(translate('msg_no_records_in_period'));
        return;
    }

    let totalScoreSum = 0;
    targetRecords.forEach(rec => {
        const row = tableBody.insertRow();
        const score = rec.totalScore.toFixed(1);
        totalScoreSum += rec.totalScore;
        row.innerHTML = `
            <td>${rec.date}</td>
            <td>${score}%</td>
        `;
    });

    const avgScore = totalScoreSum / targetRecords.length;
    const reportTitle = document.getElementById('report-title');
    const reportAvgScore = document.getElementById('report-avg-score');
    
    reportTitle.textContent = `${translate('report_title_emp')} - ${employee ? employee.name : employeeId}`;
    reportAvgScore.textContent = `${translate('stat_avg_period')} ${startDateStr} ${translate('to')} ${endDateStr}: ${avgScore.toFixed(1)}%`;
    
    reportOutput.style.display = 'block';
}

/**
 * توليد التقرير الإجمالي لأداء المنظمة (حسب القسم).
 */
function generateOverallReport() {
    const outputDiv = document.getElementById('overall-report-output');
    outputDiv.innerHTML = '';

    const overallAverages = departments.map(dept => {
        const deptEmployees = employees.filter(emp => String(emp.deptId) === String(dept.id));
        
        let deptScores = [];
        deptEmployees.forEach(emp => {
            const records = performanceRecords[emp.id] || [];
            // نأخذ جميع السجلات لحساب متوسط الأداء التاريخي
            deptScores.push(...records.map(rec => rec.totalScore));
        });

        const avg = deptScores.length > 0 
            ? deptScores.reduce((sum, score) => sum + score, 0) / deptScores.length
            : 0;
        
        return { name: dept.name, average: parseFloat(avg.toFixed(1)) };
    });

    if (overallAverages.length === 0) {
        outputDiv.innerHTML = `<p>${translate('msg_no_records_in_period')}</p>`;
        return;
    }

    let overallTotalAvg = overallAverages.reduce((sum, item) => sum + item.average, 0);
    overallTotalAvg = overallAverages.filter(item => item.average > 0).length > 0 
        ? (overallTotalAvg / overallAverages.filter(item => item.average > 0).length).toFixed(1) 
        : 0;

    let html = `<h3>${translate('subtitle_overall_report')}</h3>`;
    html += `<p style="font-weight: bold; margin-bottom: 15px;">${translate('overall_avg')}: ${overallTotalAvg}%</p>`;
    html += `<table class="data-table">
                <thead>
                    <tr>
                        <th data-i18n="table_dept">${translate('table_dept')}</th>
                        <th data-i18n="stat_avg_performance">${translate('stat_avg_performance')}</th>
                    </tr>
                </thead>
                <tbody>`;

    overallAverages.forEach(item => {
        html += `<tr><td>${item.name}</td><td>${item.average}%</td></tr>`;
    });

    html += `</tbody></table>`;
    outputDiv.innerHTML = html;
}

/**
 * تصدير التقرير (PDF/Excel).
 * @param {string} format - نوع التصدير ('PDF' أو 'Excel').
 */
function exportReport(format) {
    const employeeId = document.getElementById('report-employee-select').value;
    const employee = employees.find(e => String(e.id) === String(employeeId));
    const table = document.getElementById('daily-performance-table');
    const avgScoreElement = document.getElementById('report-avg-score');

    if (!employee || table.rows.length <= 1) {
        alert(translate('alert_no_data_to_export'));
        return;
    }
    
    // إعداد البيانات للتصدير
    const reportData = [];
    for (let i = 1; i < table.rows.length; i++) {
        const row = table.rows[i];
        reportData.push([
            row.cells[0].textContent, // التاريخ
            row.cells[1].textContent // النتيجة الموزونة
        ]);
    }
    
    const reportTitle = document.getElementById('report-title').textContent;
    const avgScoreText = avgScoreElement.textContent;

    if (format === 'PDF') {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({ format: 'a4', orientation: 'p', unit: 'mm' });
        
        // إعداد الخط لدعم اللغة العربية (بافتراض إضافة الخط في نسخة مطورة)
        doc.addFont("ArialUnicodeMS", "normal");
        doc.setFont("ArialUnicodeMS");
        
        // عنوان التقرير (يجب أن يكون RTL)
        doc.setFontSize(16);
        doc.text(reportTitle, doc.internal.pageSize.getWidth() - 10, 20, { align: "right" });
        
        doc.setFontSize(10);
        doc.text(avgScoreText, doc.internal.pageSize.getWidth() - 10, 30, { align: "right" });

        // إضافة الجدول
        doc.autoTable({
            head: [[translate('table_date'), translate('table_weighted_score')]],
            body: reportData,
            startY: 40,
            styles: {
                font: "ArialUnicodeMS", // استخدام الخط الداعم للعربية
                halign: 'right'
            },
            headStyles: { halign: 'right', fillColor: [52, 73, 94] }
        });
        
        doc.save(`${employee.name}_Performance_Report.pdf`);

    } else if (format === 'Excel') {
        const wsData = [
            [reportTitle],
            [avgScoreText],
            [translate('table_date'), translate('table_weighted_score')],
            ...reportData
        ];
        
        const ws = XLSX.utils.aoa_to_sheet(wsData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Performance Data");
        XLSX.writeFile(wb, `${employee.name}_Performance_Report.xlsx`);
    }
}

/**
 * دالة طباعة التقرير بتنسيق A4.
 */
function printReport() {
    const reportOutput = document.getElementById('report-output');
    
    if (reportOutput.style.display === 'none') {
        alert(translate('alert_no_data_to_export'));
        return;
    }

    // إعداد محتوى الطباعة
    const printContent = document.getElementById('report-output').innerHTML;

    // فتح نافذة طباعة
    const printWindow = window.open('', '', 'height=600,width=800');
    
    printWindow.document.write('<html><head><title>Print Report</title>');
    
    // نسخ التنسيقات الأساسية
    printWindow.document.write('<style>');
    printWindow.document.write(`
        @media print {
            @page { size: A4; margin: 15mm; }
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; direction: rtl; }
            .data-table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            .data-table th, .data-table td { padding: 10px; text-align: right; border: 1px solid #ddd; }
            .data-table th { background-color: #34495e; color: white; }
            h3, p { text-align: right; }
            button { display: none; } /* إخفاء الأزرار في الطباعة */
        }
    `);
    printWindow.document.write('</style>');
    printWindow.document.write('</head><body>');
    printWindow.document.write(printContent);
    printWindow.document.write('</body></html>');
    
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
    printWindow.close();
}


// ====================================================================================
// 10. إدارة البيانات (Data Management)
// ====================================================================================

/**
 * تصدير جميع البيانات إلى ملف JSON.
 */
function exportData() {
    const data = {
        departments,
        employees,
        kpis,
        goals,
        performanceRecords
    };
    
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = 'pms_backup.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

/**
 * استيراد البيانات من ملف JSON.
 */
function importData() {
    const fileInput = document.getElementById('import-file');
    const file = fileInput.files[0];

    if (!file) {
        alert(translate('alert_select_file'));
        return;
    }

    if (!confirm(translate('alert_restore_confirm'))) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const importedData = JSON.parse(e.target.result);
            
            // تحقق من وجود الهياكل الأساسية
            if (importedData.departments && importedData.employees) {
                departments = importedData.departments;
                employees = importedData.employees;
                kpis = importedData.kpis || [];
                goals = importedData.goals || [];
                performanceRecords = importedData.performanceRecords || {};
                
                commitChanges();
                alert(translate('alert_data_imported'));
                // تحديث الشاشة الحالية
                const currentScreen = document.querySelector('.screen[style*="block"]')?.id || 'dashboard-screen';
                showScreen(currentScreen); 
            } else {
                alert(translate('alert_invalid_json'));
            }
        } catch (error) {
            alert(translate('alert_invalid_json'));
            console.error(error);
        }
    };
    reader.readAsText(file);
}

/**
 * مسح جميع بيانات التطبيق.
 */
function clearAllData() {
    if (!confirm(translate('alert_clear_confirm'))) return;
    
    localStorage.clear();
    
    // إعادة تعيين المتغيرات في الذاكرة
    departments = [];
    employees = [];
    kpis = [];
    goals = [];
    performanceRecords = {};
    
    alert(translate('alert_data_cleared'));
    // إعادة تحميل لوحة التحكم
    showScreen('dashboard-screen');
}

function runWorkflowTest(){
    // أقسام تجريبية
    const ensureDept = (id, name) => {
        if (!(departments || []).some(d => String(d.id) === String(id))) departments.push({ id, name });
    };
    ensureDept('D1','المبيعات');
    ensureDept('D2','الدعم');

    // موظفون تجريبيون
    const ensureEmp = (id, name, deptId) => {
        const idx = (employees || []).findIndex(e => String(e.id) === String(id));
        if (idx < 0) employees.push({ id, name, deptId });
        else employees[idx] = { id, name, deptId };
    };
    ensureEmp('EMP-TEST-1','محمد تجريبي','D1');
    ensureEmp('EMP-TEST-2','علي تجريبي','D2');

    // مؤشرات تجريبية (وزن متوازن لقسم D1)
    const ensureKpi = (id, name, deptId, weight, type) => {
        const idx = (kpis || []).findIndex(k => String(k.id) === String(id));
        if (idx < 0) kpis.push({ id, name, deptId, weight, type });
        else kpis[idx] = { id, name, deptId, weight, type };
    };
    ensureKpi('K1','مبيعات يومية','D1',50,'positive');
    ensureKpi('K2','شكاوى العملاء','D1',50,'negative');

    // هدف تجريبي على K1
    const today = new Date();
    const end = new Date(); end.setDate(end.getDate()+30);
    goals = goals || [];
    const goalIdx = goals.findIndex(g => String(g.kpiId) === 'K1');
    const goalObj = { kpiId:'K1', target:80, endDate:end.toISOString().slice(0,10), status:'active' };
    if (goalIdx < 0) goals.push(goalObj); else goals[goalIdx] = goalObj;

    // سجل أداء تجريبي لموظف D1 (آخر 7 أيام)
    performanceRecords = performanceRecords || {};
    const formatDate = d => {
        const y=d.getFullYear(), m=String(d.getMonth()+1).padStart(2,'0'), dd=String(d.getDate()).padStart(2,'0');
        return `${y}-${m}-${dd}`;
    };
    const recs=[];
    for(let i=6;i>=0;i--){
        const d=new Date(); d.setDate(today.getDate()-i);
        const sales=70 + Math.round(Math.random()*20); // 70-90
        const complaints=10 + Math.round(Math.random()*10); // 10-20 (أقل أفضل)
        const total = ((sales*0.5) + ((100-complaints)*0.5));
        recs.push({ date:formatDate(d), totalScore: parseFloat(total.toFixed(1)), scores: { K1:sales, K2:complaints } });
    }
    performanceRecords['EMP-TEST-1'] = recs;

    // حفظ وتحديث الواجهة
    commitChanges();
    showScreen('dashboard-screen');
}

// ====================================================================================
// 11. التهيئة الأولية
// ====================================================================================

function updateDepartmentSelects() {
    const role = getCurrentRole();
    const managerDeptId = getManagerDeptId();

    const fillSelect = (selectEl, withAll = false) => {
        if (!selectEl) return;
        selectEl.innerHTML = '';
        if (withAll) {
            const optAll = document.createElement('option');
            optAll.value = 'all';
            optAll.textContent = translate('opt_all');
            selectEl.appendChild(optAll);
        }
        let items = departments || [];
        if (role === 'manager' && managerDeptId) {
            items = items.filter(d => String(d.id) === String(managerDeptId));
        }
        items.forEach(d => {
            const opt = document.createElement('option');
            opt.value = String(d.id);
            opt.textContent = d.name;
            selectEl.appendChild(opt);
        });
        if (role === 'manager' && managerDeptId && selectEl) {
            selectEl.value = String(managerDeptId);
        }
    };

    fillSelect(document.getElementById('records-dept-filter'), true);
    fillSelect(document.getElementById('kpi-dept-id'), false);
    fillSelect(document.getElementById('employee-dept-id'), false);
    fillSelect(document.getElementById('role-dept-id'), false);

    // Sync dependent selects
    if (typeof updateRecordsEmployeeSelect === 'function') {
        updateRecordsEmployeeSelect();
    }
    if (typeof updateRecordEmployeeSelect === 'function') {
        updateRecordEmployeeSelect();
    }
}

function updateKpiWeightInfo() {
    const deptSelect = document.getElementById('kpi-dept-id');
    const weightInput = document.getElementById('kpi-weight');
    const infoEl = document.getElementById('kpi-dept-weight-info');
    const barFill = document.getElementById('kpi-dept-weight-bar-fill');
    const warningEl = document.getElementById('kpi-weight-warning');
    const saveBtn = document.getElementById('save-kpi-button');

    if (!deptSelect || !weightInput || !infoEl || !barFill || !warningEl) return;

    const deptId = deptSelect.value;
    const assigned = (kpis || [])
        .filter(k => String(k.deptId) === String(deptId))
        .reduce((sum, k) => sum + (parseFloat(k.weight) || 0), 0);

    const remaining = Math.max(0, 100 - assigned);
    const editIdEl = document.getElementById('kpi-id-to-edit');
    const newWeight = parseFloat(weightInput.value || '0') || 0;
    const assignedWithoutCurrent = (kpis || [])
        .filter(k => String(k.deptId) === String(deptId) && String(k.id) !== String(editIdEl?.value || ''))
        .reduce((sum, k) => sum + (parseFloat(k.weight) || 0), 0);
    const projected = Math.max(0, Math.min(1000, assignedWithoutCurrent + newWeight));
    try {
        const cur = translate('label_current_total') || 'المجموع الحالي';
        const proj = translate('label_projected_total') || 'المجموع المتوقع';
        infoEl.textContent = `${cur}: ${assigned.toFixed(0)}% — ${proj}: ${projected.toFixed(0)}%`;
    } catch {
        infoEl.textContent = `المجموع الحالي: ${assigned.toFixed(0)}% — المجموع المتوقع: ${projected.toFixed(0)}%`;
    }

    const usedPercent = Math.min(100, assigned);
    barFill.style.width = `${usedPercent}%`;
    barFill.classList.remove('ok','warn','danger');
    if (usedPercent >= 100) barFill.classList.add('ok');
    else if (usedPercent >= 80) barFill.classList.add('warn');
    else barFill.classList.add('danger');

    if (deptId && newWeight > remaining) {
        warningEl.style.display = '';
        try {
            const wt = translate('kpi_weight_exceeds_remaining');
            warningEl.textContent = wt || 'الوزن يتجاوز المتبقي للقسم — لن يتم الحفظ.';
        } catch {
            warningEl.textContent = 'الوزن يتجاوز المتبقي للقسم — لن يتم الحفظ.';
        }
        if (saveBtn) saveBtn.setAttribute('disabled', 'disabled');
    } else {
        if (projected > 100) {
            warningEl.style.display = '';
            try {
                const msg = translate('alert_kpi_weight_exceeds') || 'الوزن الإجمالي سيتجاوز 100%';
                warningEl.textContent = `${msg}. الحالي: ${assigned.toFixed(0)}% — المتوقع: ${projected.toFixed(0)}%`;
            } catch {
                warningEl.textContent = `الوزن الإجمالي سيتجاوز 100%. الحالي: ${assigned.toFixed(0)}% — المتوقع: ${projected.toFixed(0)}%`;
            }
            if (saveBtn) saveBtn.setAttribute('disabled', 'disabled');
        } else {
            warningEl.style.display = '';
            if (assigned.toFixed(0) !== '100') {
                warningEl.textContent = `تنبيه: مجموع أوزان مؤشرات هذا القسم ${assigned.toFixed(0)}% (يُفضّل أن يساوي 100%)`;
            } else {
                warningEl.style.display = 'none';
            }
            if (saveBtn) saveBtn.removeAttribute('disabled');
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    loadDataFromStorage();
    // التهيئة ببيانات تجريبية عند خلو المخزن، لتسهيل المعاينة
    try {
        const hasSample = localStorage.getItem('sample_initialized') === 'true';
        const noDepts = Array.isArray(departments) ? departments.length === 0 : true;
        const noEmps = Array.isArray(employees) ? employees.length === 0 : true;
        const noKpis = Array.isArray(kpis) ? kpis.length === 0 : true;
        const noRecords = performanceRecords && typeof performanceRecords === 'object' ? Object.keys(performanceRecords).length === 0 : true;
        if (!hasSample && noDepts && noEmps && noKpis && noRecords && typeof runWorkflowTest === 'function') {
            runWorkflowTest();
            localStorage.setItem('sample_initialized', 'true');
        }
    } catch (_) {}
    // عرض لوحة التحكم الافتراضية عند التحميل
    showScreen('dashboard-screen');

    // تفعيل القيود حسب الدور
    try {
        const curRole = localStorage.getItem('currentRole');
        if (!curRole) localStorage.setItem('currentRole', 'super_admin');
    } catch {}
    applyRolePermissions();

    // لضمان التحديث الأولي للقوائم المنسدلة
    updateDepartmentSelects();
    updateDashboardEmployeeSelect();
    updateRecordEmployeeSelect();
    updateGoalKpiSelect();
    updateGoalEmployeeSelect();
    updateReportTargetSelect();
    // قيم افتراضية لتواريخ التقارير (آخر 30 يوماً حتى اليوم)
    try {
        const startInput = document.getElementById('report-start-date');
        const endInput = document.getElementById('report-end-date');
        const fmt = (d) => d.toISOString().slice(0,10);
        if (startInput && !startInput.value) {
            const d = new Date(); d.setDate(d.getDate() - 30);
            startInput.value = fmt(d);
        }
        if (endInput && !endInput.value) {
            endInput.value = fmt(new Date());
        }
    } catch (_) {}

    // تحديث معلومات وزن المؤشر حسب القسم
    const kpiDeptSelect = document.getElementById('kpi-dept-id');
    if (kpiDeptSelect) {
        kpiDeptSelect.addEventListener('change', updateKpiWeightInfo);
    }

    // ربط التحديث اللحظي لشريط الوزن مع إدخال الوزن
    const kpiWeightInput = document.getElementById('kpi-weight');
    if (kpiWeightInput) {
        kpiWeightInput.addEventListener('input', updateKpiWeightInfo);
    }

    document.addEventListener('keydown', (e) => {
        const isRolesShortcut = (e.altKey && (e.key === 'r' || e.key === 'R'));
        if (isRolesShortcut) {
            e.preventDefault();
            showScreen('roles-screen');
        }
    });

    // ربط تغيير الفترة بإعادة رسم مخطط الاتجاه العام
    const periodEl = document.getElementById('dashboard-global-period');
    if (periodEl) {
        const savedPeriod = localStorage.getItem('dashboard_period') || periodEl.value;
        periodEl.value = savedPeriod;
        periodEl.addEventListener('change', () => {
            localStorage.setItem('dashboard_period', periodEl.value);
            updateDashboardStats();
        });
    }

    // تحديث أولي للشريط والمعلومة
    updateKpiWeightInfo();

    const empDeptFilter = document.getElementById('employees-dept-filter');
    if (empDeptFilter){
        empDeptFilter.innerHTML = '';
        const optAllEmp = document.createElement('option');
        optAllEmp.value = 'all';
        optAllEmp.textContent = translate('filter_all_dept');
        empDeptFilter.appendChild(optAllEmp);
        departments.forEach(d => empDeptFilter.appendChild(new Option(d.name, String(d.id))));
        empDeptFilter.addEventListener('change', renderEmployees);
    }

    const reportDeptFilter = document.getElementById('report-dept-filter');
    if (reportDeptFilter){
        reportDeptFilter.innerHTML = '';
        const optAllRep = document.createElement('option');
        optAllRep.value = 'all';
        optAllRep.textContent = translate('filter_all_dept');
        reportDeptFilter.appendChild(optAllRep);
        departments.forEach(d => reportDeptFilter.appendChild(new Option(d.name, String(d.id))));
        reportDeptFilter.addEventListener('change', updateReportTargetSelect);
    }

    // تفويض أحداث أزرار تعديل/حذف الأقسام لضمان عملها دائمًا
    const deptTable = document.getElementById('departments-table');
    if (deptTable) {
        deptTable.addEventListener('click', (e) => {
            const btn = e.target.closest('button');
            if (!btn) return;
            const tr = btn.closest('tr');
            const id = tr && tr.querySelector('td') ? (departments.find(d => d.name === tr.querySelector('td').textContent)?.id) : '';
            if (btn.classList.contains('btn-edit')) editDepartment(id);
            else if (btn.classList.contains('btn-delete')) deleteDepartment(id);
        });
    }

    // تهيئة عناصر شاشة الموظفين وربط البحث بتهدئة
    window.employeesTbody = document.querySelector('#employees-table tbody') || null;
    window.employeeSearchInput = document.getElementById('employee-search-input') || null;
    if (window.employeeSearchInput) {
        const debounce = (fn, delay) => {
            let t;
            return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), delay); };
        };
        const handler = debounce(() => { if (typeof renderEmployees === 'function') renderEmployees(); }, 180);
        window.employeeSearchInput.addEventListener('input', handler);
    }
});
// فلاتر لوحة التحكم
window.dashboardDeptFilter = 'all';
window.dashboardSearchQuery = '';
function getFilteredEmployees(){
    const f = window.dashboardDeptFilter || 'all';
    const q = String(window.dashboardSearchQuery || '').trim().toLowerCase();
    const base = (f === 'all') ? employees : employees.filter(emp => String(emp.deptId) === String(f));
    if (!q) return base;
    return base.filter(emp => {
        const nameMatch = String(emp.name || '').toLowerCase().includes(q);
        const dept = departments.find(d => String(d.id) === String(emp.deptId));
        const deptName = String(dept?.name || '').toLowerCase();
        const deptMatch = deptName.includes(q);
        return nameMatch || deptMatch;
    });
}
function initDashboardControls(){
    const sel = document.getElementById('dashboard-dept-filter');
    if (!sel) return;
    sel.innerHTML = '';
    const optAll = document.createElement('option');
    optAll.value = 'all';
    optAll.textContent = translate('filter_all_dept') || 'جميع الأقسام';
    sel.appendChild(optAll);
    departments.forEach(d => sel.appendChild(new Option(d.name, String(d.id))));
    sel.addEventListener('change', () => { window.dashboardDeptFilter = sel.value; updateDashboardStats(); });
    const btn = document.getElementById('dashboard-refresh');
    if (btn) btn.addEventListener('click', () => updateDashboardStats());
    const searchEl = document.getElementById('dashboard-search-input');
    if (searchEl) {
        const savedQ = localStorage.getItem('dashboard_search') || '';
        searchEl.value = savedQ;
        window.dashboardSearchQuery = savedQ;
        searchEl.addEventListener('input', () => { window.dashboardSearchQuery = searchEl.value; localStorage.setItem('dashboard_search', searchEl.value); updateDashboardStats(); });
    }
}

function commitChanges(){
    try {
        const data = { departments, employees, kpis, goals, performanceRecords };
        localStorage.setItem('pms_data', JSON.stringify(data));
    } catch {}
    if (typeof window.updateGoalsStatus === 'function') window.updateGoalsStatus();
    updateDepartmentSelects();
    updateDashboardStats();
    if (typeof window.renderDepartments === 'function') window.renderDepartments();
    if (typeof window.renderEmployees === 'function') window.renderEmployees();
    if (typeof window.renderGoals === 'function') window.renderGoals();
    if (typeof window.renderPerformanceRecords === 'function') window.renderPerformanceRecords();
    if (typeof window.updateReportTargetSelect === 'function') window.updateReportTargetSelect();
}

function renderDepartments(){
    const tbody = document.querySelector('#departments-table tbody');
    if (!tbody) return;
    tbody.innerHTML = '';
    const rows = (departments || []).map(d => {
        const used = (kpis || []).filter(k => String(k.deptId) === String(d.id)).reduce((s,k) => s + (parseFloat(k.weight)||0), 0);
        const remaining = Math.max(0, 100 - used).toFixed(0) + '%';
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${d.name}</td><td>${remaining}</td><td><button class="btn-edit" onclick="editDepartment('${d.id}')">${translate('btn_edit')}</button><button class="btn-delete" onclick="deleteDepartment('${d.id}')">${translate('btn_delete')}</button></td>`;
        return tr;
    });
    rows.forEach(r => tbody.appendChild(r));
}

function editDepartment(id){
    const d = (departments || []).find(x => String(x.id) === String(id));
    if (!d) return;
    const idEl = document.getElementById('dept-id-to-edit');
    const nameEl = document.getElementById('dept-name');
    const cancelBtn = document.getElementById('cancel-dept-edit');
    if (idEl) idEl.value = String(d.id);
    if (nameEl) nameEl.value = d.name || '';
    if (cancelBtn) cancelBtn.style.display = '';
}

function resetDeptForm(){
    const idEl = document.getElementById('dept-id-to-edit');
    const nameEl = document.getElementById('dept-name');
    const cancelBtn = document.getElementById('cancel-dept-edit');
    if (idEl) idEl.value = '';
    if (nameEl) nameEl.value = '';
    if (cancelBtn) cancelBtn.style.display = 'none';
}

function saveDepartment(){
    const idEl = document.getElementById('dept-id-to-edit');
    const nameEl = document.getElementById('dept-name');
    const name = (nameEl && nameEl.value || '').trim();
    if (!name) return;
    const editingId = idEl && idEl.value ? idEl.value : '';
    const dup = (departments || []).some(d => String(d.name).trim() === name && String(d.id) !== String(editingId));
    if (dup) { alert(translate('alert_duplicate_department_name')); return; }
    if (editingId) {
        const idx = (departments || []).findIndex(d => String(d.id) === String(editingId));
        if (idx >= 0) departments[idx].name = name;
        alert(translate('alert_dept_updated'));
    } else {
        const newId = String(((departments || []).reduce((m, d) => Math.max(m, parseInt(d.id,10)||0), 0) || 0) + 1);
        departments.push({ id: newId, name });
        alert(translate('alert_dept_added'));
    }
    renderDepartments();
    commitChanges();
    resetDeptForm();
}

function deleteDepartment(id){
    const hasEmployees = (employees || []).some(e => String(e.deptId) === String(id));
    const hasKpis = (kpis || []).some(k => String(k.deptId) === String(id));
    if (hasEmployees || hasKpis) { alert('لا يمكن حذف القسم لارتباطه بموظفين/مؤشرات.'); return; }
    const idx = (departments || []).findIndex(d => String(d.id) === String(id));
    if (idx >= 0) departments.splice(idx, 1);
    renderDepartments();
    commitChanges();
}

window.renderDepartments = renderDepartments;
window.saveDepartment = saveDepartment;
window.resetDeptForm = resetDeptForm;
window.editDepartment = editDepartment;

function renderEmployees(){
    const tbody = window.employeesTbody || document.querySelector('#employees-table tbody');
    if (!tbody) return;
    const searchEl = window.employeeSearchInput || document.getElementById('employee-search-input');
    const q = String(searchEl?.value || '').trim().toLowerCase();
    tbody.innerHTML = '';

    // بناء خريطة للأقسام لتسريع الوصول
    const deptMap = new Map((departments || []).map(d => [String(d.id), d.name]));

    const items = (employees || []).filter(emp => {
        if (!q) return true;
        const deptName = deptMap.get(String(emp.deptId)) || '';
        const nameMatch = String(emp.name || '').toLowerCase().includes(q);
        const idMatch = String(emp.id || '').toLowerCase().includes(q);
        const deptMatch = String(deptName || '').toLowerCase().includes(q);
        return nameMatch || idMatch || deptMatch;
    });

    // تقليل عمليات DOM باستخدام DocumentFragment
    const frag = document.createDocumentFragment();
    for (const emp of items) {
        const deptName = deptMap.get(String(emp.deptId)) || '';
        const tr = document.createElement('tr');
        tr.dataset.empId = String(emp.id);
        tr.id = `emp-row-${String(emp.id)}`;
        tr.innerHTML = `<td>${emp.name}</td><td>${deptName}</td><td>${emp.id}</td><td><button class="btn-edit" onclick="editEmployee('${emp.id}')">${translate('btn_edit')}</button><button class="btn-delete" onclick="deleteEmployee('${emp.id}')">${translate('btn_delete')}</button></td>`;
        frag.appendChild(tr);
    }
    tbody.appendChild(frag);
}

function scrollToEmployee(empId){
    const tbody = window.employeesTbody || document.querySelector('#employees-table tbody');
    if (!tbody) return;
    const row = tbody.querySelector(`tr[data-emp-id="${String(empId)}"]`);
    if (!row) return;
    row.scrollIntoView({ behavior: 'smooth', block: 'center' });
    const prevBg = row.style.backgroundColor;
    row.style.backgroundColor = '#e6f7e6';
    setTimeout(() => { row.style.backgroundColor = prevBg || ''; }, 1000);
}

function editEmployee(empId){
    const emp = (employees || []).find(e => String(e.id) === String(empId));
    if (!emp) return;
    const idEl = document.getElementById('employee-id-to-edit');
    const nameEl = document.getElementById('employee-name');
    const deptEl = document.getElementById('employee-dept-id');
    const cancelBtn = document.getElementById('cancel-employee-edit');
    if (idEl) idEl.value = String(emp.id);
    if (nameEl) nameEl.value = emp.name || '';
    if (deptEl) deptEl.value = String(emp.deptId || '');
    if (cancelBtn) cancelBtn.style.display = '';
}

function resetEmployeeForm(){
    const idEl = document.getElementById('employee-id-to-edit');
    const nameEl = document.getElementById('employee-name');
    const deptEl = document.getElementById('employee-dept-id');
    const cancelBtn = document.getElementById('cancel-employee-edit');
    const idInputEl = document.getElementById('employee-id-input');
    if (idEl) idEl.value = '';
    if (nameEl) nameEl.value = '';
    if (deptEl) deptEl.value = '';
    if (idInputEl) idInputEl.value = '';
    if (cancelBtn) cancelBtn.style.display = 'none';
}

function saveEmployee(){
    const editIdEl = document.getElementById('employee-id-to-edit');
    const nameEl = document.getElementById('employee-name');
    const deptEl = document.getElementById('employee-dept-id');
    const idInputEl = document.getElementById('employee-id-input');
    const name = (nameEl && nameEl.value || '').trim();
    const deptId = deptEl ? deptEl.value : '';
    let empId = (idInputEl && idInputEl.value || '').trim();
    if (!name || !deptId) return;
    if (!empId) {
        const ids = (employees || []).map(e => String(e.id));
        const maxNum = ids.reduce((m, id) => {
            const n = parseInt(String(id).replace(/\D/g, ''), 10);
            return isNaN(n) ? m : Math.max(m, n);
        }, 0);
        empId = `EMP-${String(maxNum + 1).padStart(4, '0')}`;
        if (idInputEl) idInputEl.value = empId;
    }
    const isEditing = !!(editIdEl && editIdEl.value);
    if (!isEditing){
        const dup = (employees || []).some(e => String(e.id) === String(empId));
        if (dup){ alert(translate('alert_duplicate_employee_id')); return; }
        employees.push({ id: empId, name, deptId });
        alert(translate('alert_emp_added'));
    } else {
        const idx = (employees || []).findIndex(e => String(e.id) === String(editIdEl.value));
        if (idx >= 0){ employees[idx] = { id: empId, name, deptId }; }
        alert(translate('alert_emp_updated'));
    }
    commitChanges();
    renderEmployees();
    scrollToEmployee(empId);
    resetEmployeeForm();
}

function deleteEmployee(empId){
    const idx = (employees || []).findIndex(e => String(e.id) === String(empId));
    if (idx >= 0) employees.splice(idx, 1);
    commitChanges();
}

window.renderEmployees = renderEmployees;
window.saveEmployee = saveEmployee;
window.resetEmployeeForm = resetEmployeeForm;
window.editEmployee = editEmployee;

function renderKPIs(){
    const tbody = document.querySelector('#kpis-table tbody');
    if (!tbody) return;
    const deptMap = new Map((departments || []).map(d => [String(d.id), d.name]));
    const frag = document.createDocumentFragment();
    (kpis || []).forEach(k => {
        const tr = document.createElement('tr');
        tr.setAttribute('data-kpi-id', String(k.id));
        tr.id = `kpi-${String(k.id)}`;
        const deptName = deptMap.get(String(k.deptId)) || '';
        const typeText = (k.type === 'negative') ? translate('kpi_negative') : translate('kpi_positive');
        tr.innerHTML = `<td>${k.name || ''}</td><td>${deptName}</td><td>${(k.weight || 0)}%</td><td>${typeText}</td><td><button class="btn-edit" onclick="editKPI('${k.id}')">${translate('btn_edit')}</button><button class="btn-delete" onclick="deleteKPI('${k.id}')">${translate('btn_delete')}</button></td>`;
        frag.appendChild(tr);
    });
    tbody.innerHTML = '';
    tbody.appendChild(frag);
}

function scrollToKPI(kpiId){
    const row = document.getElementById(`kpi-${String(kpiId)}`);
    if (!row) return;
    row.scrollIntoView({ behavior: 'smooth', block: 'center' });
    const originalBg = row.style.backgroundColor;
    row.style.backgroundColor = '#fffae6';
    setTimeout(() => { row.style.backgroundColor = originalBg; }, 1200);
}

function editKPI(kpiId){
    const k = (kpis || []).find(x => String(x.id) === String(kpiId));
    if (!k) return;
    const idEl = document.getElementById('kpi-id-to-edit');
    const nameEl = document.getElementById('kpi-name');
    const deptEl = document.getElementById('kpi-dept-id');
    const weightEl = document.getElementById('kpi-weight');
    const typeEl = document.getElementById('kpi-type');
    const cancelBtn = document.getElementById('cancel-kpi-edit');
    if (idEl) idEl.value = String(k.id);
    if (nameEl) nameEl.value = k.name || '';
    if (deptEl) deptEl.value = String(k.deptId || '');
    if (weightEl) weightEl.value = String(k.weight || '');
    if (typeEl) typeEl.value = k.type || 'positive';
    if (cancelBtn) cancelBtn.style.display = '';
    updateKpiWeightInfo();
}

function resetKpiForm(){
    const idEl = document.getElementById('kpi-id-to-edit');
    const nameEl = document.getElementById('kpi-name');
    const deptEl = document.getElementById('kpi-dept-id');
    const weightEl = document.getElementById('kpi-weight');
    const typeEl = document.getElementById('kpi-type');
    const cancelBtn = document.getElementById('cancel-kpi-edit');
    if (idEl) idEl.value = '';
    if (nameEl) nameEl.value = '';
    if (deptEl) deptEl.value = '';
    if (weightEl) weightEl.value = '';
    if (typeEl) typeEl.value = 'positive';
    if (cancelBtn) cancelBtn.style.display = 'none';
    updateKpiWeightInfo();
}

function saveKPI(){
    const editIdEl = document.getElementById('kpi-id-to-edit');
    const nameEl = document.getElementById('kpi-name');
    const deptEl = document.getElementById('kpi-dept-id');
    const weightEl = document.getElementById('kpi-weight');
    const typeEl = document.getElementById('kpi-type');
    if (!nameEl || !deptEl || !weightEl || !typeEl) return;

    const name = nameEl.value.trim();
    const deptId = deptEl.value;
    const weight = parseFloat(weightEl.value || '0') || 0;
    const type = typeEl.value || 'positive';
    if (!name || !deptId || weight <= 0 || weight > 100) {
        alert('وزن/اسم/قسم غير صالح');
        return;
    }

    const currentAssigned = (kpis || [])
        .filter(k => String(k.deptId) === String(deptId) && String(k.id) !== String(editIdEl?.value || ''))
        .reduce((sum, k) => sum + (parseFloat(k.weight) || 0), 0);
    const newTotal = currentAssigned + weight;
    if (newTotal > 100) {
        try {
            alert(`${translate('alert_kpi_weight_exceeds')} ${newTotal}%`);
        } catch {
            alert(`تجاوز مجموع أوزان مؤشرات القسم 100%. الإجمالي: ${newTotal}%`);
        }
        return;
    }

    const isEditing = !!(editIdEl && editIdEl.value);
    if (!isEditing){
        const ids = (kpis || []).map(k => String(k.id));
        const maxNum = ids.reduce((m, id) => {
            const n = parseInt(String(id).replace(/\D/g, ''), 10);
            return isNaN(n) ? m : Math.max(m, n);
        }, 0);
        const newId = `KPI-${String(maxNum + 1).padStart(4, '0')}`;
        kpis.push({ id: newId, name, deptId, weight, type });
        const msgAdd = translate('alert_kpi_added') || 'تمت إضافة المؤشر بنجاح!';
        alert(msgAdd);
        commitChanges();
        renderKPIs();
        updateGoalKpiSelect();
        updateKpiWeightInfo();
        scrollToKPI(newId);
        resetKpiForm();
        if (newTotal !== 100) {
            alert(`ملاحظة: مجموع أوزان مؤشرات هذا القسم الآن ${newTotal}% — يُفضّل إكماله إلى 100% لضمان دقة الحسابات.`);
        }
    } else {
        const idx = (kpis || []).findIndex(k => String(k.id) === String(editIdEl.value));
        if (idx >= 0) {
            kpis[idx] = { id: kpis[idx].id, name, deptId, weight, type };
        }
        const msgUpd = translate('alert_kpi_updated') || 'تم تحديث المؤشر بنجاح!';
        alert(msgUpd);
        commitChanges();
        renderKPIs();
        updateGoalKpiSelect();
        updateKpiWeightInfo();
        scrollToKPI(kpis[idx]?.id);
        resetKpiForm();
        const updatedTotal = (kpis || []).filter(k => String(k.deptId) === String(deptId)).reduce((s,k)=> s + (parseFloat(k.weight)||0), 0);
        if (updatedTotal !== 100) {
            alert(`ملاحظة: مجموع أوزان مؤشرات هذا القسم الآن ${updatedTotal}% — يُفضّل إكماله إلى 100% لضمان دقة الحسابات.`);
        }
}
}

function deleteKPI(kpiId){
    const idx = (kpis || []).findIndex(k => String(k.id) === String(kpiId));
    if (idx >= 0) kpis.splice(idx, 1);
    commitChanges();
    renderKPIs();
    updateGoalKpiSelect();
    updateKpiWeightInfo();
}

window.renderKPIs = renderKPIs;
window.saveKPI = saveKPI;
window.resetKpiForm = resetKpiForm;
window.editKPI = editKPI;
window.deleteKPI = deleteKPI;

// ============================
// أهداف زمنية (Goals)
// ============================
function updateGoalKpiSelect(){
    const sel = document.getElementById('goal-kpi-id');
    if (!sel) return;
    sel.innerHTML = '';
    sel.appendChild(new Option(translate('select_kpi_placeholder')||'اختر مؤشر الأداء',''));
    (kpis || []).forEach(k => {
        const opt = document.createElement('option');
        opt.value = String(k.id);
        opt.textContent = k.name || '';
        sel.appendChild(opt);
    });
    updateGoalDeptHint();
    updateGoalEmployeeSelect();
}

function updateGoalEmployeeSelect(){
    const sel = document.getElementById('goal-employee-id');
    if (!sel) return;
    sel.innerHTML = '';
    sel.appendChild(new Option(translate('select_emp_placeholder')||'اختر الموظف',''));
    (employees||[]).forEach(e=> sel.appendChild(new Option(e.name, String(e.id))));
}

 function updateGoalDeptHint(){
    const hint = document.getElementById('goal-dept-hint');
    const kSel = document.getElementById('goal-kpi-id');
    if (!hint || !kSel) return;
    const k = (kpis||[]).find(x=>String(x.id)===String(kSel.value));
    if (!k){ hint.textContent = ''; return; }
    const d = (departments||[]).find(dd=>String(dd.id)===String(k.deptId));
    hint.textContent = d ? `القسم: ${d.name}` : '';
}

function updateGoalLevelVisibility(){
    const levelSel = document.getElementById('goal-level');
    const empLabel = document.querySelector('label[for="goal-employee-id"]');
    const empSel = document.getElementById('goal-employee-id');
    if (!levelSel || !empSel || !empLabel) return;
    const isEmp = levelSel.value === 'employee';
    empLabel.style.display = isEmp ? '' : 'none';
    empSel.style.display = isEmp ? '' : 'none';
}

function updateGoalsStatus(){
    const today = new Date();
    (goals || []).forEach(g => {
        const end = new Date(g.endDate);
        g.status = end < today ? 'expired' : 'active';
    });
}

function renderGoals(){
    updateGoalsStatus();
    const tbody = document.querySelector('#goals-table tbody');
    if (!tbody) return;
    const deptMap = new Map((departments || []).map(d => [String(d.id), d.name]));
    const kpiMap = new Map((kpis || []).map(k => [String(k.id), k]));
    const empMap = new Map((employees || []).map(e => [String(e.id), e.name]));
    const frag = document.createDocumentFragment();
    const q = String(document.getElementById('goals-search-input')?.value||'').trim().toLowerCase();
    const statusFilter = document.getElementById('goals-status-filter')?.value||'all';
    (goals || []).filter(g=>{
        const k = kpiMap.get(String(g.kpiId));
        const name = String(k?.name||'').toLowerCase();
        const matchText = !q || name.includes(q);
        const matchStatus = statusFilter==='all' || g.status===statusFilter;
        return matchText && matchStatus;
    }).forEach(g => {
        const tr = document.createElement('tr');
        tr.id = `goal-${String(g.id)}`;
        const kpi = kpiMap.get(String(g.kpiId));
        const kpiName = kpi ? kpi.name : '';
        const statusText = g.status === 'expired' ? translate('status_expired') : translate('status_active');
        const badgeCls = g.status==='expired'?'badge expired':'badge active';
        const levelLabel = g.targetLevel === 'department' ? 'قسم' : 'موظف';
        const subjectName = g.targetLevel === 'department' ? (deptMap.get(String(g.deptId)) || '') : (empMap.get(String(g.employeeId)) || '');
        const progress = computeKpiProgress(String(g.kpiId), g.targetLevel, String(g.employeeId||''), String(g.deptId||''));
        const pct = isNaN(progress)?0:parseFloat(progress.toFixed(1));
        const barCls = pct>=g.target? 'bar' : (pct>=g.target*0.8? 'bar warn':'bar danger');
        tr.innerHTML = `<td>${levelLabel}</td><td>${subjectName}</td><td>${kpiName}</td><td>${(g.target || 0)}%</td><td>${g.endDate || ''}</td><td><span class="${badgeCls}">${statusText}</span></td><td><div class="progress"><div class="${barCls}" style="width:${pct}%"></div></div><small style="display:block;margin-top:4px;">${pct}%</small></td><td><button class="btn-edit" onclick="editGoal('${g.id}')">${translate('btn_edit')}</button><button class="btn-delete" onclick="deleteGoal('${g.id}')">${translate('btn_delete')}</button></td>`;
        frag.appendChild(tr);
    });
    tbody.innerHTML = '';
    tbody.appendChild(frag);
}

function resetGoalForm(){
    const kpiSel = document.getElementById('goal-kpi-id');
    const empSel = document.getElementById('goal-employee-id');
    const levelSel = document.getElementById('goal-level');
    const targetEl = document.getElementById('goal-target');
    const dateEl = document.getElementById('goal-end-date');
    window.goalEditingId = null;
    const btn = document.querySelector('#goal-form button[onclick="setLongTermGoal()"]');
    if (btn) btn.textContent = translate('btn_set_goal');
    if (kpiSel) kpiSel.value = kpiSel.options.length ? kpiSel.options[0].value : '';
    if (levelSel) levelSel.value = 'employee';
    if (empSel) empSel.value = empSel.options.length ? empSel.options[0].value : '';
    if (targetEl) targetEl.value = '';
    if (dateEl) dateEl.value = '';
    updateGoalLevelVisibility();
}

function editGoal(goalId){
    const g = (goals || []).find(x => String(x.id) === String(goalId));
    if (!g) return;
    const kpiSel = document.getElementById('goal-kpi-id');
    const empSel = document.getElementById('goal-employee-id');
    const levelSel = document.getElementById('goal-level');
    const targetEl = document.getElementById('goal-target');
    const dateEl = document.getElementById('goal-end-date');
    window.goalEditingId = String(g.id);
    if (kpiSel) kpiSel.value = String(g.kpiId || '');
    if (levelSel) levelSel.value = g.targetLevel || 'employee';
    if (empSel) empSel.value = String(g.employeeId || '');
    if (targetEl) targetEl.value = String(g.target || '');
    if (dateEl) dateEl.value = g.endDate || '';
    const btn = document.querySelector('#goal-form button[onclick="setLongTermGoal()"]');
    if (btn) btn.textContent = translate('btn_save');
    updateGoalLevelVisibility();
}

function setLongTermGoal(){
    const kpiSel = document.getElementById('goal-kpi-id');
    const empSel = document.getElementById('goal-employee-id');
    const levelSel = document.getElementById('goal-level');
    const targetEl = document.getElementById('goal-target');
    const dateEl = document.getElementById('goal-end-date');
    if (!kpiSel || !levelSel || !targetEl || !dateEl) return;
    const kpiId = kpiSel.value;
    const level = levelSel.value;
    const employeeId = level==='employee' ? (empSel ? empSel.value : '') : '';
    const target = parseFloat(targetEl.value || '0') || 0;
    const endDate = dateEl.value;
    if (!kpiId || !target || target < 1 || target > 100 || !endDate){
        alert(translate('alert_fill_all_goal_fields'));
        return;
    }
    if (level==='employee' && !employeeId){ alert(translate('alert_fill_all_goal_fields')); return; }
    const todayStr = new Date().toISOString().slice(0,10);
    if (endDate < todayStr){
        alert(translate('alert_start_date_after_end'));
        return;
    }
    const vm = document.getElementById('goal-validation-message');
    const k = (kpis||[]).find(x=>String(x.id)===String(kpiId));
    const deptId = k ? String(k.deptId) : '';
    if (!window.goalEditingId){
        const exists = (goals||[]).some(g=>String(g.kpiId)===String(kpiId) && g.targetLevel===level && (level==='employee' ? String(g.employeeId)===String(employeeId) : String(g.deptId)===String(deptId)) && g.status==='active');
        if (exists){
            if (vm){ vm.textContent = 'يوجد هدف نشط لهذا المؤشر بالفعل'; }
            return;
        }
    }
    const isEditing = !!window.goalEditingId;
    if (!isEditing){
        const ids = (goals || []).map(g => String(g.id));
        const maxNum = ids.reduce((m, id) => {
            const n = parseInt(String(id).replace(/\D/g, ''), 10);
            return isNaN(n) ? m : Math.max(m, n);
        }, 0);
        const newId = `GOAL-${String(maxNum + 1).padStart(4, '0')}`;
        goals.push({ id: newId, kpiId, targetLevel: level, employeeId, deptId, target, endDate, status: 'active' });
        alert(translate('alert_goal_set'));
        commitChanges();
        renderGoals();
        const row = document.getElementById(`goal-${newId}`);
        if (row) { row.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
    } else {
        const idx = (goals || []).findIndex(g => String(g.id) === String(window.goalEditingId));
        if (idx >= 0){
            goals[idx] = { id: goals[idx].id, kpiId, targetLevel: level, employeeId, deptId, target, endDate, status: 'active' };
        }
        alert(translate('alert_goal_set'));
        commitChanges();
        renderGoals();
        const row = document.getElementById(`goal-${goals[idx]?.id}`);
        if (row) { row.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
    }
    resetGoalForm();
}

function deleteGoal(goalId){
    const idx = (goals || []).findIndex(g => String(g.id) === String(goalId));
    if (idx >= 0) goals.splice(idx, 1);
    commitChanges();
    renderGoals();
}

window.updateGoalKpiSelect = updateGoalKpiSelect;
window.updateGoalsStatus = updateGoalsStatus;
window.renderGoals = renderGoals;
window.setLongTermGoal = setLongTermGoal;
window.editGoal = editGoal;
window.deleteGoal = deleteGoal;
window.updateGoalEmployeeSelect = updateGoalEmployeeSelect;
window.updateGoalLevelVisibility = updateGoalLevelVisibility;
window.updateGoalDeptHint = updateGoalDeptHint;

function computeKpiProgress(kpiId, level, employeeId, deptId){
    const k = (kpis||[]).find(x=>String(x.id)===String(kpiId));
    if (!k) return 0;
    if (level==='employee' && employeeId){
        const recs = (performanceRecords[employeeId]||[]);
        const last = recs.length? recs[recs.length-1] : null;
        if (!last || last.scores[k.id]===undefined) return 0;
        return normalizeScore(last.scores[k.id], k.type);
    }
    const deptRef = deptId || k.deptId;
    const deptEmps = (employees||[]).filter(e=>String(e.deptId)===String(deptRef));
    const scores = [];
    deptEmps.forEach(emp=>{
        const recs=(performanceRecords[emp.id]||[]);
        const last=recs.length?recs[recs.length-1]:null;
        if (last && last.scores && last.scores[k.id]!==undefined){
            const val=normalizeScore(last.scores[k.id], k.type);
            scores.push(val);
        }
    });
    if (!scores.length) return 0;
    const avg = scores.reduce((s,v)=>s+v,0)/scores.length;
    return avg;
}

document.addEventListener('DOMContentLoaded',()=>{
    const dateEl=document.getElementById('goal-end-date');
    const hint=document.getElementById('goal-date-hint');
    const targetEl=document.getElementById('goal-target');
    const levelSel=document.getElementById('goal-level');
    const kSel=document.getElementById('goal-kpi-id');
    function updateHint(){
        if (!dateEl || !hint || !dateEl.value){ if(hint) hint.textContent=''; return; }
        const d=new Date(dateEl.value);
        const now=new Date();
        const diff=Math.ceil((d-now)/(1000*60*60*24));
        hint.textContent = diff>0?`متبقٍ ${diff} يومًا`:`انتهى منذ ${Math.abs(diff)} يوم`;
    }
    function setDefaultEnd(){
        if (dateEl && !dateEl.value){ const x=new Date(); x.setDate(x.getDate()+30); dateEl.value=x.toISOString().slice(0,10); }
        updateHint();
    }
    if (dateEl){ dateEl.addEventListener('change', updateHint); setDefaultEnd(); }
    if (targetEl){ targetEl.addEventListener('input',()=>{ const vm=document.getElementById('goal-validation-message'); if (!vm) return; const v=parseFloat(targetEl.value||'0')||0; vm.textContent = (v<1||v>100)?'القيمة يجب أن تكون بين 1 و 100':''; }); }
    const s=document.getElementById('goals-search-input'); const f=document.getElementById('goals-status-filter');
    if (s){ s.addEventListener('input',()=>renderGoals()); }
    if (f){ f.addEventListener('change',()=>renderGoals()); }
    if (levelSel){ levelSel.addEventListener('change', ()=>{ updateGoalLevelVisibility(); updateGoalEmployeeSelect(); }); updateGoalLevelVisibility(); }
    if (kSel){ kSel.addEventListener('change', ()=>{ updateGoalDeptHint(); updateGoalEmployeeSelect(); }); }
    updateGoalDeptHint();
    updateGoalEmployeeSelect();
});

// المؤشرات الحرجة: موظفون خلف الهدف في القسم المختار
// ============================
// تسجيل الأداء (Record Screen)
// ============================
function updateRecordEmployeeSelect(){
    const selectEl = document.getElementById('record-employee-id');
    if (!selectEl) return;
    const role = getCurrentRole();
    const managerDeptId = getManagerDeptId();
    selectEl.innerHTML = '';
    let list = employees || [];
    if (role === 'manager' && managerDeptId){
        list = list.filter(e => String(e.deptId) === String(managerDeptId));
    }
    list.forEach(e => {
        const opt = document.createElement('option');
        opt.value = String(e.id);
        opt.textContent = e.name;
        selectEl.appendChild(opt);
    });
}

function renderRecordKpis(){
    const empSel = document.getElementById('record-employee-id');
    const dateEl = document.getElementById('record-date');
    const container = document.getElementById('record-kpis-container');
    const messageP = document.getElementById('record-kpi-message');
    if (!empSel || !dateEl || !container || !messageP) return;
    const empId = empSel.value;
    const date = dateEl.value;
    if (!empId || !date){
        container.style.display = 'none';
        container.innerHTML = '';
        messageP.style.display = 'block';
        messageP.textContent = translate('msg_select_employee_kpi');
        return;
    }
    const emp = (employees || []).find(e => String(e.id) === String(empId));
    if (!emp){
        container.style.display = 'none';
        messageP.style.display = 'block';
        messageP.textContent = translate('msg_select_employee_kpi');
        return;
    }
    const deptKpis = (kpis || []).filter(k => String(k.deptId) === String(emp.deptId));
    container.innerHTML = '';
    const existingRec = ((performanceRecords || {})[empId] || []).find(r => String(r.date) === String(date));
    deptKpis.forEach(k => {
        const card = document.createElement('div');
        card.className = 'card';
        const valId = `record-kpi-value-${k.id}`;
        const meta = `${translate(k.type === 'negative' ? 'kpi_negative' : 'kpi_positive')} • ${translate('kpi_weight')}: ${(k.weight||0)}%`;
        card.innerHTML = `
            <h4>${k.name}</h4>
            <p style="color:#7f8c8d; font-size:0.9em;">${meta}</p>
            <input type="number" id="${valId}" min="1" max="100" placeholder="1-100" style="width:100%;" />
        `;
        container.appendChild(card);
        const input = card.querySelector(`#${valId}`);
        if (existingRec && existingRec.scores && existingRec.scores[k.id] !== undefined){
            input.value = String(existingRec.scores[k.id]);
        }
    });
    const deptTotal = deptKpis.reduce((sum, k) => sum + (parseFloat(k.weight) || 0), 0);
    const saveBtn = document.querySelector('#performance-record-form button[type="button"]');
    if (deptTotal !== 100) {
        messageP.style.display = 'block';
        messageP.textContent = `لن يتم الحفظ: مجموع أوزان مؤشرات هذا القسم لا يساوي 100%. الإجمالي الحالي: ${deptTotal}% — رجاءً عدّل الأوزان لتساوي 100%.`;
        if (saveBtn) saveBtn.setAttribute('disabled','disabled');
    } else {
        messageP.style.display = 'none';
        if (saveBtn) saveBtn.removeAttribute('disabled');
    }
    container.style.display = 'grid';
}

function savePerformanceRecord(){
    const empSel = document.getElementById('record-employee-id');
    const dateEl = document.getElementById('record-date');
    if (!empSel || !dateEl) return;
    const empId = empSel.value;
    const date = dateEl.value;
    if (!empId || !date){
        alert(translate('alert_fill_all_record_fields'));
        return;
    }
    const emp = (employees || []).find(e => String(e.id) === String(empId));
    if (!emp){
        alert(translate('alert_fill_all_record_fields'));
        return;
    }
    const deptKpis = (kpis || []).filter(k => String(k.deptId) === String(emp.deptId));
    const deptTotal = deptKpis.reduce((sum, k) => sum + (parseFloat(k.weight) || 0), 0);
    if (deptTotal !== 100) {
        try {
            const msg = translate('alert_invalid_weight') || 'لا يمكن إضافة سجل الأداء لأن مجموع أوزان مؤشرات هذا القسم لا يساوي 100%.';
            alert(`${msg} ${deptTotal}%\n• عدّل أوزان مؤشرات القسم في شاشة إدارة المؤشرات لتساوي 100%.`);
        } catch {
            alert(`لا يمكن إضافة سجل الأداء لأن مجموع أوزان مؤشرات هذا القسم لا يساوي 100%. الإجمالي الحالي: ${deptTotal}%\n• عدّل أوزان مؤشرات القسم في شاشة إدارة المؤشرات لتساوي 100%.`);
        }
        return;
    }
    const scores = {};
    for (const k of deptKpis){
        const input = document.getElementById(`record-kpi-value-${k.id}`);
        const val = parseFloat(input && input.value || '0') || 0;
        if (!val || val < 1 || val > 100){
            alert(translate('alert_invalid_record_value'));
            return;
        }
        scores[k.id] = val;
    }
    // احسب النتيجة الموزونة بناءً على نوع المؤشر والوزن
    let total = 0;
    deptKpis.forEach(k => {
        const raw = scores[k.id] || 0;
        const normalized = (k.type === 'negative') ? (100 - raw) : raw;
        const weight = parseFloat(k.weight || '0') || 0;
        total += normalized * (weight / 100);
    });
    const totalScore = parseFloat(total.toFixed(1));

    performanceRecords = performanceRecords || {};
    const arr = performanceRecords[empId] || [];
    const idx = arr.findIndex(r => String(r.date) === String(date));
    if (idx >= 0){
        arr[idx] = { date, totalScore, scores };
    } else {
        arr.push({ date, totalScore, scores });
    }
    performanceRecords[empId] = arr.sort((a,b)=> new Date(a.date) - new Date(b.date));
    alert(translate('alert_record_saved'));
    commitChanges();
}

// ============================
// قائمة سجلات الأداء (Records List)
// ============================
function updateRecordsEmployeeSelect(){
    const deptSel = document.getElementById('records-dept-filter');
    const empSel = document.getElementById('records-employee-select');
    const kpiSel = document.getElementById('records-kpi-filter');
    if (!deptSel || !empSel) return;
    const deptId = deptSel.value;
    empSel.innerHTML = '';
    let list = employees || [];
    if (deptId && deptId !== 'all'){
        list = list.filter(e => String(e.deptId) === String(deptId));
    }
    list.forEach(e => {
        const opt = document.createElement('option');
        opt.value = String(e.id);
        opt.textContent = e.name;
        empSel.appendChild(opt);
    });
    if (kpiSel) {
        kpiSel.innerHTML = '';
        const optAll = document.createElement('option');
        optAll.value = 'all';
        optAll.textContent = translate('filter_kpi') || 'تصفية حسب المؤشر';
        kpiSel.appendChild(optAll);
        const source = (deptId && deptId !== 'all') ? (kpis || []).filter(k => String(k.deptId) === String(deptId)) : (kpis || []);
        source.forEach(k => {
            const opt = document.createElement('option');
            opt.value = String(k.id);
            opt.textContent = k.name || '';
            kpiSel.appendChild(opt);
        });
    }
}

function updateRecordsFilters(){
    // إعادة ملء القوائم عبر دالة عامة، ثم مزامنة الموظفين
    updateDepartmentSelects();
    updateRecordsEmployeeSelect();
    const deptSel = document.getElementById('records-dept-filter');
    const empSel = document.getElementById('records-employee-select');
    const kpiSel = document.getElementById('records-kpi-filter');
    const startEl = document.getElementById('records-start-date');
    const endEl = document.getElementById('records-end-date');
    const searchEl = document.getElementById('records-search-input');
    const exportBtn = document.getElementById('records-export-excel');
    const pageSizeEl = document.getElementById('records-page-size');
    const prevBtn = document.getElementById('records-prev-page');
    const nextBtn = document.getElementById('records-next-page');
    if (deptSel) deptSel.addEventListener('change', () => { updateRecordsEmployeeSelect(); renderPerformanceRecords(); });
    if (empSel) empSel.addEventListener('change', () => renderPerformanceRecords());
    if (kpiSel) kpiSel.addEventListener('change', () => renderPerformanceRecords());
    if (startEl) startEl.addEventListener('change', () => renderPerformanceRecords());
    if (endEl) endEl.addEventListener('change', () => renderPerformanceRecords());
    if (searchEl) {
        const debounce = (fn, delay) => { let t; return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), delay); }; };
        const handler = debounce(() => renderPerformanceRecords(), 180);
        searchEl.addEventListener('input', handler);
    }
    if (exportBtn) exportBtn.addEventListener('click', () => exportRecordsExcel());
    if (pageSizeEl) {
        pageSizeEl.value = String(window.recordsPageSize);
        pageSizeEl.addEventListener('change', () => { window.recordsPageSize = parseInt(pageSizeEl.value || '10', 10); window.recordsPage = 1; try { localStorage.setItem('records_page_size', String(window.recordsPageSize)); } catch {} renderPerformanceRecords(); });
    }
    if (prevBtn) prevBtn.addEventListener('click', () => { window.recordsPage = Math.max(1, (window.recordsPage || 1) - 1); renderPerformanceRecords(); });
    if (nextBtn) nextBtn.addEventListener('click', () => { window.recordsPage = (window.recordsPage || 1) + 1; renderPerformanceRecords(); });
}

function renderPerformanceRecords(){
    const container = document.getElementById('records-table-container');
    const tbody = document.querySelector('#records-table tbody');
    const messageP = document.getElementById('records-message');
    const empSel = document.getElementById('records-employee-select');
    const kpiSel = document.getElementById('records-kpi-filter');
    const startEl = document.getElementById('records-start-date');
    const endEl = document.getElementById('records-end-date');
    const searchEl = document.getElementById('records-search-input');
    if (!container || !tbody || !messageP || !empSel) return;
    const empId = empSel.value;
    if (!empId){
        container.style.display = 'none';
        tbody.innerHTML = '';
        messageP.style.display = 'block';
        messageP.textContent = translate('msg_select_employee_records');
        return;
    }
    let recs = ((performanceRecords || {})[empId] || []).slice();
    const kpiFilter = kpiSel ? kpiSel.value : 'all';
    const startDate = startEl && startEl.value ? new Date(startEl.value) : null;
    const endDate = endEl && endEl.value ? new Date(endEl.value) : null;
    const q = String(searchEl && searchEl.value || '').trim().toLowerCase();
    if (kpiFilter && kpiFilter !== 'all') {
        recs = recs.filter(r => r.scores && r.scores[kpiFilter] !== undefined);
    }
    if (startDate) recs = recs.filter(r => new Date(r.date) >= startDate);
    if (endDate) recs = recs.filter(r => new Date(r.date) <= endDate);
    if (q) recs = recs.filter(r => String(r.date).toLowerCase().includes(q) || String(r.totalScore).toLowerCase().includes(q));
    recs.sort((a,b) => {
        const dir = window.recordsSortDir === 'asc' ? 1 : -1;
        if (window.recordsSortKey === 'score') return (a.totalScore - b.totalScore) * dir;
        return (new Date(a.date) - new Date(b.date)) * dir;
    });
    const countEl = document.getElementById('records-summary-count');
    const avgEl = document.getElementById('records-summary-avg');
    const bestEl = document.getElementById('records-summary-best');
    const worstEl = document.getElementById('records-summary-worst');
    const pageInfoEl = document.getElementById('records-page-info');
    const prevBtn = document.getElementById('records-prev-page');
    const nextBtn = document.getElementById('records-next-page');
    const trendCanvas = document.getElementById('records-trend-chart');
    const totalPages = Math.max(1, Math.ceil(recs.length / Math.max(1, window.recordsPageSize || 10)));
    if (!window.recordsPage || window.recordsPage < 1) window.recordsPage = 1;
    if (window.recordsPage > totalPages) window.recordsPage = totalPages;
    const startIdx = (window.recordsPage - 1) * Math.max(1, window.recordsPageSize || 10);
    const pageRecs = recs.slice(startIdx, startIdx + Math.max(1, window.recordsPageSize || 10));
    if (countEl) countEl.textContent = String(recs.length);
    if (avgEl) {
        const avg = recs.length ? (recs.reduce((s,r)=> s + (parseFloat(r.totalScore)||0), 0) / recs.length) : 0;
        avgEl.textContent = `${avg.toFixed(1)}%`;
    }
    if (bestEl) {
        const best = recs.reduce((m,r)=> (m && m.totalScore >= r.totalScore) ? m : r, null);
        bestEl.textContent = best ? `${best.totalScore.toFixed(1)}% — ${best.date}` : '—';
    }
    if (worstEl) {
        const worst = recs.reduce((m,r)=> (m && m.totalScore <= r.totalScore) ? m : r, null);
        worstEl.textContent = worst ? `${worst.totalScore.toFixed(1)}% — ${worst.date}` : '—';
    }
    if (pageInfoEl) pageInfoEl.textContent = `صفحة ${window.recordsPage} من ${totalPages}`;
    if (prevBtn) prevBtn.disabled = window.recordsPage <= 1;
    if (nextBtn) nextBtn.disabled = window.recordsPage >= totalPages;
    if (trendCanvas && window.Chart) {
        try { if (window.recordsTrendChart) { window.recordsTrendChart.destroy(); window.recordsTrendChart = null; } } catch {}
        const labels = recs.map(r => r.date);
        const data = recs.map(r => r.totalScore);
        const ctx = trendCanvas.getContext('2d');
        window.recordsTrendChart = new Chart(ctx, { type: 'line', data: { labels, datasets: [{ data, borderColor: '#3498db', backgroundColor: 'rgba(52,152,219,0.1)', tension: 0.3, pointRadius: 0 }] }, options: { plugins: { legend: { display: false } }, scales: { x: { display: false }, y: { display: false } }, elements: { line: { borderWidth: 2 } } } });
    }
    tbody.innerHTML = '';
    const frag = document.createDocumentFragment();
    pageRecs.forEach(r => {
        const tr = document.createElement('tr');
        const kpisCount = r.scores ? Object.keys(r.scores).length : 0;
        tr.innerHTML = `
            <td>${r.date}</td>
            <td>${kpisCount}</td>
            <td>${r.totalScore.toFixed(1)}%</td>
            <td>
                <button class="btn-secondary" onclick="toggleRecordDetails('${empId}','${r.date}', this)">${translate('details') || 'تفاصيل'}</button>
                <button class="btn-delete" onclick="deletePerformanceRecord('${empId}','${r.date}')">${translate('btn_delete')}</button>
            </td>
        `;
        frag.appendChild(tr);
        const detailsTr = document.createElement('tr');
        detailsTr.className = 'details-row';
        const td = document.createElement('td');
        td.colSpan = 4;
        const deptMap = new Map((kpis || []).map(k => [String(k.id), k]));
        const lines = Object.keys(r.scores || {}).map(kid => {
            const k = deptMap.get(String(kid));
            const raw = r.scores[kid];
            const normalized = (k && k.type === 'negative') ? (100 - raw) : raw;
            const w = k ? (parseFloat(k.weight)||0) : 0;
            const contrib = (normalized * (w/100)).toFixed(1);
            const n = k ? k.name : kid;
            return `<li>${n} — القيمة: ${raw}% — النوع: ${translate(k && k.type==='negative' ? 'kpi_negative' : 'kpi_positive')} — الوزن: ${w}% — المساهمة: ${contrib}%`;
        });
        td.innerHTML = `<ul style="margin:0; padding-inline-start:18px; color:#7f8c8d;">${lines.join('')}</ul>`;
        detailsTr.appendChild(td);
        detailsTr.style.display = 'none';
        frag.appendChild(detailsTr);
    });
    tbody.appendChild(frag);
    if (!recs.length) {
        container.style.display = 'none';
        messageP.style.display = 'block';
        messageP.textContent = translate('no_records_after_filter') || 'لا توجد سجلات مطابقة للمرشّحات الحالية.';
    } else {
        messageP.style.display = 'none';
        container.style.display = 'block';
    }
}

function deletePerformanceRecord(empId, date){
    const arr = ((performanceRecords || {})[empId] || []);
    const idx = arr.findIndex(r => String(r.date) === String(date));
    if (idx >= 0){
        arr.splice(idx,1);
        performanceRecords[empId] = arr;
        commitChanges();
        renderPerformanceRecords();
    }
}

window.updateRecordEmployeeSelect = updateRecordEmployeeSelect;
window.renderRecordKpis = renderRecordKpis;
window.savePerformanceRecord = savePerformanceRecord;
window.updateRecordsEmployeeSelect = updateRecordsEmployeeSelect;
window.updateRecordsFilters = updateRecordsFilters;
window.renderPerformanceRecords = renderPerformanceRecords;
window.deletePerformanceRecord = deletePerformanceRecord;

function renderCriticalKpis(){
    const list = document.getElementById('critical-kpis-list');
    if (!list) return;
    list.innerHTML = '';
    const activeGoal = goals.find(g => g.status === 'active');
    if (!activeGoal) return;
    const goalKpi = kpis.find(k => k.id === activeGoal.kpiId);
    if (!goalKpi) return;
    getFilteredEmployees().forEach(emp => {
        const records = performanceRecords[emp.id] || [];
        const last = records.length ? records[records.length - 1] : null;
        if (!last || last.scores[activeGoal.kpiId] === undefined) return;
        const lastScore = normalizeScore(last.scores[activeGoal.kpiId], goalKpi.type);
        if (lastScore < activeGoal.target) {
            const li = document.createElement('li');
            li.innerHTML = `<span>${emp.name}</span><span class="status" style="color:#e74c3c">${translate('stat_goal_behind')}</span>`;
            list.appendChild(li);
        }
    });
}
    initDashboardControls();
    updateDashboardStats();
function getGlobalPeriodDays(){
    const el = document.getElementById('dashboard-global-period');
    const v = el ? parseInt(el.value || '60', 10) : 60;
    return isNaN(v) ? 60 : v;
}
function getCurrentRole(){
    try { return localStorage.getItem('currentRole') || 'super_admin'; } catch { return 'super_admin'; }
}
function getManagerDeptId(){
    try { return localStorage.getItem('managerDeptId') || ''; } catch { return ''; }
}
function computeRolePerms(role){
    return {
        manage_departments: role === 'super_admin' || role === 'admin',
        manage_employees: role === 'super_admin' || role === 'admin' || role === 'hr',
        manage_kpis: role === 'super_admin' || role === 'admin' || role === 'manager',
        manage_records: role !== 'viewer',
        manage_goals: role === 'super_admin' || role === 'admin' || role === 'manager',
        manage_data: role === 'super_admin' || role === 'admin',
        view_reports: true,
        view_dashboard: true
    };
}

function getRolePermsOverrides(){
    try {
        const raw = localStorage.getItem('rolePermsOverrides');
        return raw ? JSON.parse(raw) : {};
    } catch { return {}; }
}

function setRolePermsOverrides(role, overrides){
    try {
        const all = getRolePermsOverrides();
        all[role] = overrides;
        localStorage.setItem('rolePermsOverrides', JSON.stringify(all));
    } catch {}
}

function renderRolePerms(role){
    const base = computeRolePerms(role);
    const overrides = getRolePermsOverrides()[role] || {};
    try {
        document.querySelectorAll('#role-perms-container input[type="checkbox"][data-perm]').forEach(cb => {
            const key = cb.getAttribute('data-perm');
            const val = (overrides[key] !== undefined) ? !!overrides[key] : !!base[key];
            cb.checked = !!val;
        });
    } catch {}
}

function applyRolePermissions(){
    const role = getCurrentRole();
    const base = computeRolePerms(role);
    const overrides = getRolePermsOverrides()[role] || {};
    const perms = Object.assign({}, base, overrides);

    const safeDisable = (sel, disabled) => { try { const el = document.querySelector(sel); if (el) el.disabled = !!disabled; } catch {} };
    safeDisable('#save-dept-button', !perms.manage_departments);
    safeDisable('#cancel-dept-edit', !perms.manage_departments);
    safeDisable('#save-employee-button', !perms.manage_employees);
    safeDisable('#cancel-employee-edit', !perms.manage_employees);
    safeDisable('#save-kpi-button', !perms.manage_kpis);
    safeDisable('#cancel-kpi-edit', !perms.manage_kpis);
    const saveRecordBtn = document.querySelector('#record-screen button[onclick="savePerformanceRecord()"]');
    if (saveRecordBtn) saveRecordBtn.disabled = !perms.manage_records;
    safeDisable('#btn_clear_data', !perms.manage_data);

    const canManageRoles = true;
    try {
      document.querySelectorAll('#roles-form input, #roles-form select, #roles-form button').forEach(el => { el.disabled = !canManageRoles; });
    } catch {}
    try {
      document.querySelectorAll('#admin-roles-management input, #admin-roles-management select, #admin-roles-management button').forEach(el => { el.disabled = !canManageRoles; });
    } catch {}
}

function initRolesPage(){
    const roleSel = document.getElementById('role-select');
    const deptSel = document.getElementById('role-dept-id');
    const deptLabel = document.getElementById('role-dept-label');
    if (!roleSel) return;
    const current = getCurrentRole();
    roleSel.value = current || 'viewer';
    if (deptSel) {
        updateDepartmentSelects();
        const savedManagerDept = getManagerDeptId();
        if (savedManagerDept) deptSel.value = String(savedManagerDept);
    }
    const updateDeptVisibility = () => {
        const val = roleSel.value;
        if (deptLabel && deptSel){
            const show = val === 'manager';
            deptLabel.style.display = show ? '' : 'none';
            deptSel.style.display = show ? '' : 'none';
        }
    };
    roleSel.addEventListener('change', updateDeptVisibility);
    updateDeptVisibility();
    renderRolePerms(roleSel.value);
}

function handleRoleSelectChange(){
    const roleSel = document.getElementById('role-select');
    const deptSel = document.getElementById('role-dept-id');
    const deptLabel = document.getElementById('role-dept-label');
    if (!roleSel) return;
    const role = roleSel.value;
    if (deptLabel && deptSel){
        const show = role === 'manager';
        deptLabel.style.display = show ? '' : 'none';
        deptSel.style.display = show ? '' : 'none';
    }
    renderRolePerms(role);
}

function saveRoleSettings(){
    const roleSel = document.getElementById('role-select');
    const deptSel = document.getElementById('role-dept-id');
    const role = roleSel ? roleSel.value : 'viewer';
    try { localStorage.setItem('currentRole', role); } catch {}
    if (role === 'manager' && deptSel && deptSel.value){
        try { localStorage.setItem('managerDeptId', String(deptSel.value)); } catch {}
    } else {
        try { localStorage.removeItem('managerDeptId'); } catch {}
    }
    try {
        const overrides = {};
        document.querySelectorAll('#role-perms-container input[type="checkbox"][data-perm]').forEach(cb => {
            const key = cb.getAttribute('data-perm');
            overrides[key] = !!cb.checked;
        });
        setRolePermsOverrides(role, overrides);
    } catch {}

    applyRolePermissions();
    try {
        const note = document.querySelector('#roles-form span[data-i18n="roles_note"]');
        if (note) note.textContent = translate('roles_saved');
    } catch {}
}

function initAdminRolesPage(){
}

window.initRolesPage = initRolesPage;
window.saveRoleSettings = saveRoleSettings;
window.initAdminRolesPage = initAdminRolesPage;
window.handleRoleSelectChange = handleRoleSelectChange;
window.recordsSortKey = 'date';
window.recordsSortDir = 'asc';
function toggleRecordsSort(key){
    window.recordsSortKey = key;
    window.recordsSortDir = (window.recordsSortDir === 'asc') ? 'desc' : 'asc';
    renderPerformanceRecords();
}
window.toggleRecordsSort = toggleRecordsSort;
function toggleRecordDetails(empId, date, btn){
    const tbody = document.querySelector('#records-table tbody');
    const rows = Array.from(tbody.querySelectorAll('tr'));
    for (let i=0; i<rows.length; i++){
        const r = rows[i];
        const next = rows[i+1];
        if (!next || !next.classList.contains('details-row')) continue;
        const dateCell = r.querySelector('td');
        if (dateCell && String(dateCell.textContent)===String(date)){
            const shown = next.style.display !== 'none';
            next.style.display = shown ? 'none' : '';
            break;
        }
    }
}
window.toggleRecordDetails = toggleRecordDetails;
window.recordsPage = 1;
window.recordsPageSize = parseInt(localStorage.getItem('records_page_size') || '10', 10);
window.recordsTrendChart = null;
function exportRecordsExcel(){
    const empSel = document.getElementById('records-employee-select');
    if (!empSel || !empSel.value) return;
    let recs = ((performanceRecords || {})[empSel.value] || []).slice();
    const kpiSel = document.getElementById('records-kpi-filter');
    const startEl = document.getElementById('records-start-date');
    const endEl = document.getElementById('records-end-date');
    const searchEl = document.getElementById('records-search-input');
    const kpiFilter = kpiSel ? kpiSel.value : 'all';
    const startDate = startEl && startEl.value ? new Date(startEl.value) : null;
    const endDate = endEl && endEl.value ? new Date(endEl.value) : null;
    const q = String(searchEl && searchEl.value || '').trim().toLowerCase();
    if (kpiFilter && kpiFilter !== 'all') recs = recs.filter(r => r.scores && r.scores[kpiFilter] !== undefined);
    if (startDate) recs = recs.filter(r => new Date(r.date) >= startDate);
    if (endDate) recs = recs.filter(r => new Date(r.date) <= endDate);
    if (q) recs = recs.filter(r => String(r.date).toLowerCase().includes(q) || String(r.totalScore).toLowerCase().includes(q));
    if (!recs.length) { alert(translate('alert_no_data_to_export')); return; }
    const kpiMap = new Map((kpis || []).map(k => [String(k.id), k.name || String(k.id)]));
    const kpiSet = new Set();
    recs.forEach(r => Object.keys(r.scores || {}).forEach(kid => kpiSet.add(kid)));
    const kpiCols = Array.from(kpiSet).map(kid => kpiMap.get(String(kid)) || String(kid));
    const header = ['date','kpis_count','total_score', ...kpiCols];
    const rows = recs.map(r => {
        const base = { date: r.date, kpis_count: Object.keys(r.scores||{}).length, total_score: r.totalScore };
        kpiCols.forEach(col => {
            const id = Array.from(kpiSet).find(kid => (kpiMap.get(String(kid)) || String(kid)) === col);
            base[col] = (r.scores && id && r.scores[id] !== undefined) ? r.scores[id] : '';
        });
        return base;
    });
    const ws = XLSX.utils.json_to_sheet(rows, { header });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Records');
    XLSX.writeFile(wb, `records_${empSel.value}.xlsx`);
}
window.exportRecordsExcel = exportRecordsExcel;
function grantFullAccess(){
    try { localStorage.setItem('currentRole', 'super_admin'); localStorage.removeItem('rolePermsOverrides'); localStorage.removeItem('managerDeptId'); } catch {}
    applyRolePermissions();
    alert('تم منح صلاحيات كاملة مؤقتًا لهذا الجهاز.');
}
function resetAccess(){
    try { localStorage.setItem('currentRole', 'viewer'); localStorage.removeItem('rolePermsOverrides'); localStorage.removeItem('managerDeptId'); } catch {}
    applyRolePermissions();
    alert('تمت إعادة تعيين الصلاحيات إلى مشاهد.');
}
window.grantFullAccess = grantFullAccess;
window.resetAccess = resetAccess;
