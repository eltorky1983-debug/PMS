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

function tenantIdLocal(){ try { return localStorage.getItem('TENANT_ID') || ''; } catch { return ''; } }
function tenantKey(key){
    const tid = tenantIdLocal();
    if (tid) return `${key}__${tid}`;
    try {
        const u = (window.auth && window.auth.currentUser) || {};
        const tag = (u.email||u.uid||'').toLowerCase();
        return tag ? `${key}__user_${tag}` : key;
    } catch { return key; }
}
function tenantGet(key){ try { return localStorage.getItem(tenantKey(key)); } catch { return null; } }
function tenantSet(key, val){ try { localStorage.setItem(tenantKey(key), val); } catch {} }
function tenantRemove(key){ try { localStorage.removeItem(tenantKey(key)); } catch {} }
window.tenantGet = tenantGet; window.tenantSet = tenantSet; window.tenantRemove = tenantRemove;
function tenantKeyVariants(key){
    const keys = [];
    try { keys.push(tenantKey(key)); } catch {}
    try {
        const u = (window.auth && window.auth.currentUser) || {};
        const tag = (u.email||u.uid||'').toLowerCase();
        if (tag) keys.push(`${key}__user_${tag}`);
    } catch {}
    keys.push(key);
    return Array.from(new Set(keys));
}
function tenantGetFallback(key){
    const keys = tenantKeyVariants(key);
    for (let i=0;i<keys.length;i++){
        try { const v = localStorage.getItem(keys[i]); if (v) return v; } catch {}
    }
    return null;
}
function tenantMigrateKeyToTenant(key){
    try {
        const tid = tenantIdLocal();
        if (!tid) return;
        const main = `${key}__${tid}`;
        const u = (window.auth && window.auth.currentUser) || {};
        const tag = (u.email||u.uid||'').toLowerCase();
        const fallback = tag ? `${key}__user_${tag}` : '';
        const raw = fallback ? localStorage.getItem(fallback) : null;
        if (raw && !localStorage.getItem(main)) { localStorage.setItem(main, raw); try { localStorage.removeItem(fallback); } catch {} }
    } catch {}
}

function resetInMemoryData(){
    try {
        departments = [];
        employees = [];
        kpis = [];
        goals = [];
        performanceRecords = {};
    } catch {}
}

