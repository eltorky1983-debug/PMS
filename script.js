// ====================================================================================
// 1. البيانات الأساسية (Data)
// ====================================================================================

// RBAC helpers and data initialization
let departments = JSON.parse(localStorage.getItem('departments') || '[]');
let employees = JSON.parse(localStorage.getItem('employees') || '[]');
let kpis = JSON.parse(localStorage.getItem('kpis') || '[]');
let goals = JSON.parse(localStorage.getItem('goals') || '[]');
let performanceRecords = JSON.parse(localStorage.getItem('performanceRecords') || '{}');

function saveData(key, data) {
    localStorage.setItem(key, JSON.stringify(data));
}

function loadData(key, fallback) {
    try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : fallback;
    } catch {
        return fallback;
    }
}

function commitChanges() {
    saveData('departments', departments);
    saveData('employees', employees);
    saveData('kpis', kpis);
    saveData('goals', goals);
    saveData('performanceRecords', performanceRecords);
}

const ROLE_PERMISSIONS = {
  super_admin: ['manage_departments','manage_employees','manage_kpis','manage_records','view_reports','manage_goals','view_dashboard','manage_data'],
  admin: ['manage_departments','manage_employees','manage_kpis','manage_records','view_reports','manage_goals','view_dashboard','manage_data'],
  manager: ['manage_records','view_reports','view_dashboard'],
  hr: ['manage_employees','view_reports','view_dashboard'],
  data_entry: ['manage_records','view_dashboard'],
  viewer: ['view_reports','view_dashboard']
};

function getCurrentRole() {
    return localStorage.getItem('currentRole') || 'viewer';
}

function getManagerDeptId() {
    return localStorage.getItem('managerDeptId') || '';
}

function getAllPermissions() {
    return ['manage_departments','manage_employees','manage_kpis','manage_records','manage_goals','view_reports','view_dashboard','manage_data'];
}

function getCustomRolePermissions() {
    try {
        return JSON.parse(localStorage.getItem('customRolePermissions') || '{}');
    } catch {
        return {};
    }
}

function setCustomRolePermissions(map) {
    localStorage.setItem('customRolePermissions', JSON.stringify(map || {}));
}

function getRolePermissions(role) {
    const custom = getCustomRolePermissions();
    if (custom && custom[role] && Array.isArray(custom[role])) {
        return custom[role];
    }
    return ROLE_PERMISSIONS[role] || [];
}

function hasPermission(permission) {
    const role = getCurrentRole();
    const perms = getRolePermissions(role);
    return perms.includes(permission);
}

function applyRolePermissions() {
    const role = getCurrentRole();
    const canManageDepartments = hasPermission('manage_departments');
    const canManageEmployees = hasPermission('manage_employees');
    const canManageKpis = hasPermission('manage_kpis');
    const canManageRecords = hasPermission('manage_records');

    // Toggle menu items
    const menuMap = [
      { id: 'menu-departments', allowed: canManageDepartments || role !== 'viewer' },
      { id: 'menu-employees', allowed: canManageEmployees || role !== 'viewer' },
      { id: 'menu-kpis', allowed: canManageKpis || role !== 'viewer' },
      { id: 'menu-goals', allowed: hasPermission('manage_goals') || role !== 'viewer' },
      { id: 'menu-data-mgmt', allowed: hasPermission('manage_data') },
    ];
    menuMap.forEach(({id, allowed}) => {
        const el = document.getElementById(id);
        if (el) el.style.display = allowed ? '' : 'none';
    });

    // Hide edit/delete buttons when not permitted per screen
    document.querySelectorAll('#departments-screen .btn-edit, #departments-screen .btn-delete').forEach(btn => {
        btn.style.display = canManageDepartments ? '' : 'none';
    });
    document.querySelectorAll('#employees-screen .btn-edit, #employees-screen .btn-delete').forEach(btn => {
        btn.style.display = canManageEmployees ? '' : 'none';
    });
    document.querySelectorAll('#kpis-screen .btn-edit, #kpis-screen .btn-delete').forEach(btn => {
        btn.style.display = canManageKpis ? '' : 'none';
    });
    document.querySelectorAll('#records-list-screen .btn-edit, #records-list-screen .btn-delete, #record-screen .btn-save, #record-screen .btn-delete').forEach(btn => {
        btn.style.display = canManageRecords ? '' : 'none';
    });
}

function renderRolePermissionCheckboxes(role) {
    const container = document.getElementById('role-perms-container');
    if (!container) return;
    const currentPerms = getRolePermissions(role);
    const checkboxes = container.querySelectorAll('input[type="checkbox"][data-perm]');
    checkboxes.forEach(cb => {
        const perm = cb.getAttribute('data-perm');
        cb.checked = currentPerms.includes(perm);
    });
}