function loadDataFromStorage(){
    try {
        const raw = tenantGetFallback('pms_data');
        tenantMigrateKeyToTenant('pms_data');
        resetInMemoryData();
        if (!raw) { try { if (typeof updateDepartmentSelects === 'function') updateDepartmentSelects(); if (typeof updateDashboardStats === 'function') updateDashboardStats(); if (typeof renderDepartments === 'function') renderDepartments(); if (typeof renderEmployees === 'function') renderEmployees(); if (typeof renderGoals === 'function') renderGoals(); if (typeof renderPerformanceRecords === 'function') renderPerformanceRecords(); if (typeof updateReportTargetSelect === 'function') updateReportTargetSelect(); } catch {} return; }
        const data = JSON.parse(raw);
        if (data && Array.isArray(data.departments)) departments = data.departments;
        if (data && Array.isArray(data.employees)) employees = data.employees;
        if (data && Array.isArray(data.kpis)) kpis = data.kpis;
        if (data && Array.isArray(data.goals)) goals = data.goals;
        if (data && typeof data.performanceRecords === 'object') performanceRecords = data.performanceRecords;
        try { if (typeof updateDepartmentSelects === 'function') updateDepartmentSelects(); if (typeof updateDashboardStats === 'function') updateDashboardStats(); if (typeof renderDepartments === 'function') renderDepartments(); if (typeof renderEmployees === 'function') renderEmployees(); if (typeof renderGoals === 'function') renderGoals(); if (typeof renderPerformanceRecords === 'function') renderPerformanceRecords(); if (typeof updateReportTargetSelect === 'function') updateReportTargetSelect(); } catch {}
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
    const valueLabels = {
        id:'valueLabels',
        afterDatasetsDraw(chart){
            const {ctx} = chart;
            const ds = chart.data.datasets[0].data;
            const meta = chart.getDatasetMeta(0);
            const isDark = document.body.classList.contains('theme-dark');
            const fill = isDark ? '#ffffff' : '#2c3e50';
            const stroke = isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.45)';
            ctx.save();
            ctx.textAlign = 'center';
            ctx.textBaseline = 'bottom';
            ctx.font = '13px Segoe UI';
            meta.data.forEach((bar,i)=>{
                const p = bar.tooltipPosition();
                const v = ds[i];
                const text = `${Number(v).toFixed(1)}%`;
                ctx.strokeStyle = stroke;
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.strokeText(text, p.x, p.y - 10);
                ctx.fillStyle = fill;
                ctx.fillText(text, p.x, p.y - 10);
            });
            ctx.restore();
        }
    };
    deptChart = new Chart(ctx, {
        type: 'bar',
        data: data,
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: false,
            scales: {
                y: {
                    beginAtZero: true,
                    max: 100,
                    title: { display: true, text: 'متوسط الأداء (%)' }
                }
            },
            plugins: {
                legend: { display: false },
                tooltip: { enabled: false }
            },
            onClick: (evt, elements) => {
                if (!elements || !elements.length) return;
                const idx = elements[0].index;
                const label = data.labels && typeof idx === 'number' ? data.labels[idx] : '';
                if (label) {
                    if (typeof openDepartmentRecordsByName === 'function') openDepartmentRecordsByName(label);
                }
            },
            onHover: (evt, elements) => { try { evt && evt.native && (evt.native.target.style.cursor = (elements && elements.length) ? 'pointer' : 'default'); } catch(_){} }
        },
        plugins:[valueLabels]
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
                        title: (items) => items[0] && items[0].label ? items[0].label : '',
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
    showReportLoading(true);
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
        showReportLoading(false);
        return;
    }
    
    const startDate = parseDateSafe(startDateStr);
    const endDate = parseDateSafe(endDateStr);

    if (startDate > endDate) {
        alert(translate('alert_start_date_after_end'));
        showReportLoading(false);
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
        showReportLoading(false);
        return;
    }

    let totalScoreSum = 0;
    const goodTh = parseInt(tenantGet('threshold_good')||'85',10);
    const warnTh = parseInt(tenantGet('threshold_warn')||'60',10);
    targetRecords.forEach(rec => {
        const row = tableBody.insertRow();
        const score = rec.totalScore.toFixed(1);
        const cls = (rec.totalScore >= goodTh) ? 'score-good' : (rec.totalScore >= warnTh) ? 'score-warn' : 'score-bad';
        totalScoreSum += rec.totalScore;
        row.innerHTML = `<td>${rec.date}</td><td class="${cls}">${score}%</td>`;
    });

    const avgScore = totalScoreSum / targetRecords.length;
    const reportTitle = document.getElementById('report-title');
    const reportAvgScore = document.getElementById('report-avg-score');
    
    reportTitle.textContent = `${translate('report_title_emp')} - ${employee ? employee.name : employeeId}`;
    reportAvgScore.textContent = `${translate('stat_avg_period')} ${startDateStr} ${translate('to')} ${endDateStr}: ${avgScore.toFixed(1)}%`;
    
    reportOutput.style.display = 'block';
    try {
        const sc = document.getElementById('report-summary-cards');
        const cEl = document.getElementById('rsc-emp-count');
        const aEl = document.getElementById('rsc-emp-avg');
        const pEl = document.getElementById('rsc-emp-period');
        if (sc && cEl && aEl && pEl) {
            sc.style.display = '';
            cEl.textContent = String(targetRecords.length);
            aEl.textContent = `${avgScore.toFixed(1)}%`;
            pEl.textContent = `${startDateStr} — ${endDateStr}`;
        }
    } catch {}
    showReportLoading(false);
    const denseToggle = document.getElementById('report-dense-toggle');
    const dailyTable = document.getElementById('daily-performance-table');
    try {
        const savedDense = (tenantGet('reportDense') || '') === '1';
        if (denseToggle) denseToggle.checked = savedDense;
        if (dailyTable && savedDense) dailyTable.classList.add('dense'); else if (dailyTable) dailyTable.classList.remove('dense');
    } catch {}
    if (denseToggle && dailyTable) denseToggle.addEventListener('change', () => {
        if (denseToggle.checked) { dailyTable.classList.add('dense'); tenantSet('reportDense','1'); }
        else { dailyTable.classList.remove('dense'); tenantSet('reportDense','0'); }
    });
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

function exportEmployeeReportCSV(){
    try {
        const table = document.getElementById('daily-performance-table');
        if (!table || table.rows.length <= 1) { alert(translate('alert_no_data_to_export')); return; }
        const header = [translate('table_date'), translate('table_weighted_score')];
        const rows = [];
        for (let i=1; i<table.rows.length; i++) {
            const r = table.rows[i];
            rows.push([r.cells[0].textContent, r.cells[1].textContent]);
        }
        const csv = [header.join(','), ...rows.map(x=> x.join(','))].join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = 'employee_report.csv'; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
    } catch {}
}
window.exportEmployeeReportCSV = exportEmployeeReportCSV;

/**
 * دالة طباعة التقرير بتنسيق A4.
 */
function printReport() {
    const reportOutput = document.getElementById('report-output');
    
    if (reportOutput.style.display === 'none') {
        alert(translate('alert_no_data_to_export'));
        return;
    }
    const titleEl = document.getElementById('report-title');
    const avgEl = document.getElementById('report-avg-score');
    const titleText = `${titleEl ? titleEl.textContent : ''}${avgEl && avgEl.textContent ? ' — ' + avgEl.textContent : ''}`.trim();
    printTable('daily-performance-table', titleText || 'تقرير أداء الموظف');
}

function showReportLoading(show){
    try {
        let el = document.getElementById('report-loading');
        if (!el) {
            const out = document.getElementById('report-output');
            el = document.createElement('div'); el.id = 'report-loading'; el.className = 'loader'; el.innerHTML = '<span>جارٍ التوليد...</span><span class="dot"></span><span class="dot"></span><span class="dot"></span>'; out && out.parentNode && out.parentNode.insertBefore(el, out);
        }
        el.style.display = show ? '' : 'none';
    } catch {}
}


// ====================================================================================
// 10. إدارة البيانات (Data Management)
// ====================================================================================

/**
 * تصدير جميع البيانات إلى ملف JSON.
 */
function exportData() {
    try {
        const tid = (localStorage.getItem('TENANT_ID')||'').trim();
        const org = String(getOrgName()||'').trim();
        const raw = tenantGet('pms_data');
        const data = raw ? JSON.parse(raw) : { departments, employees, kpis, goals, performanceRecords };
        const payload = { tenantId: tid, orgName: org, exportedAt: new Date().toISOString(), data };
        const json = JSON.stringify(payload, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const safeOrg = org ? org.replace(/[^\w\u0621-\u064A]+/g,'_') : 'tenant';
        const ts = new Date().toISOString().replace(/[:.]/g,'-');
        const a = document.createElement('a');
        a.href = url;
        a.download = `pms_backup_${safeOrg || tid || 'tenant'}_${ts}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        try { tenantSet('pms_backup_manual', json); } catch {}
    } catch {}
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
            const payload = JSON.parse(e.target.result);
            const importedData = (payload && payload.data && (payload.data.departments||payload.data.employees)) ? payload.data : payload;
            if (importedData && Array.isArray(importedData.departments) && Array.isArray(importedData.employees)) {
                departments = importedData.departments || [];
                employees = importedData.employees || [];
                kpis = importedData.kpis || [];
                goals = importedData.goals || [];
                performanceRecords = importedData.performanceRecords || {};
                commitChanges();
                try { tenantSet('pms_backup_manual', JSON.stringify({ importedAt: new Date().toISOString(), data: importedData })); } catch {}
                alert(translate('alert_data_imported'));
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
async function clearAllData() {
    if (!confirm(translate('alert_clear_confirm'))) return;
    try {
        const tidLocal = localStorage.getItem('TENANT_ID')||'';
        const keys = ['pms_data','pms_backup_auto','sample_initialized'];
        keys.forEach(k => { try { localStorage.removeItem(tidLocal? `${k}__${tidLocal}` : k); } catch {} });
    } catch {}
    // إعادة تعيين المتغيرات في الذاكرة
    departments = [];
    employees = [];
    kpis = [];
    goals = [];
    performanceRecords = {};

    try {
        const tid = await getTenantIdCurrent();
        if (tid && window.db) {
            try {
                const qs = await window.db.collection('tenants').doc(String(tid)).collection('role_overrides').limit(500).get();
                const batch = window.db.batch();
                qs.docs.forEach(d => batch.delete(d.ref));
                await batch.commit();
            } catch {}
            try {
                const qsUsers = await window.db.collection('users').where('tenantId','==',String(tid)).limit(500).get();
                const batch2 = window.db.batch();
                qsUsers.docs.forEach(d => {
                    const v = d.data()||{};
                    const keepAdmin = !!v.isTenantOwner || (Array.isArray(v.roles) && (v.roles.includes('super_admin')));
                    if (!keepAdmin) batch2.set(d.ref, { roles: ['viewer'], managerDeptId: '' }, { merge: true });
                });
                await batch2.commit();
            } catch {}
            try { await window.db.collection('tenants').doc(String(tid)).collection('audit_logs').add({ type:'clear_all_data_and_roles', actor_uid:(window.auth&&window.auth.currentUser||{}).uid||'', actor_email:(window.auth&&window.auth.currentUser||{}).email||'', ts:Date.now() }); } catch {}
        }
    } catch {}

    try { showBanner('تم مسح جميع البيانات والصلاحيات للدور', 'ok'); } catch {}
    alert(translate('alert_data_cleared'));
    applyRolePermissions();
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
        if (isManagerScoped() && managerDeptId) {
            items = items.filter(d => String(d.id) === String(managerDeptId));
        }
        items.forEach(d => {
            const opt = document.createElement('option');
            opt.value = String(d.id);
            opt.textContent = d.name;
            selectEl.appendChild(opt);
        });
        if (isManagerScoped() && managerDeptId && selectEl) {
            selectEl.value = String(managerDeptId);
        }
    };

    fillSelect(document.getElementById('records-dept-filter'), true);
    fillSelect(document.getElementById('records-tab-dept'), true);
    fillSelect(document.getElementById('kpi-dept-id'), false);
    fillSelect(document.getElementById('employee-dept-id'), false);
    fillSelect(document.getElementById('role-dept-id'), false);
    fillSelect(document.getElementById('admin-invite-dept'), false);
    fillSelect(document.getElementById('admin-user-dept'), false);
    fillSelect(document.getElementById('heatmap-dept-filter'), true);
    fillSelect(document.getElementById('correlation-dept-filter'), true);

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
        const hasSample = tenantGet('sample_initialized') === 'true';
        const noDepts = Array.isArray(departments) ? departments.length === 0 : true;
        const noEmps = Array.isArray(employees) ? employees.length === 0 : true;
        const noKpis = Array.isArray(kpis) ? kpis.length === 0 : true;
        const noRecords = performanceRecords && typeof performanceRecords === 'object' ? Object.keys(performanceRecords).length === 0 : true;
        if (!hasSample && noDepts && noEmps && noKpis && noRecords && typeof runWorkflowTest === 'function') {
            runWorkflowTest();
            tenantSet('sample_initialized', 'true');
        }
    } catch (_) {}
    // عرض لوحة التحكم الافتراضية عند التحميل
    showScreen('dashboard-screen');

    // تفعيل القيود حسب الدور
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

    // ربط تغيير الفترة بإعادة رسم مخطط الاتجاه العام
    const periodEl = document.getElementById('dashboard-global-period');
    if (periodEl) {
        const savedPeriod = tenantGet('dashboard_period') || periodEl.value;
        periodEl.value = savedPeriod;
        periodEl.addEventListener('change', () => {
            tenantSet('dashboard_period', periodEl.value);
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
        const savedQ = tenantGet('dashboard_search') || '';
        searchEl.value = savedQ;
        window.dashboardSearchQuery = savedQ;
        searchEl.addEventListener('input', () => { window.dashboardSearchQuery = searchEl.value; tenantSet('dashboard_search', searchEl.value); updateDashboardStats(); });
    }
    const clearBtn = document.getElementById('dashboard-clear-search');
    if (clearBtn && searchEl) clearBtn.addEventListener('click', () => { searchEl.value=''; window.dashboardSearchQuery=''; try{ tenantRemove('dashboard_search'); }catch{} updateDashboardStats(); });
    const resetBtn = document.getElementById('dashboard-reset-filters');
    if (resetBtn) resetBtn.addEventListener('click', () => { try { sel.value='all'; } catch{} window.dashboardDeptFilter='all'; if (searchEl) { searchEl.value=''; window.dashboardSearchQuery=''; try{ tenantRemove('dashboard_search'); }catch{} } updateDashboardStats(); });
}

function commitChanges(){
    try {
        const data = { departments, employees, kpis, goals, performanceRecords };
        tenantSet('pms_data', JSON.stringify(data));
        const safe = String(localStorage.getItem('safe_mode') || '').toLowerCase() === 'true';
        if (safe) {
            try {
                const ts = new Date().toISOString();
                const backup = { ts, data };
                tenantSet('pms_backup_auto', JSON.stringify(backup));
            } catch {}
        }
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

function runDiagnostics(){
    const issues = [];
    const deptsMap = new Map((departments || []).map(d => [String(d.id), d]));
    const kpiById = new Map((kpis || []).map(k => [String(k.id), k]));
    (departments || []).forEach(d => {
        const used = (kpis || []).filter(k => String(k.deptId) === String(d.id)).reduce((s,k)=> s + (parseFloat(k.weight)||0), 0);
        if (used > 100.0001) issues.push({ type:'error', msg:`وزن مؤشرات قسم ${d.name} يتجاوز 100% (${used.toFixed(1)}%)` });
        else if (used < 99.9999) issues.push({ type:'warn', msg:`وزن مؤشرات قسم ${d.name} أقل من 100% (${used.toFixed(1)}%)` });
    });
    (employees || []).forEach(e => {
        if (!deptsMap.get(String(e.deptId))) issues.push({ type:'error', msg:`موظف ${e.name} مرتبط بقسم غير موجود (${e.deptId})` });
    });
    (kpis || []).forEach(k => {
        if (!deptsMap.get(String(k.deptId))) issues.push({ type:'error', msg:`مؤشر ${k.name} مرتبط بقسم غير موجود (${k.deptId})` });
        const w = parseFloat(k.weight)||0; if (w<1 || w>100) issues.push({ type:'warn', msg:`وزن المؤشر ${k.name} خارج النطاق 1-100 (${w})` });
    });
    (goals || []).forEach(g => {
        if (!kpiById.get(String(g.kpiId))) issues.push({ type:'error', msg:`هدف مرتبط بمؤشر غير موجود (${g.kpiId})` });
        if (g.employeeId && !(employees || []).some(e => String(e.id)===String(g.employeeId))) issues.push({ type:'warn', msg:`هدف مرتبط بموظف غير موجود (${g.employeeId})` });
        if (g.endDate && isNaN(new Date(g.endDate).getTime())) issues.push({ type:'warn', msg:`تاريخ انتهاء الهدف غير صالح (${g.endDate})` });
    });
    Object.keys(performanceRecords || {}).forEach(empId => {
        const emp = (employees || []).find(e => String(e.id)===String(empId));
        if (!emp) issues.push({ type:'error', msg:`سجلات أداء لرقم موظف غير موجود (${empId})` });
        const recs = (performanceRecords || {})[empId] || [];
        recs.forEach(r => {
            const dOk = r.date && !isNaN(new Date(r.date).getTime());
            if (!dOk) issues.push({ type:'warn', msg:`تاريخ سجل غير صالح (${r.date}) لموظف ${empId}` });
            const scores = r.scores || {};
            let total = 0; Object.keys(scores).forEach(kid => {
                const k = kpiById.get(String(kid));
                if (!k) return;
                const raw = parseFloat(scores[kid])||0;
                const normalized = (k.type==='negative') ? (100-raw) : raw;
                total += normalized * ((parseFloat(k.weight)||0)/100);
            });
            const expected = parseFloat(total.toFixed(1));
            const actual = parseFloat(r.totalScore)||0;
            if (Math.abs(expected - actual) > 1.5) issues.push({ type:'warn', msg:`انحراف نتيجة يوم ${r.date} لموظف ${empId}: محسوب ${expected}% مقابل مسجل ${actual}%` });
        });
    });
    const summaryEl = document.getElementById('diagnostics-summary');
    const listEl = document.getElementById('diagnostics-issues');
    if (summaryEl) summaryEl.textContent = `عدد الأخطاء: ${issues.filter(i=>i.type==='error').length} — التحذيرات: ${issues.filter(i=>i.type==='warn').length}`;
    if (listEl) {
        listEl.innerHTML = '';
        issues.forEach(i => { const li = document.createElement('li'); li.textContent = `${i.type==='error'?'خطأ':'تحذير'} — ${i.msg}`; listEl.appendChild(li); });
    }
}
window.runDiagnostics = runDiagnostics;

document.addEventListener('DOMContentLoaded', () => {
    const btnDiag = document.getElementById('run-diagnostics');
    if (btnDiag) btnDiag.addEventListener('click', () => runDiagnostics());
    const safeToggle = document.getElementById('safe-mode-toggle');
    if (safeToggle) {
        const cur = String(localStorage.getItem('safe_mode')||'').toLowerCase()==='true'?'on':'off';
        safeToggle.value = cur;
        safeToggle.addEventListener('change', () => { localStorage.setItem('safe_mode', String(safeToggle.value==='on')); });
    }

    const quickBtn = document.getElementById('btn-generate-quick-summary');
    if (quickBtn) quickBtn.addEventListener('click', () => generateQuickSummaryReport());
});

function generateQuickSummaryReport(){
    const container = document.getElementById('quick-summary-output');
    if (!container) return;
    const deptSel = document.getElementById('report-dept-filter');
    const empSel = document.getElementById('report-employee-select');
    const deptId = deptSel ? deptSel.value : 'all';
    const empId = empSel ? empSel.value : '';
    let targetEmployees = employees || [];
    if (deptId && deptId !== 'all') targetEmployees = targetEmployees.filter(e => String(e.deptId)===String(deptId));
    if (empId) targetEmployees = targetEmployees.filter(e => String(e.id)===String(empId));
    let all = [];
    const today = new Date();
    const startWindow = new Date(); startWindow.setDate(startWindow.getDate() - getGlobalPeriodDays());
    targetEmployees.forEach(emp => {
        const recs = (performanceRecords || {})[emp.id] || [];
        recs.forEach(r => { const d = new Date(r.date); if (d>=startWindow && d<=today) all.push({ empId: emp.id, date: r.date, score: parseFloat(r.totalScore)||0 }); });
    });
    const count = all.length;
    const avg = count ? (all.reduce((s,x)=> s + x.score, 0) / count) : 0;
    const best = count ? all.reduce((m,x)=> (m && m.score>=x.score)?m:x, null) : null;
    const worst = count ? all.reduce((m,x)=> (m && m.score<=x.score)?m:x, null) : null;
    const deptName = (deptId && deptId!=='all') ? ((departments||[]).find(d => String(d.id)===String(deptId))?.name || deptId) : 'جميع الأقسام';
    container.innerHTML = `
        <div class="card" style="padding:8px; display:flex; gap:14px; flex-wrap:wrap;">
            <div>النطاق: ${deptName}${empId?` — موظف: ${(employees||[]).find(e=>String(e.id)===String(empId))?.name||empId}`:''}</div>
            <div>عدد السجلات: ${count}</div>
            <div>المتوسط: ${avg.toFixed(1)}%</div>
            <div>أفضل يوم: ${best ? `${best.score.toFixed(1)}% — ${best.date}` : '—'}</div>
            <div>أضعف يوم: ${worst ? `${worst.score.toFixed(1)}% — ${worst.date}` : '—'}</div>
        </div>
    `;
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
    if (isManagerScoped() && managerDeptId){
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
    try { renderRecordEmployeeHistory(); } catch {}
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
    if (deptSel) deptSel.addEventListener('change', () => { tenantSet('recordsDeptFilter', deptSel.value||'all'); updateRecordsEmployeeSelect(); renderPerformanceRecords(); });
    if (empSel) empSel.addEventListener('change', () => { tenantSet('recordsEmpFilter', empSel.value||''); renderPerformanceRecords(); });
    if (kpiSel) kpiSel.addEventListener('change', () => { tenantSet('recordsKpiFilter', kpiSel.value||'all'); renderPerformanceRecords(); });
    if (startEl) startEl.addEventListener('change', () => { tenantSet('recordsStart', startEl.value||''); renderPerformanceRecords(); });
    if (endEl) endEl.addEventListener('change', () => { tenantSet('recordsEnd', endEl.value||''); renderPerformanceRecords(); });
    if (searchEl) {
        const debounce = (fn, delay) => { let t; return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), delay); }; };
        const handler = debounce(() => { tenantSet('recordsSearch', searchEl.value||''); renderPerformanceRecords(); }, 180);
        searchEl.addEventListener('input', handler);
    }
    if (exportBtn) exportBtn.addEventListener('click', () => exportRecordsExcel());
    const exportCsvBtn = document.getElementById('records-export-csv');
    if (exportCsvBtn) exportCsvBtn.addEventListener('click', () => exportRecordsCSV());
    const resetBtn = document.getElementById('records-reset-filters');
    if (resetBtn) resetBtn.addEventListener('click', () => { resetRecordsFilters(); });

    const pageSizeSel = document.getElementById('records-page-size');
    if (pageSizeSel) {
        const savedSize = parseInt(tenantGet('recordsPageSize')||'10',10);
        pageSizeSel.value = String(savedSize);
        window.recordsPageSize = savedSize;
        pageSizeSel.addEventListener('change', () => { window.recordsPageSize = parseInt(pageSizeSel.value||'10',10); tenantSet('recordsPageSize', String(window.recordsPageSize)); window.recordsPage = 1; renderPerformanceRecords(); });
    }
    const prevBtn = document.getElementById('records-page-prev');
    const nextBtn = document.getElementById('records-page-next');
    if (prevBtn) prevBtn.onclick = function(){ window.recordsPage = Math.max(1, (window.recordsPage||1)-1); renderPerformanceRecords(); };
    if (nextBtn) nextBtn.onclick = function(){ window.recordsPage = (window.recordsPage||1)+1; renderPerformanceRecords(); };

    const rtToday = document.getElementById('records-range-today');
    const rt7 = document.getElementById('records-range-7');
    const rt30 = document.getElementById('records-range-30');
    const fmt = (d)=> d.toISOString().slice(0,10);
    const setRange = (days)=>{ const end=new Date(); const start=new Date(); start.setDate(end.getDate()-(days-1)); if(startEl) startEl.value=fmt(start); if(endEl) endEl.value=fmt(end); tenantSet('recordsStart', startEl.value||''); tenantSet('recordsEnd', endEl.value||''); renderPerformanceRecords(); };
    if (rtToday) rtToday.onclick = function(){ setRange(1); };
    if (rt7) rt7.onclick = function(){ setRange(7); };
    if (rt30) rt30.onclick = function(){ setRange(30); };

    try {
        const savedDept = tenantGet('recordsDeptFilter');
        if (deptSel && savedDept) deptSel.value = savedDept;
        updateRecordsEmployeeSelect();
        const savedEmp = tenantGet('recordsEmpFilter');
        if (empSel && savedEmp) empSel.value = savedEmp;
        const savedKpi = tenantGet('recordsKpiFilter');
        if (kpiSel && savedKpi) kpiSel.value = savedKpi;
        const savedStart = tenantGet('recordsStart');
        const savedEnd = tenantGet('recordsEnd');
        const savedSearch = tenantGet('recordsSearch');
        if (startEl && savedStart) startEl.value = savedStart;
        if (endEl && savedEnd) endEl.value = savedEnd;
        if (searchEl && savedSearch) searchEl.value = savedSearch;
        window.recordsPage = parseInt(tenantGet('recordsPage')||'1',10);
    } catch {}
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
    const total = recs.length;
    const avg = total ? recs.reduce((s,r)=> s + (r.totalScore||0), 0) / total : 0;
    const summaryEl = document.getElementById('records-summary');
    if (summaryEl) summaryEl.textContent = `عدد السجلات: ${total} — متوسط النتيجة: ${avg.toFixed(1)}%`;
    const pageSize = parseInt(window.recordsPageSize||'10',10);
    const page = Math.max(1, parseInt(window.recordsPage||'1',10));
    const maxPage = Math.max(1, Math.ceil(total / pageSize));
    window.recordsPage = Math.min(page, maxPage);
    const startIdx = (window.recordsPage - 1) * pageSize;
    const pageRecs = recs.slice(startIdx, startIdx + pageSize);
    const pageInfo = document.getElementById('records-page-info');
    if (pageInfo) pageInfo.textContent = `${window.recordsPage} / ${maxPage}`;
    tenantSet('recordsPage', String(window.recordsPage));
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
                <button class="btn-secondary" onclick="editPerformanceRecord('${empId}','${r.date}')">${translate('btn_edit') || 'تعديل'}</button>
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
    updateRecordsSortIndicators();
}

function resetRecordsFilters(){
    const deptSel = document.getElementById('records-dept-filter');
    const empSel = document.getElementById('records-employee-select');
    const kpiSel = document.getElementById('records-kpi-filter');
    const startEl = document.getElementById('records-start-date');
    const endEl = document.getElementById('records-end-date');
    const searchEl = document.getElementById('records-search-input');
    if (deptSel) deptSel.value='all';
    updateRecordsEmployeeSelect();
    if (empSel) empSel.value='';
    if (kpiSel) kpiSel.value='all';
    if (startEl) startEl.value='';
    if (endEl) endEl.value='';
    if (searchEl) searchEl.value='';
    window.recordsPage = 1;
    renderPerformanceRecords();
}
window.resetRecordsFilters = resetRecordsFilters;

function deletePerformanceRecord(empId, date){
    const arr = ((performanceRecords || {})[empId] || []);
    const idx = arr.findIndex(r => String(r.date) === String(date));
    if (idx >= 0){
        arr.splice(idx,1);
        performanceRecords[empId] = arr;
        commitChanges();
        try { renderPerformanceRecords(); } catch {}
        try { renderRecordEmployeeHistory(); } catch {}
    }
}

window.updateRecordEmployeeSelect = updateRecordEmployeeSelect;
window.renderRecordKpis = renderRecordKpis;
window.savePerformanceRecord = savePerformanceRecord;
window.updateRecordsEmployeeSelect = updateRecordsEmployeeSelect;
window.updateRecordsFilters = updateRecordsFilters;
window.renderPerformanceRecords = renderPerformanceRecords;
window.deletePerformanceRecord = deletePerformanceRecord;

function toggleRecordsSort(key){
    const prevKey = window.recordsSortKey || 'date';
    const prevDir = window.recordsSortDir || 'desc';
    if (prevKey === key) {
        window.recordsSortDir = prevDir === 'asc' ? 'desc' : 'asc';
    } else {
        window.recordsSortKey = key;
        window.recordsSortDir = 'asc';
    }
    renderPerformanceRecords();
}
window.toggleRecordsSort = toggleRecordsSort;

function updateRecordsSortIndicators(){
    const ths = document.querySelectorAll('#records-table thead th');
    if (!ths || ths.length < 3) return;
    const map = { date: 0, kpis: 1, score: 2 };
    Object.entries(map).forEach(([k,i])=>{
        const baseKey = ths[i].getAttribute('data-i18n');
        const base = baseKey ? translate(baseKey) : ths[i].textContent;
        if (window.recordsSortKey === k) {
            ths[i].innerHTML = `${base} ${window.recordsSortDir==='asc'?'↑':'↓'}`;
        } else {
            ths[i].innerHTML = `${base}`;
        }
    });
}

function renderRecordEmployeeHistory(){
    const empSel = document.getElementById('record-employee-id');
    const table = document.querySelector('#record-employee-records-table tbody');
    if (!empSel || !table) return;
    const empId = empSel.value;
    table.innerHTML = '';
    if (!empId) return;
    const recs = (((performanceRecords||{})[empId])||[]).slice().sort((a,b)=> new Date(a.date) - new Date(b.date));
    const frag = document.createDocumentFragment();
    recs.forEach(r => {
        const tr = document.createElement('tr');
        const kpisCount = r.scores ? Object.keys(r.scores).length : 0;
        tr.innerHTML = `
            <td>${r.date}</td>
            <td>${kpisCount}</td>
            <td>${(r.totalScore||0).toFixed(1)}%</td>
            <td>
                <button class="btn-secondary" onclick="editPerformanceRecord('${empId}','${r.date}')">${translate('btn_edit')||'تعديل'}</button>
                <button class="btn-delete" onclick="deletePerformanceRecord('${empId}','${r.date}')">${translate('btn_delete')||'حذف'}</button>
            </td>`;
        frag.appendChild(tr);
    });
    table.appendChild(frag);
}
window.renderRecordEmployeeHistory = renderRecordEmployeeHistory;

function editPerformanceRecord(empId, date){
    try {
        showScreen('record-screen');
        updateRecordEmployeeSelect();
        const empSel = document.getElementById('record-employee-id');
        const dateEl = document.getElementById('record-date');
        if (empSel) {
            let exists = false;
            Array.from(empSel.options).forEach(o => { if (String(o.value) === String(empId)) exists = true; });
            if (!exists) {
                const opt = document.createElement('option');
                opt.value = String(empId);
                const emp = (employees||[]).find(e => String(e.id)===String(empId));
                opt.textContent = emp ? emp.name : String(empId);
                empSel.appendChild(opt);
            }
            empSel.value = String(empId);
        }
        if (dateEl) dateEl.value = date;
        renderRecordKpis();
    } catch {}
}
window.editPerformanceRecord = editPerformanceRecord;

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
function getCurrentRoles(){
    try {
        const raw = localStorage.getItem('currentRoles');
        let arr = [];
        if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed) && parsed.length) arr = parsed.slice();
        }
        if (!arr.length) {
            const single = localStorage.getItem('currentRole');
            arr = single ? [single] : ['viewer'];
        }
        const isOwner = getIsOwner && getIsOwner();
        const hasAdmin = Array.isArray(arr) && (arr.includes('admin') || arr.includes('super_admin'));
        if (isOwner && !hasAdmin) arr = ['super_admin','admin'].concat(arr.filter(r => r!=='super_admin' && r!=='admin'));
        return arr;
    } catch { return ['viewer']; }
}
function getCurrentRole(){
    const roles = getCurrentRoles();
    return Array.isArray(roles) && roles.length ? roles[0] : 'viewer';
}
function isManagerScoped(){
    const roles = getCurrentRoles();
    const hasManager = Array.isArray(roles) && roles.includes('manager');
    const hasAdmin = Array.isArray(roles) && (roles.includes('super_admin') || roles.includes('admin'));
    return hasManager && !hasAdmin;
}
function getManagerDeptId(){
    try { return tenantGet('managerDeptId') || ''; } catch { return ''; }
}
async function getTenantIdCurrent(){
    const cur = (window.auth && window.auth.currentUser) || {};
    let tid = '';
    if (cur && cur.uid){ try { const d = await window.db.collection('users').doc(cur.uid).get(); tid = (d.data()||{}).tenantId || ''; } catch {} }
    if (!tid){ try { const isOwner = String(localStorage.getItem('IS_OWNER')) === 'true'; tid = isOwner ? (localStorage.getItem('TENANT_ID')||'') : ''; } catch {} }
    return tid;
}
window.getTenantIdCurrent = getTenantIdCurrent;
function basePermsFor(role){
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
function computeRolePerms(roles){
    const arr = Array.isArray(roles) ? roles : [roles];
    const keys = ['manage_departments','manage_employees','manage_kpis','manage_records','manage_goals','manage_data','view_reports','view_dashboard'];
    const out = {};
    keys.forEach(k => out[k] = false);
    arr.forEach(r => {
        const b = basePermsFor(r);
        keys.forEach(k => { out[k] = out[k] || !!b[k]; });
    });
    return out;
}

function getRolePermsOverrides(){
    try {
        const raw = tenantGet('rolePermsOverrides');
        return raw ? JSON.parse(raw) : {};
    } catch { return {}; }
}

function setRolePermsOverrides(role, overrides){
    try {
        const all = getRolePermsOverrides();
        all[role] = overrides;
        tenantSet('rolePermsOverrides', JSON.stringify(all));
    } catch {}
}

async function saveRolePermsOverridesRemote(role, overrides){
    try {
        const tid = await getTenantIdCurrent();
        if (!tid) return;
        await window.db.collection('tenants').doc(String(tid)).collection('role_overrides').doc(String(role)).set(overrides, { merge: true });
        try { await window.db.collection('tenants').doc(String(tid)).collection('audit_logs').add({ type:'save_role_overrides', actor_uid:(window.auth&&window.auth.currentUser||{}).uid||'', actor_email:(window.auth&&window.auth.currentUser||{}).email||'', role: role, overrides: overrides, ts: Date.now() }); } catch {}
    } catch {}
}

async function loadRolePermsOverridesRemote(role){
    try {
        const tid = await getTenantIdCurrent();
        if (!tid) return {};
        const snap = await window.db.collection('tenants').doc(String(tid)).collection('role_overrides').doc(String(role)).get();
        const data = snap.exists ? (snap.data()||{}) : {};
        if (Object.keys(data).length){
            setRolePermsOverrides(role, data);
        }
        return data;
    } catch { return {}; }
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

function renderRoleSummary(role){
    const el = document.getElementById('role-summary-text');
    if (!el) return;
    const summaries = {
        super_admin: 'صلاحيات شاملة لإدارة النظام كاملًا: الأقسام والموظفين والمؤشرات والأهداف والبيانات والتقارير والإعدادات.',
        admin: 'يدير الأقسام والموظفين والمؤشرات والأهداف والبيانات والتقارير، مع صلاحيات إدارية واسعة دون كونها عامة بالكامل.',
        manager: 'إدارة مؤشرات وأهداف وسجلات الأداء لقسم محدد، وعرض لوحة التحكم والتقارير. يحتاج ربط القسم.',
        hr: 'مسؤول عن إدارة بيانات الموظفين وتحديث سجلات الأداء، مع القدرة على عرض التقارير ولوحة التحكم.',
        data_entry: 'إدخال وتحديث سجلات الأداء فقط، مع القدرة على عرض التقارير ولوحة التحكم دون صلاحيات إدارية.',
        viewer: 'عرض لوحة التحكم والتقارير دون أي صلاحيات تعديل.'
    };
    el.textContent = summaries[role] || summaries.viewer;
}

function applyRolePermissions(){
    const rawRoles = getCurrentRoles();
    const isOwner = getIsOwner();
    const roles = (function(){
        const arr = Array.isArray(rawRoles)? rawRoles.slice() : [rawRoles];
        if (isOwner && !(arr.includes('super_admin') || arr.includes('admin'))) arr.unshift('super_admin');
        return arr;
    })();
    const base = computeRolePerms(roles);
    let overrides = {};
    roles.forEach(r => { const o = getRolePermsOverrides()[r] || {}; Object.keys(o).forEach(k => { overrides[k] = overrides[k] || !!o[k]; }); });
    let perms = Object.assign({}, base, overrides);
    try { if (window.__tenantDisabled) { Object.keys(perms).forEach(k => { if (k.startsWith('manage_')) perms[k] = false; }); } } catch {}

    const safeDisable = (sel, disabled) => { try { const el = document.querySelector(sel); if (el) el.disabled = !!disabled; } catch {} };
    safeDisable('#save-dept-button', !perms.manage_departments);
    safeDisable('#cancel-dept-edit', !perms.manage_departments);
    safeDisable('#dept-name', !perms.manage_departments);
    safeDisable('#save-employee-button', !perms.manage_employees);
    safeDisable('#cancel-employee-edit', !perms.manage_employees);
    safeDisable('#save-kpi-button', !perms.manage_kpis);
    safeDisable('#cancel-kpi-edit', !perms.manage_kpis);
    const saveRecordBtn = document.querySelector('#record-screen button[onclick="savePerformanceRecord()"]');
    if (saveRecordBtn) saveRecordBtn.disabled = !perms.manage_records;
    safeDisable('#btn_clear_data', !perms.manage_data);

    const setVisible = (sel, show) => { try { const el = document.querySelector(sel); if (el) el.style.display = show ? '' : 'none'; } catch {} };
    const hasAdminRole = Array.isArray(roles) && (roles.includes('super_admin') || roles.includes('admin'));
    setVisible('#menu-departments', perms.manage_departments);
    setVisible('#menu-employees', perms.manage_employees);
    setVisible('#menu-kpis', perms.manage_kpis);
    setVisible('#menu-goals', perms.manage_goals);
    setVisible('#menu-record', perms.manage_records);
    setVisible('#menu-records-list', perms.manage_records);
    setVisible('#menu-dashboard', perms.view_dashboard);
    setVisible('#menu-personal', perms.view_dashboard);
    setVisible('#menu-reports', perms.view_reports);
    setVisible('#menu-data-mgmt', perms.manage_data);
    setVisible('#menu-roles', hasAdminRole);
    setVisible('#menu-roles-admin', hasAdminRole);
    setVisible('#menu-diagnostics', hasAdminRole);
    setVisible('#menu-settings', true);
    // isOwner already computed
    setVisible('#menu-owner', isOwner);
    try { setOwnerTheme(isOwner); } catch {}
    

    const canManageRoles = true;
    try { renderRoleBadge(); } catch {}

    try {
        const btn = document.getElementById('btn-logout');
        if (btn) {
            btn.style.backgroundColor = '#fdf2f2';
            btn.style.color = '#b00020';
            btn.style.border = '1px solid #e74c3c';
            btn.style.fontWeight = '900';
            btn.style.letterSpacing = '.3px';
        }
    } catch {}
}

function renderRoleBadge(){
    const el = document.getElementById('current-role-badge');
    if (!el) return;
    const rawRoles = getCurrentRoles();
    const isOwner = getIsOwner();
    const roles = (function(){
        const arr = Array.isArray(rawRoles)? rawRoles.slice() : [rawRoles];
        if (isOwner && !(arr.includes('super_admin') || arr.includes('admin'))) arr.unshift('super_admin');
        return arr;
    })();
    const role = Array.isArray(roles) && roles.length ? roles.join(', ') : 'viewer';
    let deptText = '';
    const deptId = getManagerDeptId();
    if (deptId) {
        try {
            const d = (departments || []).find(x => String(x.id) === String(deptId));
            if (d) deptText = ` — القسم: ${d.name}`;
        } catch {}
    }
    // isOwner already computed
    el.textContent = isOwner ? `المالك — ${role}${deptText}` : `الدور: ${role}${deptText}`;
    el.style.display = '';
    try {
        el.classList.remove('admin','manager','viewer');
        const isAdmin = Array.isArray(roles) && (roles.includes('super_admin') || roles.includes('admin'));
        const isManager = Array.isArray(roles) && roles.includes('manager') && !isAdmin;
        el.classList.add(isAdmin ? 'admin' : (isManager ? 'manager' : 'viewer'));
        if (isOwner) el.classList.add('owner'); else el.classList.remove('owner');
    } catch {}
    try {
        const base = computeRolePerms(roles);
        let overrides = {};
        roles.forEach(r => { const o = getRolePermsOverrides()[r] || {}; Object.keys(o).forEach(k => { overrides[k] = overrides[k] || !!o[k]; }); });
        const perms = Object.assign({}, base, overrides);
        const map = {
            manage_departments: 'إدارة الأقسام',
            manage_employees: 'إدارة الموظفين',
            manage_kpis: 'إدارة المؤشرات',
            manage_records: 'تسجيل الأداء',
            manage_goals: 'تحديد الأهداف الزمنية',
            manage_data: 'إدارة البيانات',
            view_reports: 'التقارير والإحصائيات',
            view_dashboard: 'لوحة التحكم'
        };
        const list = Object.keys(map).filter(k => !!perms[k]).map(k => map[k]);
        el.title = list.join(', ');
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
    loadRolePermsOverridesRemote(roleSel.value).then(() => { try { renderRolePerms(roleSel.value); renderRoleSummary(roleSel.value); } catch {} });
    renderRoleSummary(roleSel.value);
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
    loadRolePermsOverridesRemote(role).then(() => { try { renderRolePerms(role); renderRoleSummary(role); } catch {} });
    renderRoleSummary(role);
}

async function saveRoleSettings(){
    const roleSel = document.getElementById('role-select');
    const deptSel = document.getElementById('role-dept-id');
    const role = roleSel ? roleSel.value : 'viewer';
    try { tenantSet('currentRole', role); } catch {}
    if (role === 'manager' && deptSel && deptSel.value){
        try { tenantSet('managerDeptId', String(deptSel.value)); } catch {}
    } else {
        try { tenantRemove('managerDeptId'); } catch {}
    }
    try {
        const overrides = {};
        document.querySelectorAll('#role-perms-container input[type="checkbox"][data-perm]').forEach(cb => {
            const key = cb.getAttribute('data-perm');
            overrides[key] = !!cb.checked;
        });
        setRolePermsOverrides(role, overrides);
        await saveRolePermsOverridesRemote(role, overrides);
    } catch {}

    applyRolePermissions();
    try {
        const note = document.querySelector('#roles-form span[data-i18n="roles_note"]');
        if (note) note.textContent = translate('roles_saved');
    } catch {}
}

function initAdminRolesPage(){
    const roleMultiInvite = document.getElementById('admin-roles-multi');
    const roleMultiEdit = document.getElementById('admin-roles-multi-edit');
    const deptSelInvite = document.getElementById('admin-invite-dept');
    const deptSelEdit = document.getElementById('admin-user-dept');
    const saveRolesBtn = document.getElementById('admin-save-user-roles');
    const inviteEmailEl = document.getElementById('admin-invite-email');
    const resetBtn = document.getElementById('admin-send-reset');
    const refreshBtn = document.getElementById('admin-users-refresh');
    const createBtn = document.getElementById('admin-create-user');
    const createPassEl = document.getElementById('admin-create-password');
    const genPassBtn = document.getElementById('admin-gen-pass');
    const sendResetAfterCreateEl = document.getElementById('admin-create-send-reset');
    const table = document.getElementById('admin-users-table');
    const deleteBtn = document.getElementById('admin-delete-user');
    const editPassEl = document.getElementById('admin-user-password');
    updateDepartmentSelects();
    function getSelectedRoles(){
        const arr = [];
        document.querySelectorAll('#admin-roles-multi input[type="checkbox"], #admin-roles-multi-edit input[type="checkbox"]').forEach(cb => { if (cb.checked) arr.push(cb.value); });
        return arr.length ? arr : ['viewer'];
    }
    async function fetchUsers(){
        try {
            const tid = await getTenantIdForCurrentUser();
            let qs;
            if (tid) qs = await window.db.collection('users').where('tenantId','==',tid).limit(200).get(); else qs = await window.db.collection('users').limit(200).get();
            const rows = qs.docs.map(d => { const v = d.data()||{}; return { uid: d.id, email: v.email||v.username||'', roles: Array.isArray(v.roles)?v.roles: (v.role?[v.role]:['viewer']), managerDeptId: v.managerDeptId||'', isDisabled: !!v.isDisabled }; });
            table.innerHTML = '<thead><tr><th>UID</th><th>البريد</th><th>الأدوار</th><th>القسم</th><th>الحالة</th></tr></thead><tbody></tbody>';
            const tb = table.querySelector('tbody');
            const searchEl = document.getElementById('admin-users-search');
            const term = (searchEl && searchEl.value || '').trim().toLowerCase();
            rows.filter(r => !term || (String(r.email).toLowerCase().includes(term) || String(r.uid).toLowerCase().includes(term))).forEach(r => {
                const tr = document.createElement('tr');
                tr.innerHTML = `<td>${r.uid}</td><td>${r.email}</td><td>${r.roles.join(', ')}</td><td>${r.managerDeptId||''}</td><td>${r.isDisabled? 'معطل':''}</td>`;
                tr.style.cursor = 'pointer';
                tr.addEventListener('click', function(){
                    const uidEl = document.getElementById('admin-user-uid');
                    const emailEl = document.getElementById('admin-user-email');
                    const deptSelEdit = document.getElementById('admin-user-dept');
                    const disabledEl = document.getElementById('admin-user-disabled');
                    uidEl && (uidEl.value = r.uid);
                    emailEl && (emailEl.value = r.email);
                    deptSelEdit && (deptSelEdit.value = r.managerDeptId||'');
                    disabledEl && (disabledEl.checked = !!r.isDisabled);
                    document.querySelectorAll('#admin-roles-multi-edit input[type="checkbox"]').forEach(cb => { cb.checked = r.roles.includes(cb.value); });
                });
                tb.appendChild(tr);
            });
        } catch {}
    }
    async function getTenantIdForCurrentUser(){
        const cur = (window.auth && window.auth.currentUser) || {};
        let tid = '';
        if (cur && cur.uid){
            try { const d = await window.db.collection('users').doc(cur.uid).get(); tid = (d.data()||{}).tenantId || ''; } catch {}
        }
        if (!tid){ try { const isOwner = String(localStorage.getItem('IS_OWNER')) === 'true'; tid = isOwner ? (localStorage.getItem('TENANT_ID')||'') : ''; } catch {} }
        return tid;
    }
    async function createTenantUser(){
        try {
            const email = (inviteEmailEl && inviteEmailEl.value || '').trim();
            const password = (createPassEl && createPassEl.value || '').trim();
            if (!email || !password || password.length < 6) { alert('أدخل اسم مستخدم صحيح وكلمة مرور 6 أحرف على الأقل.'); return; }
            try {
                const qEmail = await window.db.collection('users').where('email','==',email).limit(1).get();
                const qUser = await window.db.collection('users').where('username','==',email).limit(1).get();
                if (!qEmail.empty || !qUser.empty) { alert('البريد/اسم المستخدم مستخدم بالفعل. اختر قيمة غير مكررة.'); return; }
            } catch {}
            let roles = getSelectedRoles();
            const deptId = deptSelInvite ? (deptSelInvite.value || '') : '';
            const cur = (window.auth.currentUser || {});
            if (!cur || !cur.uid) { alert('يلزم تسجيل الدخول كمسؤول.'); return; }
            let tenantId = '';
            try {
                const curDoc = await window.db.collection('users').doc(cur.uid).get();
                const isOwner = String(localStorage.getItem('IS_OWNER')) === 'true';
                tenantId = (curDoc.data()||{}).tenantId || (isOwner ? (localStorage.getItem('TENANT_ID')||'') : '');
            } catch {}
            try {
                const ph = await (async function(s){ const enc = new TextEncoder().encode(s); const d = await crypto.subtle.digest('SHA-256', enc); return Array.from(new Uint8Array(d)).map(b=>b.toString(16).padStart(2,'0')).join(''); })(password);
                const add = await window.db.collection('users').add({ username: email, email: email, passwordHash: ph, roles: roles, managerDeptId: deptId, tenantId: tenantId, isDisabled: false });
                try { const t = await getTenantIdForCurrentUser(); await window.db.collection('tenants').doc(t).collection('audit_logs').add({ type:'create_user', actor_uid: cur.uid||'', actor_email: cur.email||'', target_uid: add.id||'', target_email: email, roles: roles, managerDeptId: deptId, ts: Date.now() }); } catch {}
            } catch {}
            alert('تم إنشاء المستخدم بنجاح.');
            fetchUsers();
        } catch (e) { alert('تعذر إنشاء المستخدم: ' + (e.code||e.message||'')); }
    }
    async function saveUserRoles(){
        try {
            const uidEl = document.getElementById('admin-user-uid');
            const emailEl = document.getElementById('admin-user-email');
            const disabledEl = document.getElementById('admin-user-disabled');
            const uid = (uidEl && uidEl.value || '').trim();
            const email = (emailEl && emailEl.value || '').trim();
            let roles = getSelectedRoles();
            const deptId = deptSelEdit ? deptSelEdit.value || '' : '';
            if (!uid && !email) return;
            let docRef;
            if (uid) docRef = window.db.collection('users').doc(uid);
            else {
                let q = await window.db.collection('users').where('email','==',email).limit(1).get();
                if (!q.empty) docRef = q.docs[0].ref;
                if (!docRef) {
                    q = await window.db.collection('users').where('username','==',email).limit(1).get();
                    if (!q.empty) docRef = q.docs[0].ref;
                }
            }
            if (!docRef) return;
            try {
                const current = await docRef.get();
                const curId = current && current.id ? current.id : uid;
                const dupEmail = await window.db.collection('users').where('email','==',email).limit(1).get();
                const dupUser = await window.db.collection('users').where('username','==',email).limit(1).get();
                const conflict = (!dupEmail.empty && dupEmail.docs[0].id !== curId) || (!dupUser.empty && dupUser.docs[0].id !== curId);
                if (conflict) { alert('البريد/اسم المستخدم مستخدم بالفعل لمستخدم آخر.'); return; }
            } catch {}
            await docRef.set({ email: email, username: email, roles: roles, managerDeptId: deptId, isDisabled: !!(disabledEl && disabledEl.checked) }, { merge: true });
            try { const t = await getTenantIdForCurrentUser(); await window.db.collection('tenants').doc(t).collection('audit_logs').add({ type:'update_user_roles', actor_uid: (window.auth.currentUser||{}).uid||'', actor_email: (window.auth.currentUser||{}).email||'', target_uid: uid||'', target_email: email||'', roles: roles, managerDeptId: deptId, isDisabled: !!(disabledEl && disabledEl.checked), ts: Date.now() }); } catch {}
            fetchUsers();
        } catch {}
    }
    
    async function sendReset(){
        try {
            alert('إعادة تعيين كلمة المرور غير مدعومة في هذا الإصدار.');
        } catch (e) { alert('تعذر تنفيذ العملية.'); }
    }
    async function deleteUser(){
        try {
            const uidEl = document.getElementById('admin-user-uid');
            const emailEl = document.getElementById('admin-user-email');
            const uid = (uidEl && uidEl.value || '').trim();
            const email = (emailEl && emailEl.value || '').trim();
            const pwd = (editPassEl && editPassEl.value || '').trim();
            if (!uid && !email) { alert('أدخل UID أو البريد أولاً.'); return; }
            const cur = (window.auth.currentUser || {});
            if (!cur || !cur.uid) { alert('يلزم تسجيل الدخول كمسؤول.'); return; }
            let docRef;
            if (uid) docRef = window.db.collection('users').doc(uid);
            else {
                const q = await window.db.collection('users').where('email','==',email).limit(1).get();
                if (!q.empty) docRef = q.docs[0].ref;
            }
            if (!docRef) { alert('تعذر تحديد المستخدم.'); return; }
            try { await docRef.delete(); } catch {}
            try { const t = await getTenantIdForCurrentUser(); await window.db.collection('tenants').doc(t).collection('audit_logs').add({ type:'delete_user', actor_uid: cur.uid||'', actor_email: cur.email||'', target_uid: uid||'', target_email: email||'', deleted_auth: false, ts: Date.now() }); } catch {}
            alert('تم حذف المستخدم من قاعدة البيانات.');
            fetchUsers();
        } catch (e) { alert('حدث خطأ أثناء الحذف: ' + (e.code||e.message||'')); }
    }
    saveRolesBtn && saveRolesBtn.addEventListener('click', saveUserRoles);
    createBtn && createBtn.addEventListener('click', createTenantUser);
    resetBtn && resetBtn.addEventListener('click', sendReset);
    refreshBtn && refreshBtn.addEventListener('click', fetchUsers);
    deleteBtn && deleteBtn.addEventListener('click', deleteUser);
    const searchEl = document.getElementById('admin-users-search');
    searchEl && searchEl.addEventListener('input', fetchUsers);
    genPassBtn && genPassBtn.addEventListener('click', function(){
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*';
        let out = '';
        for (let i=0;i<10;i++){ out += chars[Math.floor(Math.random()*chars.length)]; }
        if (createPassEl) createPassEl.value = out;
    });
    fetchUsers();
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

function setReportTab(tab){
    const ids = {
        employee: 'report-employee-section',
        employee_records: 'report-employee-records-section',
        overall: 'report-overall-section',
        quick: 'report-quick-section',
        dept_compare: 'report-dept-compare-section',
        kpi_dept: 'report-kpi-dept-section',
        employee_result: 'report-employee-result-section',
        kpi_correlation: 'report-correlation-section',
        weekday_heatmap: 'report-weekday-heatmap-section'
    };
    Object.values(ids).forEach(id => { const el = document.getElementById(id); if (el) el.style.display = 'none'; });
    const activeId = ids[tab] || ids.employee;
    const activeEl = document.getElementById(activeId);
    if (activeEl) { activeEl.style.display = ''; activeEl.classList.add('fade-in'); }
    try { tenantSet('reportTab', tab); } catch {}
    if (tab === 'employee_records') { try { renderReportEmployeeRecords(); } catch {} }
    if (tab === 'dept_compare') { try { renderDeptCompare(); } catch {} }
    if (tab === 'kpi_dept') { try { renderKpiDept(); } catch {} }
    if (tab === 'employee_result') { try { renderEmployeeResultTab(); } catch {} }
    if (tab === 'kpi_correlation') { try { initCorrelationControls(); renderCorrelation(); } catch {} }
    const cards = document.querySelectorAll('#reports-card-grid .report-card');
    cards.forEach(c=>{ c.classList.remove('active'); });
    const map = { employee:'تقرير الموظف', employee_records:'سجلات الموظف', overall:'التقرير الإجمالي', quick:'ملخص سريع', employee_result:'نتيجة التقييم للموظف', dept_compare:'مقارنة الأقسام', kpi_dept:'تحليل KPI حسب القسم', kpi_correlation:'الارتباط بين مؤشرين', weekday_heatmap:'خريطة أيام الأسبوع' };
    const idx = Object.keys(map).indexOf(tab);
    const target = cards[idx] || null;
    if (target) target.classList.add('active');
    const grid = document.getElementById('reports-card-grid');
    const ctrl = document.getElementById('reports-controls');
    if (grid) grid.style.display = 'none';
    if (ctrl) ctrl.style.display = '';
    try { updateReportsActions(tab); } catch {}
}
window.setReportTab = setReportTab;

function showReportsCards(){
    const ids = ['report-employee-section','report-employee-records-section','report-overall-section','report-quick-section','report-dept-compare-section','report-kpi-dept-section','report-employee-result-section'];
    ids.forEach(id => { const el = document.getElementById(id); if (el) el.style.display = 'none'; });
    const grid = document.getElementById('reports-card-grid');
    const ctrl = document.getElementById('reports-controls');
    if (grid) grid.style.display = '';
    if (ctrl) ctrl.style.display = 'none';
    const cards = document.querySelectorAll('#reports-card-grid .report-card');
    cards.forEach(c=>{ c.classList.remove('active'); });
}
window.showReportsCards = showReportsCards;

function initReportsSlider(){
    const track = document.querySelector('#reports-slider .slides-track');
    const prev = document.getElementById('rs-prev');
    const next = document.getElementById('rs-next');
    if (!track || !prev || !next) return;
    const slideW = () => {
        const s = track.querySelector('.slide');
        return (s ? s.getBoundingClientRect().width : 300) + 32;
    };
    prev.onclick = function(){ track.scrollBy({ left: -slideW(), behavior: 'smooth' }); };
    next.onclick = function(){ track.scrollBy({ left: slideW(), behavior: 'smooth' }); };
    track.addEventListener('keydown', (e)=>{
        if (e.key === 'ArrowLeft') prev.click();
        if (e.key === 'ArrowRight') next.click();
    });
    const slides = document.querySelectorAll('#reports-slider .slide');
    slides.forEach(sl => {
        sl.addEventListener('keydown', (e)=>{ if (e.key==='Enter'){ const tab = sl.getAttribute('data-tab')||''; if (tab) setReportTab(tab); } });
    });
}

function initReportsControls(){
    const deptSel = document.getElementById('report-dept-filter');
    if (deptSel) {
        deptSel.innerHTML = '';
        const optAll = document.createElement('option');
        optAll.value = 'all';
        optAll.textContent = translate('filter_all_dept') || 'جميع الأقسام';
        deptSel.appendChild(optAll);
        (departments||[]).forEach(d => { deptSel.appendChild(new Option(d.name, d.id)); });
        deptSel.addEventListener('change', () => { updateReportTargetSelect(); renderReportEmployeeRecords(); });
    }
    const empSel = document.getElementById('report-employee-select');
    if (empSel) empSel.addEventListener('change', () => { renderReportEmployeeRecords(); });
    const startEl = document.getElementById('report-start-date');
    const endEl = document.getElementById('report-end-date');
    if (startEl) startEl.addEventListener('change', () => renderReportEmployeeRecords());
    if (endEl) endEl.addEventListener('change', () => renderReportEmployeeRecords());
    const rtoday = document.getElementById('report-range-today');
    const r7 = document.getElementById('report-range-7');
    const r30 = document.getElementById('report-range-30');
    const fmtReport = (d)=> d.toISOString().slice(0,10);
    const setReportRange = (days)=>{ const end=new Date(); const start=new Date(); start.setDate(end.getDate()-(days-1)); if(startEl) startEl.value = fmtReport(start); if(endEl) endEl.value = fmtReport(end); generateReport(); };
    if (rtoday) rtoday.onclick = function(){ setReportRange(1); };
    if (r7) r7.onclick = function(){ setReportRange(7); };
    if (r30) r30.onclick = function(){ setReportRange(30); };
    const searchEl = document.getElementById('report-records-search');
    if (searchEl) searchEl.addEventListener('input', () => renderReportEmployeeRecords());
    const kpiDeptSel = document.getElementById('kpi-dept-filter');
    if (kpiDeptSel) {
        kpiDeptSel.innerHTML = '';
        (departments||[]).forEach(d => { kpiDeptSel.appendChild(new Option(d.name, d.id)); });
        kpiDeptSel.addEventListener('change', () => renderKpiDept());
    }
    const kpiSel = document.getElementById('kpi-dept-select');
    if (kpiSel) kpiSel.addEventListener('change', () => renderKpiDept());
    const backBtn = document.getElementById('reports-back');
    if (backBtn) backBtn.onclick = function(){ showReportsCards(); };
    const cards = document.querySelectorAll('#reports-card-grid .report-card');
    cards.forEach(card => {
        card.addEventListener('keydown', (e) => { if (e.key === 'Enter') { const tab = card.getAttribute('data-tab') || ''; if (tab) setReportTab(tab); } });
    });
    
    try { renderKpiDept(); } catch {}
    const recPrintBtn = document.getElementById('records-tab-print');
    if (recPrintBtn) recPrintBtn.onclick = function(){
        const deptSel = document.getElementById('records-tab-dept');
        const empSel2 = document.getElementById('records-tab-employee');
        const startEl2 = document.getElementById('records-tab-start');
        const endEl2 = document.getElementById('records-tab-end');
        const deptId = deptSel ? deptSel.value : 'all';
        const deptName = deptId === 'all' ? 'جميع الأقسام' : ((departments||[]).find(d=> String(d.id)===String(deptId))||{}).name || '—';
        const empId = empSel2 ? empSel2.value : '';
        const empName = (employees||[]).find(e=> String(e.id)===String(empId))?.name || '—';
        const startVal = startEl2 && startEl2.value ? startEl2.value : '';
        const endVal = endEl2 && endEl2.value ? endEl2.value : '';
        const title = `سجلات الموظف — القسم: ${deptName} — الموظف: ${empName}${startVal||endVal?` — ${startVal} إلى ${endVal}`:''}`;
        printTable('report-records-table', title);
    };
    const dcExportBtn = document.getElementById('dept-compare-export');
    const dcPrintBtn = document.getElementById('dept-compare-print');
    if (dcExportBtn) dcExportBtn.onclick = function(){ exportDeptCompareExcel(); };
    if (dcPrintBtn) dcPrintBtn.onclick = function(){
        const days = parseInt((document.getElementById('dept-compare-period')||{}).value||'60',10);
        const title = `مقارنة الأقسام — آخر ${days} يوماً`;
        printCanvas('dept-compare-chart', title);
    };
    const kdExportBtn = document.getElementById('kpi-dept-export');
    const kdPrintBtn = document.getElementById('kpi-dept-print');
    if (kdExportBtn) kdExportBtn.onclick = function(){ exportKpiDeptExcel(); };
    if (kdPrintBtn) kdPrintBtn.onclick = function(){
        const deptId = (document.getElementById('kpi-dept-filter')||{}).value;
        const deptName = (departments||[]).find(d=> String(d.id)===String(deptId))?.name || '—';
        const kpiId = (document.getElementById('kpi-dept-select')||{}).value;
        const kpiName = (kpis||[]).find(k=> String(k.id)===String(kpiId))?.name || '—';
        const title = `تحليل KPI حسب القسم — القسم: ${deptName} — المؤشر: ${kpiName}`;
        printCanvas('kpi-dept-chart', title);
    };
    const ovExportBtn = document.getElementById('overall-export');
    const ovPrintBtn = document.getElementById('overall-print');
    if (ovExportBtn) ovExportBtn.onclick = function(){ exportOverallExcel(); };
    if (ovPrintBtn) ovPrintBtn.onclick = function(){ printSection('overall-report-output','التقرير الإجمالي'); };
    const repCsvBtn = document.getElementById('report-export-csv');
    if (repCsvBtn) repCsvBtn.onclick = function(){ exportEmployeeReportCSV(); };
    try { const tab = tenantGet('reportTab') || 'employee'; updateReportsActions(tab); } catch {}
    const qExportBtn = document.getElementById('quick-export');
    const qPrintBtn = document.getElementById('quick-print');
    if (qExportBtn) qExportBtn.onclick = function(){ exportTextSectionExcel('quick-summary-output','quick_summary.xlsx'); };
    if (qPrintBtn) qPrintBtn.onclick = function(){ printSection('quick-summary-output','ملخص سريع'); };

    const tg = document.getElementById('threshold-good');
    const tw = document.getElementById('threshold-warn');
    try {
        const good = parseInt(tenantGet('threshold_good')||'85',10);
        const warn = parseInt(tenantGet('threshold_warn')||'60',10);
        if (tg) tg.value = String(good);
        if (tw) tw.value = String(warn);
    } catch {}
    const applyThresholds = () => {
        const g = Math.max(0, Math.min(100, parseInt((tg&&tg.value)||'85',10)));
        const w = Math.max(0, Math.min(100, parseInt((tw&&tw.value)||'60',10)));
        try { tenantSet('threshold_good', String(g)); tenantSet('threshold_warn', String(w)); } catch {}
        try { renderReportEmployeeRecords(); } catch {}
        try { generateReport(); } catch {}
    };
    if (tg) tg.addEventListener('change', applyThresholds);
    if (tw) tw.addEventListener('change', applyThresholds);

    const resEmpSel = document.getElementById('report-result-employee-select');
    if (resEmpSel) {
        resEmpSel.innerHTML = '';
        resEmpSel.appendChild(new Option(translate('select_emp_placeholder'), ''));
        (employees||[]).forEach(emp => resEmpSel.appendChild(new Option(emp.name, emp.id)));
        resEmpSel.addEventListener('change', () => renderEmployeeResultTab());
    }

    const tabDeptSel = document.getElementById('records-tab-dept');
    if (tabDeptSel) {
        tabDeptSel.addEventListener('change', () => { updateRecordsTabEmployeeSelect(); renderReportEmployeeRecords(); });
    }
    const tabEmpSel = document.getElementById('records-tab-employee');
    if (tabEmpSel) {
        tabEmpSel.addEventListener('change', () => { renderReportEmployeeRecords(); });
    }
    const tabStartEl = document.getElementById('records-tab-start');
    const tabEndEl = document.getElementById('records-tab-end');
    if (tabStartEl) tabStartEl.addEventListener('change', () => { renderReportEmployeeRecords(); });
    if (tabEndEl) tabEndEl.addEventListener('change', () => { renderReportEmployeeRecords(); });
    const tabSearchEl = document.getElementById('records-tab-search');
    if (tabSearchEl) {
        const debounce = (fn, delay) => { let t; return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), delay); }; };
        tabSearchEl.addEventListener('input', debounce(() => { renderReportEmployeeRecords(); }, 180));
    }

    const tabPageSize = document.getElementById('records-tab-page-size');
    if (tabPageSize) {
        const savedSize = parseInt(tenantGet('recordsTabPageSize')||'10',10);
        tabPageSize.value = String(savedSize);
        window.recordsTabPageSize = savedSize;
        tabPageSize.addEventListener('change', () => { window.recordsTabPageSize = parseInt(tabPageSize.value||'10',10); tenantSet('recordsTabPageSize', String(window.recordsTabPageSize)); window.recordsTabPage = 1; renderReportEmployeeRecords(); });
    }
    const tabPrev = document.getElementById('records-tab-page-prev');
    const tabNext = document.getElementById('records-tab-page-next');
    if (tabPrev) tabPrev.onclick = function(){ window.recordsTabPage = Math.max(1, (window.recordsTabPage||1)-1); renderReportEmployeeRecords(); };
    if (tabNext) tabNext.onclick = function(){ window.recordsTabPage = (window.recordsTabPage||1)+1; renderReportEmployeeRecords(); };

    const rtToday = document.getElementById('records-tab-range-today');
    const rt7 = document.getElementById('records-tab-range-7');
    const rt30 = document.getElementById('records-tab-range-30');
    const fmt = (d)=> d.toISOString().slice(0,10);
    const setRange = (days)=>{ const end=new Date(); const start=new Date(); start.setDate(end.getDate()-(days-1)); if(tabStartEl) tabStartEl.value=fmt(start); if(tabEndEl) tabEndEl.value=fmt(end); renderReportEmployeeRecords(); };
    if (rtToday) rtToday.onclick = function(){ setRange(1); };
    if (rt7) rt7.onclick = function(){ setRange(7); };
    if (rt30) rt30.onclick = function(){ setRange(30); };

    const csvBtn = document.getElementById('records-tab-export-csv');
    if (csvBtn) csvBtn.onclick = function(){ const empId = (document.getElementById('records-tab-employee')||{}).value || ''; exportReportRecordsCSV(empId); };

    window.reportRecordsSortKey = tenantGet('reportRecordsSortKey') || 'date';
    window.reportRecordsSortDir = tenantGet('reportRecordsSortDir') || 'desc';
    const ths = document.querySelectorAll('#report-records-table thead th');
    if (ths && ths.length >= 3) {
        ths[0].style.cursor = 'pointer';
        ths[1].style.cursor = 'pointer';
        ths[2].style.cursor = 'pointer';
        ths[0].onclick = function(){ toggleReportRecordsSort('date'); };
        ths[1].onclick = function(){ toggleReportRecordsSort('kpis'); };
        ths[2].onclick = function(){ toggleReportRecordsSort('score'); };
    }
    updateReportSortIndicators();
}
window.initReportsControls = initReportsControls;

function renderWeekdayHeatmap(){
    const deptId = (document.getElementById('heatmap-dept-filter')||{}).value;
    const period = parseInt((document.getElementById('heatmap-period')||{}).value||'30',10);
    const headRow = document.getElementById('weekday-heatmap-head');
    const bodyEl = document.getElementById('weekday-heatmap-body');
    if (!deptId || !headRow || !bodyEl) return;
    const days = ['السبت','الأحد','الإثنين','الثلاثاء','الأربعاء','الخميس','الجمعة'];
    headRow.innerHTML = `<th>الموظف</th>` + days.map(d=>`<th>${d}</th>`).join('');
    bodyEl.innerHTML = '';
    const emps = (deptId==='all') ? (employees||[]) : (employees||[]).filter(e=> String(e.deptId)===String(deptId));
    const today=new Date(); const start=new Date(); start.setDate(today.getDate()-period);
    const frag = document.createDocumentFragment();
    emps.forEach(e=>{
        const recs = ((performanceRecords||{})[e.id]||[]).filter(r=>{ const d=new Date(r.date); return d>=start && d<=today; });
        const buckets = [[],[],[],[],[],[],[]];
        recs.forEach(r=>{ const d=new Date(r.date); const idx=(d.getDay()+6)%7; buckets[idx].push(r.totalScore||0); });
        const avgs = buckets.map(a=> a.length? (a.reduce((s,v)=>s+v,0)/a.length): null);
        const tr = document.createElement('tr');
        const tds = [`<td>${e.name}</td>`].concat(avgs.map(v=>{
            if (v===null) return '<td class="heat-cell">—</td>';
            const hue = 120 * (v/100);
            const bg = `hsl(${hue},70%,85%)`;
            return `<td class="heat-cell" style="background:${bg}">${v.toFixed(1)}%</td>`;
        }));
        tr.innerHTML = tds.join('');
        frag.appendChild(tr);
    });
    bodyEl.appendChild(frag);
}

function exportWeekdayHeatmapExcel(){
    const bodyEl = document.getElementById('weekday-heatmap-body');
    if (!bodyEl || !bodyEl.rows || !bodyEl.rows.length){ alert(translate('alert_no_data_to_export')); return; }
    const headCells = Array.from(document.querySelectorAll('#weekday-heatmap-head th')).map(th=> th.textContent.trim());
    const rows = Array.from(bodyEl.querySelectorAll('tr')).map(tr=> Array.from(tr.querySelectorAll('td')).map(td=> td.textContent.replace('%','')) );
    const data = [headCells, ...rows];
    const ws = XLSX.utils.aoa_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'WeekdayHeatmap');
    XLSX.writeFile(wb, 'weekday_heatmap.xlsx');
}

function renderReportEmployeeRecords(){
    const empId = (document.getElementById('records-tab-employee')||document.getElementById('report-employee-select')||{}).value || '';
    const startEl = document.getElementById('records-tab-start') || document.getElementById('report-start-date');
    const endEl = document.getElementById('records-tab-end') || document.getElementById('report-end-date');
    const searchEl = document.getElementById('records-tab-search') || document.getElementById('report-records-search');
    const tbody = document.querySelector('#report-records-table tbody');
    if (!tbody) return;
    tbody.innerHTML = '';
    if (!empId) return;
    let recs = (((performanceRecords||{})[empId])||[]).slice();
    const startDate = startEl && startEl.value ? new Date(startEl.value) : null;
    const endDate = endEl && endEl.value ? new Date(endEl.value) : null;
    const q = String(searchEl && searchEl.value || '').trim().toLowerCase();
    if (startDate) recs = recs.filter(r => new Date(r.date) >= startDate);
    if (endDate) recs = recs.filter(r => new Date(r.date) <= endDate);
    if (q) recs = recs.filter(r => String(r.date).toLowerCase().includes(q) || String(r.totalScore).toLowerCase().includes(q));
    const dir = window.reportRecordsSortDir === 'asc' ? 1 : -1;
    recs.sort((a,b)=>{
        if (window.reportRecordsSortKey === 'score') return (((a.totalScore||0) - (b.totalScore||0)) * dir);
        if (window.reportRecordsSortKey === 'kpis') {
            const ak = a.scores ? Object.keys(a.scores).length : 0;
            const bk = b.scores ? Object.keys(b.scores).length : 0;
            return (ak - bk) * dir;
        }
        return ((new Date(a.date) - new Date(b.date)) * dir);
    });
    const total = recs.length;
    const avg = total ? recs.reduce((s,r)=> s + (r.totalScore||0), 0) / total : 0;
    const summary = document.getElementById('report-records-summary');
    if (summary) summary.textContent = `عدد السجلات: ${total} — متوسط النتيجة: ${avg.toFixed(1)}%`;
    const size = parseInt(window.recordsTabPageSize||'10',10);
    const page = Math.max(1, parseInt(window.recordsTabPage||'1',10));
    const maxPage = Math.max(1, Math.ceil(total / size));
    window.recordsTabPage = Math.min(page, maxPage);
    tenantSet('recordsTabPage', String(window.recordsTabPage));
    const startIdx = (window.recordsTabPage - 1) * size;
    const pageRecs = recs.slice(startIdx, startIdx + size);
    const pageInfo = document.getElementById('records-tab-page-info');
    if (pageInfo) pageInfo.textContent = `${window.recordsTabPage} / ${maxPage}`;
    try {
        const sc = document.getElementById('records-summary-cards');
        const cEl = document.getElementById('rsc-rec-count');
        const aEl = document.getElementById('rsc-rec-avg');
        const pEl = document.getElementById('rsc-rec-page');
        if (sc && cEl && aEl && pEl) {
            sc.style.display = '';
            cEl.textContent = String(total);
            aEl.textContent = `${avg.toFixed(1)}%`;
            pEl.textContent = `${window.recordsTabPage}/${maxPage}`;
        }
    } catch {}
    const frag = document.createDocumentFragment();
    const goodTh = parseInt(tenantGet('threshold_good')||'85',10);
    const warnTh = parseInt(tenantGet('threshold_warn')||'60',10);
    pageRecs.forEach(r=>{
        const kcnt = r.scores ? Object.keys(r.scores).length : 0;
        const cls = ((r.totalScore||0) >= goodTh) ? 'score-good' : ((r.totalScore||0) >= warnTh) ? 'score-warn' : 'score-bad';
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${r.date}</td><td>${kcnt}</td><td class="${cls}">${(r.totalScore||0).toFixed(1)}%</td><td><button class="btn-secondary" onclick="toggleReportRecordDetails('${empId}','${r.date}')">${translate('details')||'تفاصيل'}</button> <button class="btn-secondary" onclick="editPerformanceRecord('${empId}','${r.date}')">${translate('btn_edit')||'تعديل'}</button> <button class="btn-delete" onclick="deletePerformanceRecord('${empId}','${r.date}')">${translate('btn_delete')||'حذف'}</button></td>`;
        frag.appendChild(tr);
        const detailsTr = document.createElement('tr');
        detailsTr.className = 'details-row';
        const td = document.createElement('td');
        td.colSpan = 4;
        const kpiMap = new Map((kpis||[]).map(k => [String(k.id), k]));
        const lines = Object.keys(r.scores||{}).map(kid => {
            const k = kpiMap.get(String(kid));
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
    const exportBtn = document.getElementById('records-tab-export') || document.getElementById('report-records-export');
    if (exportBtn) exportBtn.onclick = function(){ exportReportRecordsExcel(empId, recs); };
    updateReportSortIndicators();
}
window.renderReportEmployeeRecords = renderReportEmployeeRecords;

function toggleReportRecordsSort(key){
    const prevKey = window.reportRecordsSortKey || 'date';
    const prevDir = window.reportRecordsSortDir || 'desc';
    if (prevKey === key) {
        window.reportRecordsSortDir = prevDir === 'asc' ? 'desc' : 'asc';
    } else {
        window.reportRecordsSortKey = key;
        window.reportRecordsSortDir = 'asc';
    }
    try {
        tenantSet('reportRecordsSortKey', window.reportRecordsSortKey);
        tenantSet('reportRecordsSortDir', window.reportRecordsSortDir);
    } catch {}
    renderReportEmployeeRecords();
}
window.toggleReportRecordsSort = toggleReportRecordsSort;

function updateReportSortIndicators(){
    const ths = document.querySelectorAll('#report-records-table thead th');
    if (!ths || ths.length < 3) return;
    const map = { date: 0, kpis: 1, score: 2 };
    Object.entries(map).forEach(([k,i])=>{
        const key = ths[i].getAttribute('data-i18n');
        const base = key ? translate(key) : ths[i].textContent;
        if (window.reportRecordsSortKey === k) {
            ths[i].innerHTML = `${base} ${window.reportRecordsSortDir==='asc'?'↑':'↓'}`;
        } else {
            ths[i].innerHTML = `${base}`;
        }
    });
}

function toggleReportRecordDetails(empId, date){
    const tbody = document.querySelector('#report-records-table tbody');
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
window.toggleReportRecordDetails = toggleReportRecordDetails;

function savePreset(tab){
    try {
        const key = `preset_${tab}`;
        let payload = {};
        if (tab==='kpi_correlation'){
            payload = {
                dept: (document.getElementById('correlation-dept-filter')||{}).value||'',
                k1: (document.getElementById('correlation-kpi1-select')||{}).value||'',
                k2: (document.getElementById('correlation-kpi2-select')||{}).value||'',
                period: (document.getElementById('correlation-period')||{}).value||''
            };
        }
        tenantSet(key, JSON.stringify(payload));
        alert('تم حفظ الإعداد');
    } catch {}
}
function loadPreset(tab){
    try {
        const key = `preset_${tab}`;
        const raw = tenantGet(key);
        if (!raw){ alert('لا يوجد إعداد محفوظ'); return; }
        const p = JSON.parse(raw||'{}');
        if (tab==='kpi_correlation'){
            const deptSel = document.getElementById('correlation-dept-filter');
            const k1Sel = document.getElementById('correlation-kpi1-select');
            const k2Sel = document.getElementById('correlation-kpi2-select');
            const perSel = document.getElementById('correlation-period');
            if (deptSel && p.dept){ deptSel.value = p.dept; }
            if (typeof fillCorrelationKpis === 'function') fillCorrelationKpis();
            if (k1Sel && p.k1) k1Sel.value = p.k1;
            if (k2Sel && p.k2) k2Sel.value = p.k2;
            if (perSel && p.period) perSel.value = p.period;
            renderCorrelation();
        }
        alert('تم استعادة الإعداد');
    } catch {}
}

function exportRecordsCSV(){
    const empSel = document.getElementById('records-employee-select');
    if (!empSel || !empSel.value) { alert(translate('alert_no_data_to_export')); return; }
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
        const base = [r.date, Object.keys(r.scores||{}).length, r.totalScore];
        kpiCols.forEach(col => {
            const id = Array.from(kpiSet).find(kid => (kpiMap.get(String(kid)) || String(kid)) === col);
            base.push((r.scores && id && r.scores[id] !== undefined) ? r.scores[id] : '');
        });
        return base;
    });
    const csv = [header.join(','), ...rows.map(r=> r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `records_${empSel.value}.csv`; a.click(); URL.revokeObjectURL(url);
}

function exportReportRecordsCSV(empId){
    const recs = (((performanceRecords||{})[empId])||[]).slice();
    if (!recs.length) { alert(translate('alert_no_data_to_export')); return; }
    const kpiMap = new Map((kpis || []).map(k => [String(k.id), k.name || String(k.id)]));
    const kpiSet = new Set();
    recs.forEach(r => Object.keys(r.scores || {}).forEach(kid => kpiSet.add(kid)));
    const kpiCols = Array.from(kpiSet).map(kid => kpiMap.get(String(kid)) || String(kid));
    const header = ['date','kpis_count','total_score', ...kpiCols];
    const rows = recs.map(r => {
        const base = [r.date, Object.keys(r.scores||{}).length, r.totalScore];
        kpiCols.forEach(col => {
            const id = Array.from(kpiSet).find(kid => (kpiMap.get(String(kid)) || String(kid)) === col);
            base.push((r.scores && id && r.scores[id] !== undefined) ? r.scores[id] : '');
        });
        return base;
    });
    const csv = [header.join(','), ...rows.map(r=> r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `records_${empId}.csv`; a.click(); URL.revokeObjectURL(url);
}

function exportReportRecordsExcel(empId, recs){
    if (!recs || !recs.length) { alert(translate('alert_no_data_to_export')); return; }
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
    XLSX.writeFile(wb, `records_${empId}.xlsx`);
}
function renderCorrelation(){
    const deptId = (document.getElementById('correlation-dept-filter')||{}).value;
    const kpi1 = (document.getElementById('correlation-kpi1-select')||{}).value;
    const kpi2 = (document.getElementById('correlation-kpi2-select')||{}).value;
    const period = parseInt((document.getElementById('correlation-period')||{}).value||'30',10);
    const canvas = document.getElementById('kpi-correlation-chart');
    if (!canvas || typeof Chart==='undefined' || !deptId || !kpi1 || !kpi2) return;
    const ctx = canvas.getContext('2d');
    const today = new Date(); const start=new Date(); start.setDate(today.getDate()-period);
    const emps = (deptId==='all') ? (employees||[]) : (employees||[]).filter(e=> String(e.deptId)===String(deptId));
    const k1Meta = (kpis||[]).find(k=> String(k.id)===String(kpi1));
    const k2Meta = (kpis||[]).find(k=> String(k.id)===String(kpi2));
    const points = emps.map(e=>{
        const recs = ((performanceRecords||{})[e.id]||[]).filter(r=>{ const d=new Date(r.date); return d>=start && d<=today; });
        const vals1 = recs.map(r=>{ const raw=(r.scores||{})[kpi1]; if(raw===undefined) return null; return normalizeScore(raw, k1Meta?.type); }).filter(v=>v!==null);
        const vals2 = recs.map(r=>{ const raw=(r.scores||{})[kpi2]; if(raw===undefined) return null; return normalizeScore(raw, k2Meta?.type); }).filter(v=>v!==null);
        const avg1 = vals1.length? (vals1.reduce((s,v)=>s+v,0)/vals1.length):null;
        const avg2 = vals2.length? (vals2.reduce((s,v)=>s+v,0)/vals2.length):null;
        return { name:e.name, x: avg1, y: avg2 };
    }).filter(p=> p.x!==null && p.y!==null);
    const data = { datasets: [{ label:'ارتباط KPI', data: points.map(p=>({x:p.x,y:p.y})), pointRadius:4, backgroundColor:'#e67e22' }] };
    const opts = { responsive:true, maintainAspectRatio:false, scales:{ x:{ beginAtZero:true, max:100, title:{ display:true, text:(k1Meta?.name||'KPI1') } }, y:{ beginAtZero:true, max:100, title:{ display:true, text:(k2Meta?.name||'KPI2') } } }, plugins:{ tooltip:{ callbacks:{ title:(items)=>{ const i=items[0]?.dataIndex ?? -1; return i>=0? points[i].name:''; }, label:(ctx)=>`(${ctx.parsed.x?.toFixed?.(1)||ctx.parsed.x}, ${ctx.parsed.y?.toFixed?.(1)||ctx.parsed.y})` } }, legend:{ display:false } } };
    if (window._corrChart) window._corrChart.destroy();
    window._corrChart = new Chart(ctx, { type:'scatter', data, options: opts });
    window._corrRows = points.map(p=>({ employee:p.name, kpi1_avg: parseFloat((p.x||0).toFixed(1)), kpi2_avg: parseFloat((p.y||0).toFixed(1)) }));
}
function exportCorrelationExcel(){
    try { const rows=window._corrRows||[]; if(!rows.length){ alert(translate('alert_no_data_to_export')); return; } const ws=XLSX.utils.json_to_sheet(rows); const wb=XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb,ws,'Correlation'); XLSX.writeFile(wb,'kpi_correlation.xlsx'); } catch {}
}

function initCorrelationControls(){
    if (window._corrInit) return;
    const corrDeptSel = document.getElementById('correlation-dept-filter');
    const corrKpi1Sel = document.getElementById('correlation-kpi1-select');
    const corrKpi2Sel = document.getElementById('correlation-kpi2-select');
    const corrPeriodSel = document.getElementById('correlation-period');
    if (!corrDeptSel || !corrKpi1Sel || !corrKpi2Sel) return;
    corrDeptSel.innerHTML = '';
    const optAll = new Option('جميع الأقسام','all');
    corrDeptSel.appendChild(optAll);
    (departments||[]).forEach(d => { corrDeptSel.appendChild(new Option(d.name, d.id)); });
    if (corrDeptSel.options.length>0 && !corrDeptSel.value) corrDeptSel.selectedIndex = 0;
    const fillKpis = () => {
        const deptId = corrDeptSel.value;
        const list = (kpis||[]).filter(k => String(k.deptId)===String(deptId));
        corrKpi1Sel.innerHTML = '';
        corrKpi2Sel.innerHTML = '';
        list.forEach(k => { corrKpi1Sel.appendChild(new Option(k.name,k.id)); corrKpi2Sel.appendChild(new Option(k.name,k.id)); });
        if (corrKpi1Sel.options.length>0 && !corrKpi1Sel.value) corrKpi1Sel.selectedIndex = 0;
        if (corrKpi2Sel.options.length>0 && !corrKpi2Sel.value) corrKpi2Sel.selectedIndex = Math.min(1, corrKpi2Sel.options.length-1);
    };
    fillKpis();
    corrDeptSel.addEventListener('change', () => { fillKpis(); renderCorrelation(); });
    corrKpi1Sel.addEventListener('change', () => renderCorrelation());
    corrKpi2Sel.addEventListener('change', () => renderCorrelation());
    if (corrPeriodSel) corrPeriodSel.addEventListener('change', () => renderCorrelation());
    window._corrInit = true;
}
window.initCorrelationControls = initCorrelationControls;
function renderDeptCompare(){
    const el = document.getElementById('dept-compare-chart');
    if (!el || typeof Chart === 'undefined') return;
    const days = parseInt((document.getElementById('dept-compare-period')||{}).value||'60',10);
    const today = new Date();
    const start = new Date(); start.setDate(today.getDate()-days);
    const data = (departments||[]).map(dept => {
        const emps = (employees||[]).filter(e => String(e.deptId)===String(dept.id));
        let scores=[]; emps.forEach(emp => { ((performanceRecords||{})[emp.id]||[]).forEach(rec => { const d=new Date(rec.date); if (d>=start&&d<=today) scores.push(rec.totalScore||0); }); });
        const avg = scores.length? (scores.reduce((s,v)=>s+v,0)/scores.length):0;
        return {name:dept.name,avg:parseFloat(avg.toFixed(1))};
    }).filter(x=>x.avg>0);
    const ctx = el.getContext('2d');
    window._deptCompareRows = data.map(d=>({ department:d.name, average:d.avg }));
    if (window._deptCompareChart) window._deptCompareChart.destroy();
    const valueLabels = {
        id:'valueLabels',
        afterDatasetsDraw(chart){
            const {ctx} = chart;
            const ds = chart.data.datasets[0].data;
            const meta = chart.getDatasetMeta(0);
            const isDark = document.body.classList.contains('theme-dark');
            const fill = isDark ? '#ffffff' : '#2c3e50';
            const stroke = isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.45)';
            ctx.save();
            ctx.textAlign = 'center';
            ctx.textBaseline = 'bottom';
            ctx.font = '13px Segoe UI';
            meta.data.forEach((bar,i)=>{
                const p = bar.tooltipPosition();
                const v = ds[i];
                const text = `${Number(v).toFixed(1)}%`;
                ctx.strokeStyle = stroke;
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.strokeText(text, p.x, p.y - 10);
                ctx.fillStyle = fill;
                ctx.fillText(text, p.x, p.y - 10);
            });
            ctx.restore();
        }
    };
    window._deptCompareChart = new Chart(ctx,{
        type:'bar',
        data:{ labels:data.map(d=>d.name), datasets:[{ data:data.map(d=>d.avg), backgroundColor:'#0EA5E9' }] },
        options:{ responsive:true, maintainAspectRatio:false, animation:false, scales:{ y:{ beginAtZero:true, max:100 } } , plugins:{ legend:{ display:false }, tooltip:{ enabled:false } } },
        plugins:[valueLabels]
    });
}

function renderKpiDept(){
    const el = document.getElementById('kpi-dept-chart');
    if (!el || typeof Chart === 'undefined') return;
    const deptId = (document.getElementById('kpi-dept-filter')||{}).value;
    const kpiSel = document.getElementById('kpi-dept-select');
    if (kpiSel && deptId) {
        kpiSel.innerHTML='';
        (kpis||[]).filter(k=>String(k.deptId)===String(deptId)).forEach(k=>{ kpiSel.appendChild(new Option(k.name,k.id)); });
    }
    const kpiId = kpiSel ? kpiSel.value : '';
    if (!kpiId) return;
    const ctx = el.getContext('2d');
    const emps = (employees||[]).filter(e=>String(e.deptId)===String(deptId));
    const today=new Date(); const start=new Date(); start.setDate(today.getDate()-30);
    const ds = emps.map(e=>{
        const recs=((performanceRecords||{})[e.id]||[]).filter(r=>{const d=new Date(r.date); return d>=start&&d<=today;});
        const vals=recs.map(r=>{const raw=(r.scores||{})[kpiId]; if(raw===undefined) return null; const k=(kpis||[]).find(x=>String(x.id)===String(kpiId)); return k? normalizeScore(raw,k.type): null;}).filter(v=>v!==null);
        const avg = vals.length? (vals.reduce((s,v)=>s+v,0)/vals.length):0;
        return {name:e.name,avg:parseFloat(avg.toFixed(1))};
    });
    if (window._kpiDeptChart) window._kpiDeptChart.destroy();
    window._kpiDeptRows = ds.map(x=>({ employee:x.name, average:x.avg }));
    const valueLabels = {
        id:'valueLabels',
        afterDatasetsDraw(chart){
            const {ctx} = chart;
            const ds = chart.data.datasets[0].data;
            const meta = chart.getDatasetMeta(0);
            ctx.save();
            ctx.textAlign = 'center';
            ctx.textBaseline = 'bottom';
            ctx.font = '13px Segoe UI';
            meta.data.forEach((bar,i)=>{
                const p = bar.tooltipPosition();
                const v = ds[i];
                const text = `${Number(v).toFixed(1)}%`;
                ctx.strokeStyle = 'rgba(0,0,0,0.45)';
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.strokeText(text, p.x, p.y - 10);
                ctx.fillStyle = '#ffffff';
                ctx.fillText(text, p.x, p.y - 10);
            });
            ctx.restore();
        }
    };
    window._kpiDeptChart = new Chart(ctx,{
        type:'bar',
        data:{ labels:ds.map(x=>x.name), datasets:[{ data:ds.map(x=>x.avg), backgroundColor:'#14B8A6' }] },
        options:{ responsive:true, maintainAspectRatio:false, animation:false, scales:{ y:{ beginAtZero:true, max:100 } }, plugins:{ legend:{ display:false }, tooltip:{ enabled:false } } },
        plugins:[valueLabels]
    });
}

let employeeResultChart;
function renderEmployeeResultTab(){
    const employeeId = (document.getElementById('report-result-employee-select')||{}).value || '';
    const msg = document.getElementById('employee-result-message');
    const scoreCard = document.getElementById('employee-result-score-card');
    const chartContainer = document.getElementById('employee-result-chart-container');
    if (!employeeId){
        if (msg) msg.style.display='block';
        if (scoreCard) scoreCard.style.display='none';
        if (chartContainer) chartContainer.style.display='none';
        return;
    }
    if (msg) msg.style.display='none';
    if (scoreCard) scoreCard.style.display='grid';
    if (chartContainer) chartContainer.style.display='block';
    const thirtyDaysAgo = new Date(); thirtyDaysAgo.setDate(thirtyDaysAgo.getDate()-30);
    const today = new Date();
    const avgScore = calculateAveragePerformance(employeeId, thirtyDaysAgo, today);
    const avgEl = document.getElementById('employee-result-current-score');
    if (avgEl) avgEl.textContent = avgScore !== null ? `${avgScore.toFixed(1)}%` : 'N/A';
    const activeGoal = (goals||[]).find(g => g.status==='active' && String(g.employeeId)===String(employeeId));
    const goalEl = document.getElementById('employee-result-goal-status');
    if (activeGoal){
        const goalKpi = (kpis||[]).find(k => k.id === activeGoal.kpiId);
        const records = (performanceRecords||{})[employeeId] || [];
        const lastRecord = records.length ? records[records.length-1] : null;
        if (lastRecord && goalKpi && lastRecord.scores[activeGoal.kpiId] !== undefined){
            const lastScore = normalizeScore(lastRecord.scores[activeGoal.kpiId], goalKpi.type);
            if (goalEl) goalEl.innerHTML = (lastScore >= activeGoal.target)
                ? `<span style="color:${lastScore>=90?'#2ecc71':'#f39c12'}">${translate('stat_goal_achieved')}</span> (${lastScore.toFixed(1)}% / ${activeGoal.target}%)`
                : `<span style="color:#e74c3c">${translate('stat_goal_behind')}</span> (${lastScore.toFixed(1)}% / ${activeGoal.target}%)`;
        } else { if (goalEl) goalEl.textContent = translate('stat_no_goals'); }
    } else { if (goalEl) goalEl.textContent = translate('stat_no_goals'); }
    const records = ((performanceRecords||{})[employeeId]||[]).slice(-30);
    if (!records.length){ if (chartContainer) chartContainer.style.display='none'; if (msg){ msg.textContent=translate('msg_no_records_in_period'); msg.style.display='block'; } return; }
    const canvas = document.getElementById('employee-result-chart'); if (!canvas || typeof Chart==='undefined') return;
    const ctx = canvas.getContext('2d'); if (employeeResultChart) employeeResultChart.destroy();
    employeeResultChart = new Chart(ctx,{ type:'line', data:{ labels:records.map(r=>r.date), datasets:[{ label:translate('stat_current_score'), data:records.map(r=> (r.totalScore||0).toFixed(1)), borderColor:'#3498db', backgroundColor:'rgba(52,152,219,0.2)', fill:true, tension:0.4 }] }, options:{ responsive:true, maintainAspectRatio:false, scales:{ y:{ beginAtZero:true, max:100, title:{ display:true, text:'النتيجة الموزونة (%)' } } }, plugins:{ legend:{ display:false } } } });
}

function getOrgName(){ try { return tenantGet('ORG_NAME') || 'منظمتك'; } catch { return 'منظمتك'; } }
function getOrgLogo(){ try { return tenantGet('ORG_LOGO_URL') || ''; } catch { return ''; } }
async function updateOrgFromTenantId(tenantId){
    try {
        if (!tenantId) return;
        const snap = await window.db.collection('tenants').doc(String(tenantId)).get();
        const data = snap.exists ? (snap.data()||{}) : {};
        window.__tenantDisabled = !!data.disabled;
        if (window.__tenantDisabled) { try { showBanner('هذه المنشأة معطلة. عمليات الإدارة متوقفة.', 'error'); } catch {} }
        const name = String(data.name||'').trim();
        if (name) { try { tenantSet('ORG_NAME', name); } catch {} }
        const logoUrl = String(data.logoUrl||'').trim();
        if (logoUrl) { try { tenantSet('ORG_LOGO_URL', logoUrl); } catch {} }
        try { if (typeof renderOrgName === 'function') renderOrgName(); } catch {}
    } catch {}
}
window.updateOrgFromTenantId = updateOrgFromTenantId;
function renderOrgName(){
    const el = document.getElementById('org-name-badge');
    const mainEl = document.getElementById('org-name-main');
    if (!el) return;
    const name = getOrgName();
    const logo = getOrgLogo();
    const show = !!(name && String(name).trim());
    el.textContent = show ? String(name).trim() : '';
    el.style.display = show ? '' : 'none';
    if (mainEl) {
        if (show) {
            const safeName = String(name).trim();
            const logoHtml = logo ? `<img src="${logo}" style="height:28px;object-fit:contain;border-radius:4px;">` : '';
            mainEl.innerHTML = `${logoHtml}<span>${safeName}</span>`;
        } else {
            mainEl.innerHTML = '';
        }
        mainEl.style.display = show ? '' : 'none';
    }
    try {
        const base = (typeof translate === 'function') ? translate('app_title') : document.title || '';
        const isOwner = getIsOwner && getIsOwner();
        const suffix = isOwner ? ' — المالك' : '';
        document.title = show ? `${String(name).trim()} — ${base}${suffix}` : `${base}${suffix}`;
    } catch {}
}
window.renderOrgName = renderOrgName;
function initSettingsScreen(){
    const nameEl = document.getElementById('settings-org-name');
    const fileEl = document.getElementById('settings-logo-file');
    const preview = document.getElementById('settings-logo-preview');
    const saveBtn = document.getElementById('settings-save');
    const clearBtn = document.getElementById('settings-clear-logo');
    const orgMsg = document.getElementById('settings-org-msg');
    const userNameEl = document.getElementById('settings-user-name');
    const userSaveBtn = document.getElementById('settings-user-save');
    const userMsg = document.getElementById('settings-user-msg');
    const curPassEl = document.getElementById('current-password');
    const newPassEl = document.getElementById('new-password');
    const confirmPassEl = document.getElementById('confirm-password');
    const changeBtn = document.getElementById('btn-change-password');
    const changeMsg = document.getElementById('password-change-msg');
    const tenantId = localStorage.getItem('TENANT_ID')||'';
    if (nameEl) nameEl.value = getOrgName();
    try {
        const user = (window.auth && window.auth.currentUser) || {};
        if (userNameEl) userNameEl.value = (user.displayName || '').trim();
    } catch {}
    const currentLogo = getOrgLogo();
    if (preview) {
        preview.innerHTML = currentLogo ? `<img src="${currentLogo}" style="max-height:80px;object-fit:contain;">` : '<span style="color:#7f8c8d;">لا يوجد شعار محدد</span>';
    }
    if (tenantId) {
        try {
            window.db.collection('tenants').doc(String(tenantId)).get().then(s=>{
                const d = s.exists ? (s.data()||{}) : {};
                if (nameEl && d.name) nameEl.value = d.name;
                const l = String(d.logoUrl||'').trim();
                if (l) { try { tenantSet('ORG_LOGO_URL', l); } catch {} }
                if (preview) preview.innerHTML = l ? `<img src="${l}" style="max-height:80px;object-fit:contain;">` : preview.innerHTML;
            });
        } catch {}
    }
    if (fileEl) {
        fileEl.onchange = function(){
            const f = fileEl.files && fileEl.files[0];
            if (!f) return;
            const reader = new FileReader();
            reader.onload = function(){ if (preview) preview.innerHTML = `<img src="${reader.result}" style="max-height:80px;object-fit:contain;">`; };
            reader.readAsDataURL(f);
        };
    }
    if (saveBtn) {
        saveBtn.onclick = function(){
            const newName = (nameEl && nameEl.value || '').trim();
            try { tenantSet('ORG_NAME', newName); } catch {}
            const f = fileEl && fileEl.files && fileEl.files[0];
            if (f) {
                const reader = new FileReader();
                reader.onload = async function(){
                    try { tenantSet('ORG_LOGO_URL', reader.result); } catch {}
                    if (tenantId) { try { await window.db.collection('tenants').doc(String(tenantId)).set({ logoUrl: reader.result }, { merge: true }); } catch {} }
                };
                reader.readAsDataURL(f);
            }
            if (tenantId) { try { window.db.collection('tenants').doc(String(tenantId)).set({ name: newName }, { merge: true }); } catch {} }
            if (orgMsg) orgMsg.textContent = 'تم حفظ إعدادات المنشأة.';
            try { if (window.renderOrgName) window.renderOrgName(); } catch {}
        };
    }
    if (clearBtn) {
        clearBtn.onclick = function(){
            try { localStorage.removeItem('ORG_LOGO_URL'); } catch {}
            if (preview) preview.innerHTML = '<span style="color:#7f8c8d;">لا يوجد شعار محدد</span>';
            if (fileEl) fileEl.value = '';
        };
    }

    async function saveUserName(){
        try {
            const user = (window.auth && window.auth.currentUser);
            if (!user) { if (userMsg) userMsg.textContent = 'غير مسجل الدخول.'; return; }
            const name = (userNameEl && userNameEl.value || '').trim();
            
            try { await window.db.collection('users').doc(user.uid).set({ displayName: name }, { merge: true }); } catch {}
            if (userMsg) userMsg.textContent = 'تم حفظ اسم المستخدم.';
            try { const tid = await getTenantIdCurrent(); if (tid) await window.db.collection('tenants').doc(String(tid)).collection('audit_logs').add({ type:'update_display_name', actor_uid:user.uid, actor_email:user.email||'', displayName:name, ts:Date.now() }); } catch {}
            showBanner('تم حفظ اسم المستخدم', 'ok');
        } catch (e) { if (userMsg) userMsg.textContent = 'تعذر الحفظ: ' + (e.code||e.message||''); showBanner('تعذر حفظ اسم المستخدم', 'error'); }
    }
    userSaveBtn && userSaveBtn.addEventListener('click', saveUserName);

    async function changePassword(){
        try {
            const user = (window.auth && window.auth.currentUser);
            if (!user) { changeMsg && (changeMsg.textContent = 'غير مسجل الدخول.'); return; }
            const cur = (curPassEl && curPassEl.value) || '';
            const next = (newPassEl && newPassEl.value) || '';
            const conf = (confirmPassEl && confirmPassEl.value) || '';
            if (!cur || !next || next.length < 6 || next !== conf) { changeMsg && (changeMsg.textContent = 'تحقق من الإدخالات (طول 6+ ومطابقة التأكيد).'); return; }
            const uid = user.uid;
            const ph = await (async function(s){ const enc = new TextEncoder().encode(s); const d = await crypto.subtle.digest('SHA-256', enc); return Array.from(new Uint8Array(d)).map(b=>b.toString(16).padStart(2,'0')).join(''); })(next);
            await window.db.collection('users').doc(uid).set({ passwordHash: ph }, { merge: true });
            changeMsg && (changeMsg.textContent = 'تم تغيير كلمة المرور.');
            try { curPassEl.value=''; newPassEl.value=''; confirmPassEl.value=''; } catch {}
            try { const tid = await getTenantIdCurrent(); if (tid) await window.db.collection('tenants').doc(String(tid)).collection('audit_logs').add({ type:'change_password', actor_uid:user.uid, actor_email:user.email||'', ts:Date.now() }); } catch {}
            showBanner('تم تغيير كلمة المرور', 'ok');
        } catch (e) {
            changeMsg && (changeMsg.textContent = 'تعذر التغيير: ' + (e.code||e.message||''));
            showBanner('تعذر تغيير كلمة المرور', 'error');
        }
    }
    changeBtn && changeBtn.addEventListener('click', changePassword);
}
window.initSettingsScreen = initSettingsScreen;
function buildPrintHeader(title){
    const name = getOrgName(); const logo = getOrgLogo(); const today = new Date().toLocaleString('ar-EG');
    const logoHtml = logo ? `<img src="${logo}" style="height:48px;object-fit:contain;margin-left:10px;">` : '';
    return `<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
              <div style="display:flex;align-items:center;">${logoHtml}<div><div style="font-size:18px;font-weight:700;">${name}</div><div style="color:#7f8c8d;font-size:12px;">${today}</div></div></div>
              <div style="font-size:16px;font-weight:700;">${title||''}</div>
            </div><hr style="margin:8px 0;">`;
}
function buildPrintStyles(){
    const isAr = (typeof currentLanguage !== 'undefined') ? currentLanguage === 'ar' : true;
    const dir = isAr ? 'rtl' : 'ltr';
    const align = isAr ? 'right' : 'left';
    const font = isAr ? "'Cairo','Segoe UI',Tahoma,Geneva,Verdana,sans-serif" : "'Segoe UI',Tahoma,Geneva,Verdana,sans-serif";
    return `@page{size:A4;margin:12mm;} body{font-family:${font};direction:${dir};} h1,h2,h3{margin:0 0 8px 0;font-weight:800} table{width:100%;border-collapse:collapse;page-break-inside:auto} thead{display:table-header-group} tfoot{display:table-footer-group} th,td{border:1px solid #ccc;padding:6px;text-align:${align}} th{background:#34495e;color:#fff}`;
}
function printSection(sectionId,title){
    try { const el=document.getElementById(sectionId); if(!el) return; const w=window.open('','_blank'); w.document.write(`<html><head><title>Print</title><style>${buildPrintStyles()}</style></head><body>${buildPrintHeader(title)}${el.innerHTML}</body></html>`); w.document.close(); w.focus(); w.print(); w.close(); } catch {}
}
function printTable(tableId,title){
    try { const el=document.getElementById(tableId); if(!el) return; const w=window.open('','_blank'); w.document.write(`<html><head><title>Print</title><style>${buildPrintStyles()}</style></head><body>${buildPrintHeader(title)}${el.outerHTML}</body></html>`); w.document.close(); w.focus(); w.print(); w.close(); } catch {}
}
function printCanvas(canvasId,title){
    try { const c=document.getElementById(canvasId); if(!c) return; const data=c.toDataURL('image/png'); const w=window.open('','_blank'); w.document.write(`<html><head><title>${title||'Chart'}</title><style>${buildPrintStyles()}</style></head><body>${buildPrintHeader(title)}<img src="${data}" style="max-width:100%"/></body></html>`); w.document.close(); w.focus(); w.print(); w.close(); } catch {}
}

function printSection(sectionId,title){ try { const el=document.getElementById(sectionId); if(!el) return; const w=window.open('','_blank'); w.document.write(`<html><head><title>Print</title><style>${buildPrintStyles()}</style></head><body>${buildPrintHeader(title)}${el.innerHTML}</body></html>`); w.document.close(); w.focus(); w.print(); w.close(); } catch {} }
function printTable(tableId,title){ try { const el=document.getElementById(tableId); if(!el) return; const w=window.open('','_blank'); w.document.write(`<html><head><title>Print</title><style>${buildPrintStyles()}</style></head><body>${buildPrintHeader(title)}${el.outerHTML}</body></html>`); w.document.close(); w.focus(); w.print(); w.close(); } catch {} }
function printCanvas(canvasId,title){ try { const c=document.getElementById(canvasId); if(!c) return; const data=c.toDataURL('image/png'); const w=window.open('','_blank'); w.document.write(`<html><head><title>${title||'Chart'}</title><style>${buildPrintStyles()}</style></head><body>${buildPrintHeader(title)}<img src="${data}" style="max-width:100%"/></body></html>`); w.document.close(); w.focus(); w.print(); w.close(); } catch {} }
function exportDeptCompareExcel(){
    try { const rows=window._deptCompareRows||[]; if(!rows.length){ alert(translate('alert_no_data_to_export')); return; } const ws=XLSX.utils.json_to_sheet(rows); const wb=XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb,ws,'DeptCompare'); XLSX.writeFile(wb,'dept_compare.xlsx'); } catch {}
}
function exportKpiDeptExcel(){
    try { const rows=window._kpiDeptRows||[]; if(!rows.length){ alert(translate('alert_no_data_to_export')); return; } const ws=XLSX.utils.json_to_sheet(rows); const wb=XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb,ws,'KPIDept'); XLSX.writeFile(wb,'kpi_dept.xlsx'); } catch {}
}
function exportOverallExcel(){
    try { const el=document.getElementById('overall-report-output'); if(!el){ alert(translate('alert_no_data_to_export')); return; } const text=el.innerText.trim(); if(!text){ alert(translate('alert_no_data_to_export')); return; } const ws=XLSX.utils.aoa_to_sheet([[text]]); const wb=XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb,ws,'Overall'); XLSX.writeFile(wb,'overall_report.xlsx'); } catch {}
}
function exportTextSectionExcel(elementId, filename){
    try { const el=document.getElementById(elementId); if(!el){ alert(translate('alert_no_data_to_export')); return; } const text=el.innerText.trim(); if(!text){ alert(translate('alert_no_data_to_export')); return; } const ws=XLSX.utils.aoa_to_sheet([[text]]); const wb=XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb,ws,'Summary'); XLSX.writeFile(wb, filename||'summary.xlsx'); } catch {}
}
    // Populate Employee Records tab employees based on dept
    function updateRecordsTabEmployeeSelect(){
        const select = document.getElementById('records-tab-employee');
        const deptSel = document.getElementById('records-tab-dept');
        if (!select || !deptSel) return;
        select.innerHTML = '';
        select.appendChild(new Option(translate('select_emp_placeholder'), ''));
        const deptVal = deptSel.value || 'all';
        const list = deptVal === 'all' ? (employees||[]) : (employees||[]).filter(e => String(e.deptId) === String(deptVal));
        list.forEach(emp => select.appendChild(new Option(emp.name, emp.id)));
        if (select.options.length > 1 && !select.value) select.value = select.options[1].value;
    }
    window.updateRecordsTabEmployeeSelect = updateRecordsTabEmployeeSelect;
    updateRecordsTabEmployeeSelect();
    const corrDeptSel = document.getElementById('correlation-dept-filter');
    if (corrDeptSel) {
        corrDeptSel.innerHTML = '';
        (departments||[]).forEach(d => { corrDeptSel.appendChild(new Option(d.name, d.id)); });
        if (corrDeptSel.options.length > 0 && !corrDeptSel.value) corrDeptSel.selectedIndex = 0;
        corrDeptSel.addEventListener('change', () => { fillCorrelationKpis(); renderCorrelation(); });
    }
    const corrKpi1Sel = document.getElementById('correlation-kpi1-select');
    const corrKpi2Sel = document.getElementById('correlation-kpi2-select');
    const corrPeriodSel = document.getElementById('correlation-period');
    function fillCorrelationKpis(){
        if (!corrDeptSel || !corrKpi1Sel || !corrKpi2Sel) return;
        const deptId = corrDeptSel.value;
        const list = (kpis||[]).filter(k => String(k.deptId)===String(deptId));
        corrKpi1Sel.innerHTML = '';
        corrKpi2Sel.innerHTML = '';
        list.forEach(k => { corrKpi1Sel.appendChild(new Option(k.name,k.id)); corrKpi2Sel.appendChild(new Option(k.name,k.id)); });
        if (corrKpi1Sel.options.length > 0 && !corrKpi1Sel.value) corrKpi1Sel.selectedIndex = 0;
        if (corrKpi2Sel.options.length > 0 && !corrKpi2Sel.value) corrKpi2Sel.selectedIndex = Math.min(1, corrKpi2Sel.options.length-1);
    }
    if (corrDeptSel && corrKpi1Sel && corrKpi2Sel) {
        fillCorrelationKpis();
        corrKpi1Sel.addEventListener('change', () => renderCorrelation());
        corrKpi2Sel.addEventListener('change', () => renderCorrelation());
        if (corrPeriodSel) corrPeriodSel.addEventListener('change', () => renderCorrelation());
    }
    const corrExportBtn = document.getElementById('correlation-export');
    const corrPrintBtn = document.getElementById('correlation-print');
    if (corrExportBtn) corrExportBtn.onclick = function(){ exportCorrelationExcel(); };
    if (corrPrintBtn) corrPrintBtn.onclick = function(){
        const deptId = (document.getElementById('correlation-dept-filter')||{}).value;
        const deptName = (departments||[]).find(d=> String(d.id)===String(deptId))?.name || '';
        const k1 = (document.getElementById('correlation-kpi1-select')||{}).value;
        const k2 = (document.getElementById('correlation-kpi2-select')||{}).value;
        const k1Name = (kpis||[]).find(k=> String(k.id)===String(k1))?.name || '';
        const k2Name = (kpis||[]).find(k=> String(k.id)===String(k2))?.name || '';
        const title = `ارتباط مؤشرين — القسم: ${deptName} — ${k1Name} مقابل ${k2Name}`;
        printCanvas('kpi-correlation-chart', title);
    };
    const corrSaveBtn = document.getElementById('correlation-save');
    const corrLoadBtn = document.getElementById('correlation-load');
    if (corrSaveBtn) corrSaveBtn.onclick = function(){ savePreset('kpi_correlation'); };
    if (corrLoadBtn) corrLoadBtn.onclick = function(){ loadPreset('kpi_correlation'); };

    const heatDeptSel = document.getElementById('heatmap-dept-filter');
    const heatPeriodSel = document.getElementById('heatmap-period');
    if (heatDeptSel) {
        heatDeptSel.innerHTML = '';
        (departments||[]).forEach(d => { heatDeptSel.appendChild(new Option(d.name, d.id)); });
        heatDeptSel.addEventListener('change', () => renderWeekdayHeatmap());
    }
    if (heatPeriodSel) heatPeriodSel.addEventListener('change', () => renderWeekdayHeatmap());
    const heatExportBtn = document.getElementById('heatmap-export');
    const heatPrintBtn = document.getElementById('heatmap-print');
    if (heatExportBtn) heatExportBtn.onclick = function(){ exportWeekdayHeatmapExcel(); };
    if (heatPrintBtn) heatPrintBtn.onclick = function(){ printTable('weekday-heatmap-table','خريطة أيام الأسبوع'); };
    try { renderWeekdayHeatmap(); } catch {}
function updateReportsActions(tab){
    const expBtn = document.getElementById('rc-export');
    const prnBtn = document.getElementById('rc-print');
    if (!expBtn || !prnBtn) return;
    const set = (expHandler, prnHandler, expText, prnText, showExp=true, showPrn=true) => {
        expBtn.onclick = expHandler || null;
        prnBtn.onclick = prnHandler || null;
        expBtn.textContent = expText || 'تصدير';
        prnBtn.textContent = prnText || 'طباعة';
        expBtn.style.display = showExp ? '' : 'none';
        prnBtn.style.display = showPrn ? '' : 'none';
    };
    if (tab === 'employee') {
        set(() => exportReport('Excel'), () => printReport(), 'تصدير Excel', 'طباعة التقرير');
    } else if (tab === 'employee_records') {
        const e = document.getElementById('records-tab-export');
        const p = document.getElementById('records-tab-print');
        set(() => e && e.click(), () => p && p.click(), 'تصدير Excel', 'طباعة الجدول');
    } else if (tab === 'overall') {
        const e = document.getElementById('overall-export');
        const p = document.getElementById('overall-print');
        set(() => e && e.click(), () => p && p.click(), 'تصدير', 'طباعة');
    } else if (tab === 'dept_compare') {
        const e = document.getElementById('dept-compare-export');
        const p = document.getElementById('dept-compare-print');
        set(() => e && e.click(), () => p && p.click(), 'تصدير', 'طباعة الرسم');
    } else if (tab === 'kpi_dept') {
        const e = document.getElementById('kpi-dept-export');
        const p = document.getElementById('kpi-dept-print');
        set(() => e && e.click(), () => p && p.click(), 'تصدير', 'طباعة الرسم');
    } else if (tab === 'employee_result') {
        set(null, () => printCanvas('employee-result-chart','نتيجة التقييم للموظف'), null, 'طباعة الرسم', false, true);
    } else if (tab === 'kpi_correlation') {
        const e = document.getElementById('correlation-export');
        const p = document.getElementById('correlation-print');
        set(() => e && e.click(), () => p && p.click(), 'تصدير', 'طباعة الرسم');
    } else if (tab === 'weekday_heatmap') {
        const e = document.getElementById('heatmap-export');
        const p = document.getElementById('heatmap-print');
        set(() => e && e.click(), () => p && p.click(), 'تصدير', 'طباعة الجدول');
    } else {
        set(null, null, null, null, false, false);
    }
}
function getIsOwner(){
    try {
        return String(localStorage.getItem('IS_OWNER')) === 'true';
    } catch { return false; }
}

async function initOwnerScreen(){
    const table = document.getElementById('owner-tenants-table');
    const refreshBtn = document.getElementById('owner-refresh');
    const deleteAllBtn = document.getElementById('owner-delete-all-users');
    const status = document.getElementById('owner-status');
    if (!getIsOwner()) { if (status) status.textContent = 'ليست لديك صلاحية المالك.'; if (table) table.innerHTML = ''; return; }
    async function fetchTenants(){
        try {
            let rows = [];
            try {
                const qs = await window.db.collection('tenants').orderBy('createdAt','desc').limit(200).get();
                rows = qs.docs.map(d => { const v = d.data()||{}; return { id:d.id, name:v.name||'', ownerUid:v.ownerUid||'', ownerUsername: v.ownerUsername||'', createdAt:v.createdAt||0, disabled: !!v.disabled }; });
            } catch (e) {
                rows = [];
            }
            if (!rows.length) {
                try {
                    const usersSnap = await window.db.collection('users').limit(1000).get();
                    const seen = {};
                    const tids = usersSnap.docs.map(d => (d.data()||{}).tenantId || '').filter(t => !!t && !seen[t] && (seen[t]=true));
                    const tenantDocs = await Promise.all(tids.map(async t => { try { const s = await window.db.collection('tenants').doc(String(t)).get(); return { id:t, data: s.exists ? (s.data()||{}) : {} }; } catch { return { id:t, data:{} }; } }));
                    rows = tenantDocs.map(x => ({ id:x.id, name:x.data.name||'', ownerUid:x.data.ownerUid||'', ownerUsername: x.data.ownerUsername||'', createdAt:x.data.createdAt||0, disabled: !!x.data.disabled }));
                } catch {}
            }
            if (!rows.length) {
                try {
                    const tid = localStorage.getItem('TENANT_ID')||'';
                    const name = (localStorage.getItem('ORG_NAME')||'').trim();
                    if (tid) rows = [{ id: tid, name: name, ownerUid: (window.auth&&window.auth.currentUser||{}).uid||'', createdAt: 0, disabled: false }];
                } catch {}
            }
            const me = (window.auth && window.auth.currentUser) || {};
            const meTag = String(me.username || me.uid || '');
            rows = rows.filter(r => String(r.ownerUsername || r.ownerUid || '') !== meTag);
            table.innerHTML = '<thead><tr><th>Tenant ID</th><th>الاسم</th><th>المالك</th><th>الحالة</th><th>إجراءات</th></tr></thead><tbody></tbody>';
            const tb = table.querySelector('tbody');
            rows.forEach(r => {
                const tr = document.createElement('tr');
                const state = r.disabled ? 'معطل' : 'نشط';
                tr.innerHTML = `<td>${r.id}</td><td>${r.name}</td><td>${r.ownerUsername||r.ownerUid}</td><td>${state}</td>
                                <td>
                                  <button type="button" onclick="ownerImpersonate('${r.id}')">دخول كمستأجر</button>
                                  <button type="button" onclick="ownerToggleTenant('${r.id}', ${!r.disabled})">${r.disabled?'تمكين':'تعطيل'}</button>
                                  <button type="button" onclick="ownerDeleteTenant('${r.id}')">حذف</button>
                                </td>`;
                tb.appendChild(tr);
            });
            if (status) status.textContent = `إجمالي: ${rows.length}`;
        } catch (e) { if (status) status.textContent = 'تعذر جلب المنشآت'; }
    }
    refreshBtn && refreshBtn.addEventListener('click', fetchTenants);
    deleteAllBtn && deleteAllBtn.addEventListener('click', ownerDeleteAllUsers);
    fetchTenants();
}
window.initOwnerScreen = initOwnerScreen;

async function ownerImpersonate(tenantId){
    try { localStorage.setItem('TENANT_ID', tenantId); } catch {}
    try { await updateOrgFromTenantId(tenantId); } catch {}
    try { loadDataFromStorage(); } catch {}
    alert('تم ضبط المستأجر الحالي. افتح الشاشات الآن للعمل على هذه المنشأة.');
}
window.ownerImpersonate = ownerImpersonate;

async function ownerToggleTenant(tenantId, disable){
    try {
        await window.db.collection('tenants').doc(tenantId).set({ disabled: !!disable }, { merge: true });
        try { const u=(window.auth.currentUser||{}); await window.db.collection('tenants').doc(tenantId).collection('audit_logs').add({ type:disable?'owner_disable_tenant':'owner_enable_tenant', actor_uid:u.uid||'', actor_email:u.email||'', ts:Date.now() }); } catch {}
        alert(disable?'تم تعطيل المنشأة.':'تم تمكين المنشأة.');
        if (typeof initOwnerScreen==='function') initOwnerScreen();
    } catch (e) { alert('تعذر تغيير حالة المنشأة: ' + (e.code||e.message||'')); }
}
window.ownerToggleTenant = ownerToggleTenant;
async function ownerDeleteAllUsersExceptMain(){
    try {
        if (!getIsOwner()) { alert('هذه العملية متاحة لحساب المالك فقط.'); return; }
        const ok = confirm('سيتم حذف كل المستخدمين غير الحساب الرئيسي. هل تريد المتابعة؟');
        if (!ok) return;
        const MAIN = 'eltorky1983@gmail.com';
        const qs = await window.db.collection('users').limit(1000).get();
        let count = 0;
        const batch = window.db.batch();
        qs.docs.forEach(d => {
            const v = d.data()||{};
            const email = String(v.email||'').toLowerCase();
            if (email && email !== MAIN) {
                batch.delete(d.ref);
                count++;
                try { window.db.collection('blocked_emails').doc(email).set({ blocked: true, ts: Date.now(), by: (window.auth&&window.auth.currentUser||{}).uid||'' }, { merge: true }); } catch {}
                try { const t = v.tenantId||''; if (t) window.db.collection('tenants').doc(String(t)).collection('audit_logs').add({ type:'owner_bulk_delete_user', actor_uid:(window.auth&&window.auth.currentUser||{}).uid||'', actor_email:(window.auth&&window.auth.currentUser||{}).email||'', target_email: email, ts: Date.now() }); } catch {}
            }
        });
        await batch.commit();
        alert('تم حذف ' + count + ' مستخدم غير رئيسي من قاعدة البيانات وتم حظر بريدهم من الدخول.');
        if (typeof initOwnerScreen==='function') initOwnerScreen();
    } catch (e) { alert('تعذر تنفيذ الحذف الجماعي: ' + (e.code||e.message||'')); }
}
window.ownerDeleteAllUsersExceptMain = ownerDeleteAllUsersExceptMain;
async function ownerDeleteAllUsers(){
    try {
        if (!getIsOwner()) { alert('هذه العملية متاحة لحساب المالك فقط.'); return; }
        const ok = confirm('سيتم حذف كل المستخدمين من قاعدة البيانات. هل تريد المتابعة؟');
        if (!ok) return;
        const qs = await window.db.collection('users').limit(1000).get();
        let count = 0;
        const batch = window.db.batch();
        qs.docs.forEach(d => {
            const v = d.data()||{};
            const email = String(v.email||'').toLowerCase();
            batch.delete(d.ref);
            count++;
            try { if (email) window.db.collection('blocked_emails').doc(email).set({ blocked: true, ts: Date.now(), by: (window.auth&&window.auth.currentUser||{}).uid||'' }, { merge: true }); } catch {}
            try { const t = v.tenantId||''; if (t) window.db.collection('tenants').doc(String(t)).collection('audit_logs').add({ type:'owner_bulk_delete_user_all', actor_uid:(window.auth&&window.auth.currentUser||{}).uid||'', actor_email:(window.auth&&window.auth.currentUser||{}).email||'', target_email: email, ts: Date.now() }); } catch {}
        });
        await batch.commit();
        alert('تم حذف ' + count + ' مستخدم من قاعدة البيانات وتم حظر بريدهم من الدخول.');
        if (typeof initOwnerScreen==='function') initOwnerScreen();
    } catch (e) { alert('تعذر تنفيذ الحذف الجماعي: ' + (e.code||e.message||'')); }
}
window.ownerDeleteAllUsers = ownerDeleteAllUsers;
async function ownerDeleteTenant(tenantId){
    try {
        if (!getIsOwner()) { alert('هذه العملية متاحة لحساب المالك فقط.'); return; }
        const ok = confirm('تأكيد حذف المنشأة؟ سيتم حذف بيانات المنشأة وقائمة المستخدمين المرتبطين بها من قاعدة البيانات.');
        if (!ok) return;
        try { const u=(window.auth.currentUser||{}); await window.db.collection('tenants').doc(tenantId).collection('audit_logs').add({ type:'owner_delete_tenant_initiated', actor_uid:u.uid||'', actor_email:u.email||'', ts:Date.now() }); } catch {}
        try {
            const qsUsers = await window.db.collection('users').where('tenantId','==',tenantId).limit(500).get();
            const batch = window.db.batch();
            qsUsers.docs.forEach(d => batch.delete(d.ref));
            await batch.commit();
        } catch {}
        try {
            const qsLogs = await window.db.collection('tenants').doc(tenantId).collection('audit_logs').limit(500).get();
            const batch2 = window.db.batch();
            qsLogs.docs.forEach(d => batch2.delete(d.ref));
            await batch2.commit();
        } catch {}
        await window.db.collection('tenants').doc(tenantId).delete();
        alert('تم حذف المنشأة بنجاح.');
        if (typeof initOwnerScreen==='function') initOwnerScreen();
    } catch (e) { alert('تعذر حذف المنشأة: ' + (e.code||e.message||'')); }
}
window.ownerDeleteTenant = ownerDeleteTenant;
function setOwnerTheme(isOwner){
    const body = document.body;
    const html = document.documentElement;
    if (!body || !html) return;
    if (isOwner) { body.classList.add('owner-mode'); html.classList.add('owner-mode'); }
    else { body.classList.remove('owner-mode'); html.classList.remove('owner-mode'); }
    const sidebar = document.querySelector('.sidebar');
    const account = document.getElementById('account-actions');
    const orgMain = document.getElementById('org-name-main');
    if (isOwner) {
        if (sidebar) { sidebar.style.background = 'linear-gradient(180deg, #0b1220 0%, #16213e 100%)'; sidebar.style.borderRight = '4px solid #d4af37'; }
        if (account) { account.style.border = '1px solid #d4af37'; account.style.borderRadius = '10px'; account.style.padding = '8px'; account.style.background = 'rgba(212,175,55,0.10)'; }
        if (orgMain) { orgMain.style.borderColor = '#d4af37'; orgMain.style.background = 'rgba(212,175,55,0.12)'; orgMain.style.color = '#fef3c7'; }
    } else {
        if (sidebar) { sidebar.style.background = ''; sidebar.style.borderRight = ''; }
        if (account) { account.style.border = ''; account.style.borderRadius = ''; account.style.padding = ''; account.style.background = ''; }
        if (orgMain) { orgMain.style.borderColor = ''; orgMain.style.background = ''; orgMain.style.color = ''; }
    }
}
 