function initRolesPage() {
    const roleSelect = document.getElementById('role-select');
    const deptSelect = document.getElementById('role-dept-id');
    const savedRole = getCurrentRole();
    if (roleSelect) roleSelect.value = savedRole;

    // populate departments
    if (deptSelect) {
        deptSelect.innerHTML = '';
        (departments || []).forEach(dept => {
            const opt = document.createElement('option');
            opt.value = String(dept.id);
            opt.textContent = dept.name;
            deptSelect.appendChild(opt);
        });
        const savedDept = getManagerDeptId();
        if (savedDept) deptSelect.value = String(savedDept);
    }

    // show/hide dept link for manager role
    const label = document.getElementById('role-dept-label');
    const showDeptLink = roleSelect && roleSelect.value === 'manager';
    if (label) label.style.display = showDeptLink ? '' : 'none';
    if (deptSelect) deptSelect.style.display = showDeptLink ? '' : 'none';

    // populate permissions checkboxes
    if (roleSelect) renderRolePermissionCheckboxes(roleSelect.value);
}

function handleRoleSelectChange() {
    const roleSelect = document.getElementById('role-select');
    const deptSelect = document.getElementById('role-dept-id');
    const role = roleSelect ? roleSelect.value : 'viewer';

    // Toggle manager department link visibility based on selected role
    const label = document.getElementById('role-dept-label');
    const showDeptLink = role === 'manager';
    if (label) label.style.display = showDeptLink ? '' : 'none';
    if (deptSelect) deptSelect.style.display = showDeptLink ? '' : 'none';

    // Update permission checkboxes to reflect selected role
    renderRolePermissionCheckboxes(role);
}

function saveRoleSettings() {
    const roleSelect = document.getElementById('role-select');
    const deptSelect = document.getElementById('role-dept-id');
    const selectedRole = roleSelect ? roleSelect.value : 'viewer';

    // store selected role
    localStorage.setItem('currentRole', selectedRole);

    // link manager to dept
    if (deptSelect && selectedRole === 'manager') {
        localStorage.setItem('managerDeptId', deptSelect.value || '');
    } else {
        localStorage.removeItem('managerDeptId');
    }

    // collect custom permissions from checkboxes
    const container = document.getElementById('role-perms-container');
    if (container) {
        const checkboxes = Array.from(container.querySelectorAll('input[type="checkbox"][data-perm]'));
        const selectedPerms = checkboxes.filter(cb => cb.checked).map(cb => cb.getAttribute('data-perm'));
        const custom = getCustomRolePermissions();
        custom[selectedRole] = selectedPerms;
        setCustomRolePermissions(custom);
    }

    // re-apply permissions to UI and refresh current screen
    applyRolePermissions();
    alert(translate('roles_saved'));
    const currentScreen = document.querySelector('.screen[style*="block"]')?.id || 'dashboard-screen';
    showScreen(currentScreen);
}

/**
 * جلب البيانات الأساسية.
 */
function getData() {
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

// ====================================================================================
// 2. الأقسام (Departments)
// ====================================================================================

/**
 * عرض قائمة الأقسام في الجدول.
 */
function renderDepartments() {
    const tableBody = document.querySelector('#departments-table tbody');
    if (!tableBody) return;
    tableBody.innerHTML = '';

    const role = getCurrentRole();
    const managerDeptId = getManagerDeptId();
    let visibleDepts = departments || [];

    if (role === 'manager' && managerDeptId) {
        visibleDepts = visibleDepts.filter(d => String(d.id) === String(managerDeptId));
    }

    const canManage = hasPermission('manage_departments');

    visibleDepts.forEach(dept => {
        const row = tableBody.insertRow();
        const actions = canManage ? `
                <button class="btn-edit" onclick="editDepartment(${dept.id})" data-i18n="btn_edit">${translate('btn_edit')}</button>
                <button class="btn-delete" onclick="deleteDepartment(${dept.id})" data-i18n="btn_delete">${translate('btn_delete')}</button>
            ` : '';
        row.innerHTML = `
            <td>${dept.name}</td>
            <td>${dept.id}</td>
            <td>${actions}</td>
        `;
    });

    applyRolePermissions();
}

/**
 * تهيئة نموذج التعديل.
 * @param {number} id - مُعرّف القسم.
 */
function editDepartment(id) {
    const dept = departments.find(d => d.id === id);
    if (dept) {
        document.getElementById('dept-id-to-edit').value = id;
        document.getElementById('dept-name').value = dept.name;
        document.getElementById('dept-id').value = dept.id;
        document.getElementById('dept-weight').value = dept.weight;

        document.getElementById('save-dept-button').textContent = translate('btn_save');
        document.getElementById('cancel-dept-edit').style.display = 'inline-block';
    }
}

/**
 * حذف قسم.
 * @param {number} id - مُعرّف القسم.
 */
function deleteDepartment(id) {
    if (!confirm(translate('alert_delete_confirm'))) return;

    departments = departments.filter(d => d.id !== id);
    commitChanges();
    renderDepartments();
}

// ====================================================================================
// 3. الموظفين (Employees)
// ====================================================================================

/**
 * عرض قائمة الموظفين في الجدول.
 */
function renderEmployees() {
    const tableBody = document.querySelector('#employees-table tbody');
    if (!tableBody) return;
    tableBody.innerHTML = '';

    const role = getCurrentRole();
    const managerDeptId = getManagerDeptId();
    let visibleEmployees = employees || [];
    if (role === 'manager' && managerDeptId) {
        visibleEmployees = visibleEmployees.filter(e => String(e.deptId) === String(managerDeptId));
    }

    const canManage = hasPermission('manage_employees');

    visibleEmployees.forEach(emp => {
        const row = tableBody.insertRow();
        const actions = canManage ? `
                <button class="btn-edit" onclick="editEmployee(${emp.id})" data-i18n="btn_edit">${translate('btn_edit')}</button>
                <button class="btn-delete" onclick="deleteEmployee(${emp.id})" data-i18n="btn_delete">${translate('btn_delete')}</button>
            ` : '';
        row.innerHTML = `
            <td>${emp.name}</td>
            <td>${emp.id}</td>
            <td>${actions}</td>
        `;
    });

    applyRolePermissions();
}

/**
 * تهيئة نموذج التعديل.
 * @param {number} id - مُعرّف الموظف.
 */
function editEmployee(id) {
    const emp = employees.find(e => e.id === id);
    if (emp) {
        document.getElementById('emp-id-to-edit').value = id;
        document.getElementById('emp-name').value = emp.name;
        document.getElementById('emp-dept-id').value = emp.deptId;

        document.getElementById('save-emp-button').textContent = translate('btn_save');
        document.getElementById('cancel-emp-edit').style.display = 'inline-block';
    }
}

/**
 * حذف موظف.
 * @param {number} id - مُعرّف الموظف.
 */
function deleteEmployee(id) {
    if (!confirm(translate('alert_delete_confirm'))) return;

    employees = employees.filter(e => e.id !== id);
    // حذف أي أهداف مرتبطة بهذا الموظف
    goals = goals.filter(g => g.kpiId !== id);

    // لا حاجة لحذف السجلات، لكن سيتم تجاهل هذا الموظف في الحسابات المستقبلية

    commitChanges();
    renderEmployees();
}

// ====================================================================================
// 4. المؤشرات الأداء (KPIs)
// ====================================================================================

/**
 * عرض قائمة المؤشرات الأداء في الجدول.
 */
function renderKPIs() {
    const tableBody = document.querySelector('#kpis-table tbody');
    if (!tableBody) return;
    tableBody.innerHTML = '';

    const role = getCurrentRole();
    const managerDeptId = getManagerDeptId();
    const canManage = hasPermission('manage_kpis');

    // Filter KPIs: managers see general + their department
    let visibleKpis = kpis || [];
    if (role === 'manager' && managerDeptId) {
        visibleKpis = visibleKpis.filter(kpi => kpi.deptId === 'general' || String(kpi.deptId) === String(managerDeptId));
    }

    visibleKpis.forEach(kpi => {
        const dept = departments.find(d => d.id == kpi.deptId);
        const deptName = kpi.deptId === 'general' 
            ? translate('kpi_placeholder_general') 
            : (dept ? dept.name : 'N/A');

        const kpiType = kpi.type === 'positive' 
            ? translate('kpi_positive') 
            : translate('kpi_negative');
        
        const row = tableBody.insertRow();
        const actions = canManage ? `
                <button class=\"btn-edit\" onclick=\"editKPI(${kpi.id})\" data-i18n=\"btn_edit\">${translate('btn_edit')}</button>
                <button class=\"btn-delete\" onclick=\"deleteKPI(${kpi.id})\" data-i18n=\"btn_delete\">${translate('btn_delete')}</button>
            ` : '';
        row.innerHTML = `
            <td>${kpi.name}</td>
            <td>${deptName}</td>
            <td>${kpi.weight}%</td>
            <td>${kpiType}</td>
            <td>${actions}</td>
        `;
    });

    applyRolePermissions();
}

/**
 * تهيئة نموذج التعديل.
 * @param {number} id - مُعرّف مؤشر الأداء.
 */
function editKPI(id) {
    const kpi = kpis.find(k => k.id === id);
    if (kpi) {
        document.getElementById('kpi-id-to-edit').value = id;
        document.getElementById('kpi-name').value = kpi.name;
        document.getElementById('kpi-dept-id').value = kpi.deptId;
        document.getElementById('kpi-weight').value = kpi.weight;
        document.getElementById('kpi-type').value = kpi.type;

        document.getElementById('save-kpi-button').textContent = translate('btn_save');
        document.getElementById('cancel-kpi-edit').style.display = 'inline-block';

        updateKpiWeightInfo(); // لتحديث معلومات الوزن عند التعديل
    }
}

/**
 * حذف مؤشر أداء.
 * @param {number} id - مُعرّف مؤشر الأداء.
 */
function deleteKPI(id) {
    if (!confirm(translate('alert_delete_confirm'))) return;

    kpis = kpis.filter(k => k.id !== id);
    // حذف أي أهداف مرتبطة بهذا المؤشر
    goals = goals.filter(g => g.kpiId !== id);

    // لا حاجة لحذف السجلات، لكن سيتم تجاهل هذا المؤشر في الحسابات المستقبلية

    commitChanges();
    renderKPIs();
    resetKpiForm();
    updateKpiWeightInfo();
}

/**
 * إعادة تعيين نموذج مؤشر الأداء.
 */
function resetKpiForm() {
    document.getElementById('kpi-id-to-edit').value = '';
    document.getElementById('kpi-name').value = '';
    document.getElementById('kpi-dept-id').value = departments.length ? departments[0].id : 'general';
    document.getElementById('kpi-weight').value = '';
    document.getElementById('kpi-type').value = 'positive';
    document.getElementById('save-kpi-button').textContent = translate('btn_add');
    document.getElementById('cancel-kpi-edit').style.display = 'none';
    updateKpiWeightInfo();
}

// ====================================================================================
// 5. العمليات الحسابية للأداء (Performance Calculations)
// ====================================================================================

/**
 * جلب مؤشرات الأداء الفعالة لموظف معين.
 * @param {number} employeeId - مُعرّف الموظف.
 * @returns {Array} - قائمة بمؤشرات الأداء (General + Departmental).
 */
function getEmployeeKpis(employeeId) {
    const employee = employees.find(e => e.id === employeeId);
    if (!employee) return [];

    // المؤشرات العامة
    const generalKpis = kpis.filter(k => k.deptId === 'general');
    // مؤشرات القسم
    const deptKpis = kpis.filter(k => k.deptId == employee.deptId);

    return [...generalKpis, ...deptKpis];
}

/**
 * تطبيع نتيجة مؤشر الأداء (من 1-100) ليناسب النوع (إيجابي/سلبي).
 * @param {number} value - القيمة المحققة (1-100).
 * @param {string} type - نوع المؤشر ('positive' أو 'negative').
 * @returns {number} - النتيجة المطبوعة (1-100).
 */
function normalizeScore(value, type) {
    if (type === 'positive') {
        return value; // (الأكثر أفضل)
    } else {
        return 100 - value; // (الأقل أفضل) يتم عكس النتيجة
    }
}

/**
 * حساب النتيجة الموزونة الكلية لسجل أداء معين.
 * @param {Object} record - سجل الأداء ({employeeId, date, scores}).
 * @returns {number|null} - النتيجة الموزونة الكلية (0-100).
 */
function calculateWeightedScore(record) {
    const employee = employees.find(e => e.id === record.employeeId);
    if (!employee) return null;

    const employeeKpis = getEmployeeKpis(employee.id);
    let totalWeightedScore = 0;
    let totalWeight = 0;

    employeeKpis.forEach(kpi => {
        const scoreValue = record.scores[kpi.id];
        if (scoreValue !== undefined) {
            const normalized = normalizeScore(scoreValue, kpi.type);
            totalWeightedScore += (normalized * kpi.weight) / 100;
            totalWeight += kpi.weight;
        }
    });

    // يجب أن يكون الوزن الكلي 100% لحساب دقيق
    if (totalWeight !== 100 && totalWeight !== 0) {
        // إذا كان المجموع ليس 100، نقوم بتطبيع النتيجة لـ 100%
        return (totalWeightedScore / totalWeight) * 100;
    }
    
    return totalWeightedScore;
}

/**
 * حساب متوسط الأداء لفترة زمنية محددة.
 * @param {number} employeeId - مُعرّف الموظف.
 * @param {Date} startDate - تاريخ البداية.
 * @param {Date} endDate - تاريخ النهاية.
 * @returns {number|null} - متوسط الأداء الموزون (0-100).
 */
function calculateAveragePerformance(employeeId, startDate, endDate) {
    const records = performanceRecords[employeeId] || [];
    
    const targetRecords = records.filter(rec => {
        const recordDate = new Date(rec.date);
        return recordDate >= startDate && recordDate <= endDate;
    });

    if (targetRecords.length === 0) return null;

    const totalScoreSum = targetRecords.reduce((sum, rec) => sum + rec.totalScore, 0);
    return totalScoreSum / targetRecords.length;
}

// ====================================================================================
// 6. تسجيل الأداء (Record Performance)
// ====================================================================================

/**
 * تحديث قائمة الموظفين في نموذج تسجيل الأداء.
 */
function updateRecordEmployeeSelect() {
    const select = document.getElementById('record-employee-id');
    select.innerHTML = '';
    select.appendChild(new Option(translate('select_emp_placeholder'), ''));

    employees.forEach(emp => {
        select.appendChild(new Option(emp.name, emp.id));
    });

    // تعيين التاريخ الافتراضي اليوم
    document.getElementById('record-date').valueAsDate = new Date();
}

/**
 * عرض حقول مؤشرات الأداء للموظف المختار.
 */
function renderRecordKpis() {
    const employeeId = parseInt(document.getElementById('record-employee-id').value);
    const date = document.getElementById('record-date').value;
    const container = document.getElementById('record-kpis-container');
    const messageP = document.getElementById('record-kpi-message');

    container.innerHTML = '';

    if (!employeeId || !date) {
        container.style.display = 'none';
        messageP.style.display = 'block';
        messageP.textContent = translate('msg_select_employee_kpi');
        return;
    }

    const employeeKpis = getEmployeeKpis(employeeId);
    let totalWeight = employeeKpis.reduce((sum, k) => sum + k.weight, 0);

    if (totalWeight === 0) {
        container.style.display = 'none';
        messageP.style.display = 'block';
        messageP.textContent = translate('msg_no_kpis_for_emp');
        return;
    }

    if (totalWeight !== 100) {
        alert(`${translate('alert_invalid_weight')} ${totalWeight}%`);
    }

    // التحقق من وجود سجل سابق لهذا التاريخ
    const records = performanceRecords[employeeId] || [];
    const existingRecord = records.find(rec => rec.date === date);

    employeeKpis.forEach(kpi => {
        const kpiName = kpi.name;
        const kpiWeight = kpi.weight;
        const kpiType = kpi.type === 'positive' ? 'A+' : 'A-';
        
        // القيمة الافتراضية
        const defaultValue = existingRecord && existingRecord.scores[kpi.id] !== undefined 
            ? existingRecord.scores[kpi.id] 
            : '';

        const div = document.createElement('div');
        div.classList.add('kpi-input-group');
        div.innerHTML = `
            <label for="kpi-${kpi.id}">${kpiName} (${kpiWeight}%, ${kpiType})</label>
            <input type="number" id="kpi-${kpi.id}" 
                   data-kpi-id="${kpi.id}" 
                   min="1" max="100" 
                   placeholder="${translate('kpi_value_placeholder')}" 
                   value="${defaultValue}"
                   required>
        `;
        container.appendChild(div);
    });

    container.style.display = 'grid';
    messageP.style.display = 'none';
}

/**
 * حفظ سجل الأداء.
 */
function savePerformanceRecord() {
    const employeeId = parseInt(document.getElementById('record-employee-id').value);
    const date = document.getElementById('record-date').value;
    
    if (!employeeId || !date) {
        alert(translate('alert_fill_all_record_fields'));
        return;
    }

    const employeeKpis = getEmployeeKpis(employeeId);
    const scores = {};
    let allValid = true;

    employeeKpis.forEach(kpi => {
        const input = document.getElementById(`kpi-${kpi.id}`);
        const value = parseInt(input.value);
        
        if (isNaN(value) || value < 1 || value > 100) {
            allValid = false;
        }
        scores[kpi.id] = value;
    });

    if (!allValid) {
        alert(translate('alert_invalid_record_value'));
        return;
    }

    // بناء سجل الأداء الجديد
    const newRecord = {
        employeeId: employeeId,
        date: date,
        scores: scores
    };
    
    // حساب النتيجة الموزونة
    const weightedScore = calculateWeightedScore(newRecord);
    if (weightedScore === null) return; // خطأ في الحساب

    newRecord.totalScore = weightedScore;

    // تحديث أو إضافة السجل
    if (!performanceRecords[employeeId]) {
        performanceRecords[employeeId] = [];
    }

    const existingIndex = performanceRecords[employeeId].findIndex(rec => rec.date === date);

    if (existingIndex !== -1) {
        performanceRecords[employeeId][existingIndex] = newRecord; // تحديث
    } else {
        performanceRecords[employeeId].push(newRecord); // إضافة
    }

    // فرز السجلات حسب التاريخ
    performanceRecords[employeeId].sort((a, b) => new Date(a.date) - new Date(b.date));

    commitChanges();
    alert(translate('alert_record_saved'));
    document.getElementById('performance-record-form').reset();
    updateRecordEmployeeSelect();
    renderRecordKpis(); // لإعادة عرض الرسالة الافتراضية
}

/**
 * عرض سجلات الأداء في الجدول (شاشة سجلات الأداء).
 * **محدثة لدعم فلاتر القسم والموظف**
 */
function renderPerformanceRecords() {
    const deptSelectEl = document.getElementById('records-dept-filter');
    const empSelectEl = document.getElementById('records-employee-select');
    const deptId = deptSelectEl ? deptSelectEl.value : 'all';
    const employeeId = empSelectEl ? empSelectEl.value : 'all';
    const tableContainer = document.getElementById('records-table-container');
    const tableBody = document.querySelector('#records-table tbody');
    const messageP = document.getElementById('records-message');

    tableBody.innerHTML = '';
    if (messageP) messageP.style.display = 'none';

    const role = getCurrentRole();
    const managerDeptId = getManagerDeptId();
    const canManage = hasPermission('manage_records');

    // Managers are forced to their department
    const effectiveDeptId = (role === 'manager' && managerDeptId) ? managerDeptId : deptId;

    // Filter employees by department
    let targetEmployees = employees || [];
    if (effectiveDeptId !== 'all' && effectiveDeptId) {
        targetEmployees = targetEmployees.filter(emp => String(emp.deptId) === String(effectiveDeptId));
    }
    
    let targetRecords = [];
    
    if (employeeId === 'all' || !employeeId) {
        // Show records of all employees in department (or all)
        targetEmployees.forEach(emp => {
            const records = (performanceRecords && performanceRecords[emp.id]) || [];
            targetRecords.push(...records);
        });
    } else {
        // Show single employee records
        const selectedId = parseInt(employeeId);
        targetRecords = (performanceRecords && performanceRecords[selectedId]) || [];
    }
    
    // Sort records by date desc
    targetRecords.sort((a, b) => new Date(b.date) - new Date(a.date));

    if (targetRecords.length === 0) {
        if (tableContainer) tableContainer.style.display = 'none';
        if (messageP) {
            messageP.style.display = 'block';
            messageP.textContent = translate('msg_no_records_for_emp');
        }
        return;
    }

    targetRecords.forEach(rec => {
        const kpiCount = Object.keys(rec.scores).length;
        const employeeName = employees.find(e => e.id === rec.employeeId)?.name || 'N/A';
        
        const row = tableBody.insertRow();
        const actions = canManage ? `
                <button class=\"btn-edit\" onclick=\"editPerformanceRecord(${rec.employeeId}, '${rec.date}')\" data-i18n=\"btn_edit\">${translate('btn_edit')}</button>
                <button class=\"btn-delete\" onclick=\"deletePerformanceRecord(${rec.employeeId}, '${rec.date}')\" data-i18n=\"btn_delete\">${translate('btn_delete')}</button>
            ` : '';
        row.innerHTML = `
            <td>${rec.date} (${employeeName})</td>
            <td>${kpiCount}</td>
            <td>${rec.totalScore.toFixed(1)}%</td>
            <td>${actions}</td>
        `;
    });

    if (tableContainer) tableContainer.style.display = 'block';

    applyRolePermissions();
}

/**
 * تحديث قوائم الفلترة في شاشة سجلات الأداء.
 */
function updateRecordsFilters() {
    const deptSelect = document.getElementById('records-dept-filter');
    deptSelect.innerHTML = '';
    
    // إضافة خيار الكل (الأقسام)
    deptSelect.appendChild(new Option(translate('filter_all_dept'), 'all'));

    departments.forEach(dept => {
        deptSelect.appendChild(new Option(dept.name, dept.id));
    });
    
    // استدعاء تحديث قائمة الموظفين بعد تحديث الأقسام
    updateRecordsEmployeeSelect();
}

/**
 * تحديث قائمة الموظفين في شاشة سجلات الأداء بناءً على فلتر القسم.
 */
function updateRecordsEmployeeSelect() {
    const deptId = document.getElementById('records-dept-filter').value;
    const empSelect = document.getElementById('records-employee-select');
    empSelect.innerHTML = '';
    
    // إضافة خيار الكل (الموظفين)
    empSelect.appendChild(new Option(translate('filter_all_dept'), 'all')); // نستخدم نفس الترجمة بمعنى "الكل"

    let targetEmployees = employees;
    if (deptId !== 'all' && deptId) {
        targetEmployees = employees.filter(emp => emp.deptId == deptId);
    }

    targetEmployees.forEach(emp => {
        empSelect.appendChild(new Option(emp.name, emp.id));
    });

    // إذا لم يكن هناك موظفون، إخفاء الفلتر
    if (targetEmployees.length === 0 && deptId !== 'all') {
        empSelect.style.display = 'none';
    } else {
        empSelect.style.display = 'inline-block';
    }
}

/**
 * نقل المستخدم إلى شاشة التسجيل لفتح سجل أداء محدد للتعديل.
 * @param {number} employeeId - مُعرّف الموظف.
 * @param {string} date - تاريخ السجل.
 */
function editPerformanceRecord(employeeId, date) {
    showScreen('record-screen');
    
    document.getElementById('record-employee-id').value = employeeId;
    document.getElementById('record-date').value = date;
    
    // التأكد من تحميل المؤشرات والقيم في النموذج
    renderRecordKpis(); 
}

/**
 * حذف سجل أداء محدد.
 * @param {number} employeeId - مُعرّف الموظف.
 * @param {string} date - تاريخ السجل.
 */
function deletePerformanceRecord(employeeId, date) {
    if (!confirm(translate('alert_delete_confirm'))) return;

    if (performanceRecords[employeeId]) {
        performanceRecords[employeeId] = performanceRecords[employeeId].filter(rec => rec.date !== date);
        if (performanceRecords[employeeId].length === 0) {
            delete performanceRecords[employeeId];
        }
        commitChanges();
        renderPerformanceRecords();
    }
}

// ====================================================================================
// 7. الأهداف الزمنية (Goals)
// ====================================================================================

/**
 * تحديث قائمة مؤشرات الأداء في نموذج الأهداف.
 */
function updateGoalKpiSelect() {
    const select = document.getElementById('goal-kpi-id');
    select.innerHTML = '';
    select.appendChild(new Option(translate('select_kpi_placeholder'), ''));

    kpis.forEach(kpi => {
        const dept = kpi.deptId === 'general' ? `(${translate('kpi_placeholder_general')})` : 
                     (departments.find(d => d.id == kpi.deptId)?.name || 'N/A');
        
        select.appendChild(new Option(`${kpi.name} [${dept}]`, kpi.id));
    });

    renderGoals(); // عرض الأهداف بعد التحديث
}

/**
 * تحديد هدف زمني طويل الأمد.
 */
function setLongTermGoal() {
    const kpiId = parseInt(document.getElementById('goal-kpi-id').value);
    const target = parseInt(document.getElementById('goal-target').value);
    const endDate = document.getElementById('goal-end-date').value;

    if (isNaN(kpiId) || isNaN(target) || !endDate) {
        alert(translate('alert_fill_all_goal_fields'));
        return;
    }

    const goal = {
        id: goals.length ? Math.max(...goals.map(g => g.id)) + 1 : 1,
        kpiId: kpiId,
        target: target,
        endDate: endDate,
        status: 'active'
    };

    // إزالة أي هدف سابق لنفس المؤشر
    goals = goals.filter(g => g.kpiId !== kpiId);
    goals.push(goal);

    commitChanges();
    alert(translate('alert_goal_set'));
    document.getElementById('goal-form').reset();
    renderGoals();
}

/**
 * عرض الأهداف في الجدول وتحديث حالتها.
 */
function renderGoals() {
    const tableBody = document.querySelector('#goals-table tbody');
    tableBody.innerHTML = '';
    const today = new Date();

    goals.forEach(goal => {
        const kpi = kpis.find(k => k.id === goal.kpiId);
        if (!kpi) return; // تجاهل الأهداف ذات المؤشرات المحذوفة

        // تحدية حالة الهدف
        const goalDate = new Date(goal.endDate);
        if (goalDate < today) {
            goal.status = 'expired';
        } else {
            goal.status = 'active';
        }

        const kpiName = kpi.name;
        const statusText = goal.status === 'active' ? translate('status_active') : translate('status_expired');
        const statusClass = goal.status === 'active' ? 'status-active' : 'status-expired';

        const row = tableBody.insertRow();
        row.innerHTML = `
            <td>${kpiName}</td>
            <td>${goal.target}%</td>
            <td>${goal.endDate}</td>
            <td><span class="${statusClass}">${statusText}</span></td>
            <td>
                <button class="btn-delete" onclick="deleteGoal(${goal.id})" data-i18n="btn_delete">${translate('btn_delete')}</button>
            </td>
        `;
    });

    commitChanges(); // حفظ حالات الأهداف المحدثة
}

/**
 * حذف هدف.
 * @param {number} id - مُعرّف الهدف.
 */
function deleteGoal(id) {
    if (!confirm(translate('alert_delete_confirm'))) return;

    goals = goals.filter(g => g.id !== id);
    commitChanges();
    renderGoals();
}

// ====================================================================================
// 8. لوحة التحكم والإحصائيات (Dashboard & Stats)
// ====================================================================================

/**
 * تحديث الإحصائيات الرئيسية في لوحة التحكم العامة.
 */
function updateDashboardStats() {
    document.getElementById('stat-total-employees').textContent = employees.length;
    document.getElementById('stat-total-departments').textContent = departments.length;
    document.getElementById('stat-active-kpis').textContent = kpis.length;
    
    // حساب متوسط الأداء العام لآخر 30 يوم
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const today = new Date();

    let allScores = [];
    employees.forEach(emp => {
        const records = performanceRecords[emp.id] || [];
        records.forEach(rec => {
            const recDate = new Date(rec.date);
            if (recDate >= thirtyDaysAgo && recDate <= today) {
                allScores.push(rec.totalScore);
            }
        });
    });

    const avgPerformance = allScores.length > 0 
        ? (allScores.reduce((sum, score) => sum + score, 0) / allScores.length).toFixed(1)
        : 0;

    document.getElementById('stat-avg-performance').textContent = `${avgPerformance}%`;

    renderTopEmployees();
    renderDepartmentPerformanceChart();
}

/**
 * عرض أفضل 5 موظفين.
 */
function renderTopEmployees() {
    const tableBody = document.querySelector('#top-employees-table tbody');
    tableBody.innerHTML = '';
    
    const today = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const employeeAverages = employees.map(emp => {
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
}

/**
 * رسم بياني لأداء الأقسام.
 */
let deptChart;
function renderDepartmentPerformanceChart() {
    const ctx = document.getElementById('department-performance-chart').getContext('2d');
    
    const today = new Date();
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    const deptAverages = departments.map(dept => {
        const deptEmployees = employees.filter(emp => emp.deptId === dept.id);
        
        let deptScores = [];
        deptEmployees.forEach(emp => {
            const records = performanceRecords[emp.id] || [];
            records.forEach(rec => {
                const recDate = new Date(rec.date);
                if (recDate >= ninetyDaysAgo && recDate <= today) {
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

    updateEmployeeDashboard(); // عرض لوحة التحكم الشخصية للموظف المختار (إن وجد)
}

/**
 * تحديث لوحة التحكم الشخصية للموظف المختار.
 */
let personalChart;
function updateEmployeeDashboard() {
    const employeeId = parseInt(document.getElementById('dashboard-employee-select').value);
    const contentDiv = document.getElementById('personal-dashboard-content');
    const messageP = document.querySelector('#personal-dashboard-content > p');
    const scoreCardDiv = document.getElementById('employee-score-card');
    const chartContainer = document.getElementById('personal-kpi-chart-container');
    
    // إخفاء المحتوى إذا لم يتم اختيار موظف
    if (isNaN(employeeId)) {
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

    // 2. حالة الهدف (بافتراض أن الهدف موجه لمؤشر واحد حالياً)
    const activeGoal = goals.find(g => g.status === 'active');
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

    const ctx = document.getElementById('personal-kpi-chart').getContext('2d');
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
    select.innerHTML = '';
    select.appendChild(new Option(translate('select_emp_placeholder'), ''));

    employees.forEach(emp => {
        select.appendChild(new Option(emp.name, emp.id));
    });
}

/**
 * توليد تقرير أداء موظف لفترة محددة.
 */
function generateReport() {
    const employeeId = parseInt(document.getElementById('report-employee-select').value);
    const startDateStr = document.getElementById('report-start-date').value;
    const endDateStr = document.getElementById('report-end-date').value;
    const reportOutput = document.getElementById('report-output');
    const tableBody = document.querySelector('#daily-performance-table tbody');

    if (isNaN(employeeId) || !startDateStr || !endDateStr) {
        alert(translate('alert_fill_all_report_fields'));
        return;
    }
    
    const startDate = new Date(startDateStr);
    const endDate = new Date(endDateStr);

    if (startDate > endDate) {
        alert(translate('alert_start_date_after_end'));
        return;
    }
    
    const employee = employees.find(e => e.id === employeeId);
    const records = performanceRecords[employeeId] || [];

    const targetRecords = records.filter(rec => {
        const recordDate = new Date(rec.date);
        // إضافة يوم واحد لنهاية الفترة لضمان شمول تاريخ النهاية بالكامل
        const endDay = new Date(endDate);
        endDay.setDate(endDay.getDate() + 1); 

        return recordDate >= startDate && recordDate < endDay;
    }).sort((a, b) => new Date(a.date) - new Date(b.date));


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
    
    reportTitle.textContent = `${translate('report_title_emp')} - ${employee.name}`;
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
        const deptEmployees = employees.filter(emp => emp.deptId === dept.id);
        
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
    const employeeId = parseInt(document.getElementById('report-employee-select').value);
    const employee = employees.find(e => e.id === employeeId);
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
    // نص توضيحي بسيط عند عدم توفر الترجمة
    try {
        const t = translate('kpi_dept_weight_remaining');
        infoEl.textContent = t ? t.replace('{value}', remaining.toFixed(0)) : `المتبقي للقسم: ${remaining}%`;
    } catch {
        infoEl.textContent = `المتبقي للقسم: ${remaining}%`;
    }

    const usedPercent = Math.min(100, assigned);
    barFill.style.width = `${usedPercent}%`;

    const newWeight = parseFloat(weightInput.value || '0') || 0;
    if (deptId && newWeight > remaining) {
        warningEl.style.display = '';
        try {
            const wt = translate('kpi_weight_exceeds_remaining');
            warningEl.textContent = wt || 'الوزن يتجاوز المتبقي للقسم';
        } catch {
            warningEl.textContent = 'الوزن يتجاوز المتبقي للقسم';
        }
        if (saveBtn) saveBtn.setAttribute('disabled', 'disabled');
    } else {
        warningEl.style.display = 'none';
        if (saveBtn) saveBtn.removeAttribute('disabled');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    // عرض لوحة التحكم الافتراضية عند التحميل
    showScreen('dashboard-screen');

    // تفعيل القيود حسب الدور
    applyRolePermissions();

    // لضمان التحديث الأولي للقوائم المنسدلة
    updateDepartmentSelects();
    updateDashboardEmployeeSelect();
    updateRecordEmployeeSelect();
    updateGoalKpiSelect();
    updateReportTargetSelect();

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

    // تحديث أولي للشريط والمعلومة
    updateKpiWeightInfo();
});