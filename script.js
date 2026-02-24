// Khai báo db ở đầu file
let db = []; 
const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwb1gGY8IxlRufesBhyvcHhM0mhLibIfsJN14uOqvNApKVurVfZM6--qxpBUN-FXt5lJw/exec";
// Hàm lưu db vào bộ nhớ trình duyệt (24/02/2026)
function saveToLocal() {
    localStorage.setItem('mes_db_backup', JSON.stringify(db));
}

// Hàm tải lại db từ bộ nhớ trình duyệt khi mở trang (24/02/2026)
function loadFromLocal() {
    const saved = localStorage.getItem('mes_db_backup');
    if (saved) {
        db = JSON.parse(saved);
        window.updateBatchSelector(); // Cập nhật lại dropdown
        console.log("Đã khôi phục dữ liệu từ LocalStorage");
    }
}
// hàm load dữ liệu từ GGSHEET và đổ vào selection CHỌN LÔ VẬN HÀNH (24/02/2026)
window.loadExistingBatches = async function() {
    console.log("Đang tải dữ liệu từ Google Sheets...");
    
    // 1. Hiển thị trạng thái chờ trên UI
    const selector = document.getElementById('activeBatches');
    if (selector) {
        selector.innerHTML = '<option value="">⏳ Đang đồng bộ dữ liệu...</option>';
    }

    try {
        // 2. Gọi API lấy dữ liệu từ Cloud
        const response = await fetch(`${GOOGLE_SCRIPT_URL}?action=get_batches`);
        
        if (!response.ok) throw new Error("Network response was not ok");
        
        const remoteData = await response.json();
        
        if (remoteData && remoteData.length > 0) {
            // 3. Cập nhật dữ liệu vào biến db và LocalStorage
            db = remoteData; 
            saveToLocal(); 
            
            // 4. Cập nhật giao diện Dropdown
            window.updateBatchSelector(); // Sử dụng hàm này để tái sử dụng code đổ data vào select
            
            window.showToast("Đã đồng bộ danh sách lô từ hệ thống", "success");
            console.log("Đã đồng bộ dữ liệu từ Cloud");
        }
    } catch (e) {
        console.error("Lỗi kết nối Server, đang kiểm tra dữ liệu nội bộ:", e);
        
        // 5. Xử lý khi mất mạng/lỗi server: Khôi phục từ máy cục bộ
        loadFromLocal(); 
        
        if (db && db.length > 0) {
            window.showToast("Mất kết nối. Đã khôi phục dữ liệu nháp.", "warning");
        } else {
            window.showToast("Không thể tải dữ liệu. Vui lòng kiểm tra mạng!", "error");
            if (selector) selector.innerHTML = '<option value="">❌ Lỗi tải dữ liệu</option>';
        }
    }
};

// Tự động chạy khi vừa load trang xong
window.addEventListener('DOMContentLoaded', window.loadExistingBatches);
// --- HÀM 1: KHỞI TẠO LÔ (QUẢN ĐỐC) ---24/02/2026
window.initBatch = async function() {
    console.log("Đang khởi tạo lô...");
    const batchEl = document.getElementById('batchID');
    const orderEl = document.getElementById('orderID');
    const skuEl = document.getElementById('skuID');

    if (!batchEl || !skuEl) {
        window.showToast("Lỗi: Không tìm thấy ô nhập liệu!", "error");
        return;
    }

    const bVal = batchEl.value.trim();
    const oVal = orderEl ? orderEl.value.trim() : "";
    const sVal = skuEl.value.trim();

    if(!bVal || !sVal) return window.showToast("Vui lòng nhập đầy đủ Mã Lô và SKU!", "warning");

    const payload = {
        action: 'init',
        batch_id: bVal,
        order_id: oVal,
        sku_id: sVal
    };

    // 1. Gửi dữ liệu lên Server và hứng kết quả vào biến 'result'
    window.showToast("Đang kích hoạt hồ sơ trên hệ thống...", "warning");
    const result = await window.sendToDatabase(payload); 

    // 2. Kiểm tra biến 'result' thay vì 'success'
    if (result) {
        // Cập nhật Database cục bộ
        db.push({
            batch_id: bVal,
            order_id: oVal,
            sku_id: sVal,
            status: 'Created',
            outputLogs: []
        });

        window.saveToLocal(); // Lưu backup vào trình duyệt
        window.updateBatchSelector(); // Cập nhật dropdown
        window.updateDashboard(); // Cập nhật con số dashboard
        
        window.showToast("Kích hoạt hồ sơ thành công!", "success");
        
        // Reset form để nhập lô tiếp theo
        batchEl.value = "";
        if(orderEl) orderEl.value = "";
        skuEl.value = "";

        // Đồng bộ lại danh sách từ server cho chắc chắn
        await window.loadExistingBatches(); 
    } else {
        window.showToast("Lỗi kết nối Server! Vui lòng thử lại.", "error");
    }
};
  
// --- HÀM 2: LƯU SẢN XUẤT (VẬN HÀNH) ---
window.saveProduction = async function() {
    const bId = document.getElementById('activeBatches').value;
    const batch = db.find(b => b.batch_id === bId); 
    
    if(!batch) return showToast("Vui lòng chọn một Lô để lưu!");

    const rows = document.querySelectorAll('#outputBody tr');
    const outputLogs = Array.from(rows).map(r => ({
        batch_id: bId,
        order_id: batch.order_id, 
        sku_id: batch.sku_id,
        ingridient: r.querySelector('.c-rm')?.value,
        rm_batch_id: r.querySelector('.c-lot')?.value,
        input: r.querySelector('.c-out')?.value, 
        process: r.querySelector('.c-step')?.value,
        timestamp: new Date().toLocaleString('vi-VN')
    }));

    const payload = {
        action: 'save',
        batch_id: bId,
        output: outputLogs,
        // THÊM PHẦN AUDIT LOG
        audit: {
            user: "Công nhân vận hành", // Sau này bạn có thể thay bằng tên đăng nhập
            action: "Cập nhật sản lượng",
            timestamp: new Date().toLocaleString('vi-VN')
        }
    };

    const success = await window.sendToDatabase(payload);
    if(success) {
        batch.status = 'Produced';
        saveToLocal(); /*(24/02/2026) */
        window.updateBadgeStatus(batch);
        showToast("💾 Đã lưu Nhật ký sản xuất thành công!");
    }
};
//HÀM HIỂN THỊ AUDIT
window.addAuditToUI = function(msg) {
    const logContainer = document.getElementById('quick-logs'); // Nếu bạn có một div id này
    if (logContainer) {
        const entry = document.createElement('div');
        entry.style.fontSize = "11px";
        entry.style.borderBottom = "1px solid rgba(255,255,255,0.05)";
        entry.style.padding = "5px 0";
        entry.innerHTML = `<span style="color:var(--primary)">[${new Date().toLocaleTimeString()}]</span> ${msg}`;
        logContainer.prepend(entry);
    }
};
// --- HÀM 3: HÀM GỬI DATA (CHỐNG TREO) ---
// 1. Khai báo khóa bí mật ở đầu file (phải khớp với mã trong Google Apps Script)
const API_SECRET_TOKEN = "MES_PRO_SECRET_2026"; 

// 2. Hàm gửi dữ liệu duy nhất đã được tối ưu
window.sendToDatabase = async function(payload) {
    console.log("🚀 Đang gửi dữ liệu lên Server...", payload.action);
    
    try {
        // Đính kèm token bảo mật vào dữ liệu gửi đi
        payload.token = API_SECRET_TOKEN; 

        // Thực hiện lệnh gọi fetch (không dùng no-cors để có thể đọc được kết quả trả về)
        const response = await fetch(GOOGLE_SCRIPT_URL, {
            method: "POST",
            body: JSON.stringify(payload)
        });

        // Kiểm tra phản hồi từ HTTP (ví dụ: lỗi 404, 500, hoặc Access Denied 401/403)
        if (!response.ok) {
            throw new Error(`Server báo lỗi: ${response.status}`);
        }

        // Nếu muốn đọc tin nhắn trả về từ Google Script (tùy chọn)
        // const result = await response.text();
        // console.log("Kết quả từ Server:", result);

        return true; 
    } catch (e) {
        console.error("❌ Lỗi gửi dữ liệu:", e);
        
        // Hiển thị thông báo lỗi trực quan cho công nhân/quản đốc
        if (window.showToast) {
            window.showToast("Lỗi kết nối hoặc Từ chối truy cập!", "error");
        }
        return false;
    }
};

// --- CÁC HÀM UI HỖ TRỢ (PHẢI CÓ window.) ---
/*Cập nhật dropdown 24/02/2026 */
window.addRow = function(target) {
    const tbody = document.getElementById(target);
    const row = document.createElement('tr');
    
    row.innerHTML = `
        <td>
            <select class="c-step">
                <option value="Cân">⚖️ Cân</option>
                <option value="Trộn">🌀 Trộn</option>
                <option value="Chiết rót">🧪 Chiết rót</option>
                <option value="Đóng gói">📦 Đóng gói</option>
                <option value="Dán nhãn">🏷️ Dán nhãn</option>
            </select>
        </td>
        <td><input type="text" class="c-rm" placeholder="Tên NVL"></td>
        <td><input type="text" class="c-lot" placeholder="Lô RM"></td>
        <td style="display: flex; gap: 5px;">
            <input type="number" class="c-out" style="width: 70px;" placeholder="SL">
            <select class="c-unit" style="width: 70px;">
                <option value="Kg">Kg</option>
                <option value="Gam">g</option>
                <option value="Cái">Cái</option>
                <option value="Lít">Lít</option>
            </select>
        </td>
        <td><button onclick="this.closest('tr').remove()" class="btn-delete">✕</button></td>
    `;
    tbody.appendChild(row);
};
/*hiển thị đầy đủ thông tin như bạn muốn (bao gồm cả SKU và Status) 24/02/2026 */
window.updateBatchSelector = function() {
    const workerSelector = document.getElementById('activeBatches');
    const qcSelector = document.getElementById('qcBatchSelect');
    
    const optionsHtml = db.map(batch => 
        `<option value="${batch.batch_id}">${batch.batch_id} - ${batch.sku_id} [${batch.status}]</option>`
    ).join('');

    const defaultOption = '<option value="">-- CHỌN MÃ LÔ --</option>';

    if (workerSelector) workerSelector.innerHTML = defaultOption + optionsHtml;
    if (qcSelector) qcSelector.innerHTML = defaultOption + optionsHtml;
};
/*HÀM ADDROWEITH DATA ĐỂ HIỂN THỊ DỮ LIỆU CŨ */
window.addRowWithData = function(target, log) {
    const tbody = document.getElementById(target);
    const row = document.createElement('tr');
    row.innerHTML = `
        <td>
            <select class="c-step">
                <option value="Cân" ${log.process === 'Cân' ? 'selected' : ''}>⚖️ Cân</option>
                <option value="Trộn" ${log.process === 'Trộn' ? 'selected' : ''}>🌀 Trộn</option>
                <option value="Chiết rót" ${log.process === 'Chiết rót' ? 'selected' : ''}>🧪 Chiết rót</option>
                <option value="Đóng gói" ${log.process === 'Đóng gói' ? 'selected' : ''}>📦 Đóng gói</option>
            </select>
        </td>
        <td><input type="text" class="c-rm" value="${log.ingridient || ''}"></td>
        <td><input type="text" class="c-lot" value="${log.rm_batch_id || ''}"></td>
        <td style="display: flex; gap: 5px;">
            <input type="number" class="c-out" style="width: 70px;" value="${log.input || ''}">
            <select class="c-unit" style="width: 70px;">
                <option value="Kg" ${log.unit === 'Kg' ? 'selected' : ''}>Kg</option>
                <option value="Gam" ${log.unit === 'Gam' ? 'selected' : ''}>g</option>
            </select>
        </td>
        <td><button onclick="this.closest('tr').remove()" class="btn-delete">✕</button></td>
    `;
    tbody.appendChild(row);
};
/* Cập nhật hàm loadBatchData dành riêng cho CÔNG NHÂN (Mục 02) *24/02/2026*/
window.loadBatchData = function(selectedId) {
    if (!selectedId) {
        window.controlSections('Locked');
        return;
    }
    
    const batch = db.find(b => b.batch_id === selectedId); 
    if (!batch) return;

    // Chỉ cập nhật Badge và mở khóa Section liên quan đến Sản xuất
    window.updateBadgeStatus(batch);
    
    const tbody = document.getElementById('outputBody');
    tbody.innerHTML = '';
    
    if (batch.outputLogs && batch.outputLogs.length > 0) {
        batch.outputLogs.forEach(log => {
            window.addRowWithData('outputBody', log);
        });
        
        // NẾU LÔ CHƯA HOÀN THÀNH, TỰ ĐỘNG THÊM 1 DÒNG TRỐNG ĐỂ NHẬP TIẾP
        if (batch.status !== 'Completed') {
            window.addRow('outputBody');
        }
    } else {
        window.addRow('outputBody');
    }
    
    // LƯU Ý: Không đụng vào Toggle QC ở đây để tránh làm phiền QC
};

/* Cập nhật hàm loadQCData dành riêng cho QC (Mục 03) */
window.loadQCData = function(selectedId) {
    if (!selectedId) return;

    const batch = db.find(b => b.batch_id === selectedId);
    if (!batch) return;

    // 1. Chỉ cập nhật Badge tương ứng với Lô QC đang chọn
    window.updateBadgeStatus(batch);

    // 2. Đồng bộ nút gạt Pass/Fail và Ghi chú từ dữ liệu cũ
    window.syncQCToggle(batch.pqc_status || "Fail");
    document.getElementById('qcNote').value = batch.note || "";

    // 3. Tính toán sản lượng để đối soát
    let total = 0;
    if (batch.outputLogs) {
        batch.outputLogs.forEach(log => total += Number(log.input) || 0);
    }
    
    const yieldDisplay = document.getElementById('qcYieldDisplay');
    if(yieldDisplay) yieldDisplay.textContent = total.toLocaleString('vi-VN');

    showToast("QC đang kiểm tra lô: " + selectedId, "success");
};

// --- 3. QC XÁC NHẬN ---
// Hàm chuyên trách cập nhật giao diện Toggle dựa trên giá trị (Pass/Fail)
// --- HÀM 3: QC XÁC NHẬN HOÀN THÀNH ---
window.syncQCToggle = function(status) {
    const toggle = document.getElementById('pqcToggle');
    const statusInput = document.getElementById('pqcStatus');
    const labels = document.querySelectorAll('.status-label');

    if (!toggle || !statusInput) return;

    if (status === "Pass") {
        toggle.checked = true;
        statusInput.value = "Pass";
        if(labels[1]) labels[1].classList.add('active'); // PASS hiện sáng
        if(labels[0]) labels[0].classList.remove('active'); // FAIL mờ đi
    } else {
        toggle.checked = false;
        statusInput.value = "Fail";
        if(labels[0]) labels[0].classList.add('active'); // FAIL hiện sáng
        if(labels[1]) labels[1].classList.remove('active'); // PASS mờ đi
    }
};
window.finalizeQC = async function() {
    const bId = document.getElementById('qcBatchSelect')?.value;
    if(!bId) return window.showToast("⚠️ QC vui lòng chọn một Mã Lô!", "warning");

    const batch = db.find(b => b.batch_id === bId);
    if(!batch) return window.showToast("Lô không tồn tại!", "error");

    const pqcStatus = document.getElementById('pqcStatus').value;
    const qcNote = document.getElementById('qcNote').value;

    // Ưu tiên tính total từ dữ liệu gốc trong db của lô đó để tránh lấy nhầm dữ liệu trên màn hình
    let total = 0;
    if (batch.outputLogs && batch.outputLogs.length > 0) {
        batch.outputLogs.forEach(log => total += Number(log.input) || 0);
    } else {
        // Nếu db chưa có (đang load dở), mới quét trên UI Mục 02
        document.querySelectorAll('.c-out').forEach(input => total += Number(input.value) || 0);
    }

    const payload = {
        action: 'finalize',
        batch_id: bId,
        total_output: total,
        pqc_status: pqcStatus,
        note: qcNote,
        completed_at: new Date().toLocaleString('vi-VN') // Thêm mốc thời gian chốt hồ sơ
    };

    window.showToast("Đang gửi xác nhận QC...", "warning");
    const success = await window.sendToDatabase(payload);
    
    if(success) {
        batch.status = 'Completed'; 
        batch.pqc_status = pqcStatus;
        batch.note = qcNote;

        window.saveToLocal();
        window.updateBadgeStatus(batch);
        window.updateBatchSelector();
        window.updateDashboard(); // Đừng quên cập nhật con số Dashboard ở đây!
        
        window.showToast(`Lô ${bId} đã hoàn thành & chốt hồ sơ!`, "success");
    } else {
        window.showToast("❌ Lỗi: Không thể gửi dữ liệu lên server!", "error");
    }
};

// Hàm này dùng cho sự kiện OnChange của Toggle trên giao diện
window.updateQCStatusText = function() {
    const isChecked = document.getElementById('pqcToggle').checked;
    window.syncQCToggle(isChecked ? "Pass" : "Fail");
};
/* Cập nhật hàm theo dõi badge, và hàm mở khóa từng bước (24/02/2026)*/
window.updateBadgeStatus = function(batch) {
    const status = batch.status;
    
    // 1. Cập nhật các Badge (như cũ)
    document.querySelectorAll('.badge').forEach(b => b.classList.remove('active'));
    if (status === 'Created') document.getElementById('badge-supervisor')?.classList.add('active');
    else if (status === 'Produced') document.getElementById('badge-operator')?.classList.add('active');
    else if (status === 'Completed') document.getElementById('badge-qc')?.classList.add('active');

    // 2. Gọi hàm điều khiển các Section
    window.controlSections(status);
};

window.controlSections = function(status) {
    const secProduction = document.querySelector('.section-2');
    const secQC = document.querySelector('.section-3');

    // Reset mặc định: Khóa và làm mờ
    [secProduction, secQC].forEach(sec => {
        sec.style.opacity = "0.4";
        sec.style.pointerEvents = "none";
    });

    // Hàm hỗ trợ khóa/mở khóa các element bên trong một Section
    const toggleInputs = (section, isDisable) => {
        section.querySelectorAll('input, select, textarea, button').forEach(el => {
            // Trừ nút "Xuất PDF" hoặc các nút điều hướng nếu cần
            if (!el.classList.contains('btn-export')) {
                el.disabled = isDisable;
            }
        });
    };

    if (status === 'Created') {
        secProduction.style.opacity = "1";
        secProduction.style.pointerEvents = "all";
        toggleInputs(secProduction, false); // Mở khóa để nhập liệu
    } 
    else if (status === 'Produced') {
        secProduction.style.opacity = "1";
        secProduction.style.pointerEvents = "all";
        secQC.style.opacity = "1";
        secQC.style.pointerEvents = "all";
        toggleInputs(secProduction, false);
        toggleInputs(secQC, false);
    }
    else if (status === 'Completed') {
        secProduction.style.opacity = "0.8"; // Vẫn nhìn rõ để xem dữ liệu
        secProduction.style.pointerEvents = "all";
        secQC.style.opacity = "1";
        secQC.style.pointerEvents = "all";
        
        // QUAN TRỌNG: Khóa toàn bộ nhập liệu ở Mục 02 và các nút lưu ở Mục 03
        toggleInputs(secProduction, true); 
        toggleInputs(secQC, true);
        
        window.showToast("Hồ sơ này đã đóng. Chỉ có quyền xem!", "warning");
    }
};

/*Hàm thông báo toast 24/02/2026 */
window.showToast = function(message, type = 'success') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    
    // Chọn icon dựa trên loại thông báo
    const icon = type === 'success' ? '✅' : type === 'error' ? '❌' : '⚠️';
    
    toast.className = `toast ${type}`;
    toast.innerHTML = `<span>${icon}</span> <span>${message}</span>`;
    
    container.appendChild(toast);

    // Tự động xóa sau 4 giây
    setTimeout(() => {
        toast.style.animation = "slideIn 0.4s reverse forwards";
        setTimeout(() => toast.remove(), 400);
    }, 4000);
};

//5. Hàm xuất dữ liệu pdf 24/02/2026
window.exportBatchPDF = function() {
    const searchId = document.getElementById('searchId').value.trim();
    const batch = db.find(b => b.batch_id === searchId);

    if (!batch) {
        showToast("Không tìm thấy mã Lô này để xuất PDF!", "error");
        return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    // 1. Tiêu đề và Header
    doc.setFontSize(22);
    doc.setTextColor(0, 210, 255); // Màu Primary xanh của bạn
    doc.text("PHIEU KIEM SOAT LO (E-BATCH RECORD)", 105, 20, { align: "center" });

    // 2. Thông tin chung
    doc.setFontSize(12);
    doc.setTextColor(0, 0, 0);
    doc.text(`Ma Lo: ${batch.batch_id}`, 14, 40);
    doc.text(`Don hang: ${batch.order_id}`, 14, 47);
    doc.text(`San pham (SKU): ${batch.sku_id}`, 14, 54);
    doc.text(`Trang thai: ${batch.status}`, 140, 40);
    doc.text(`Ngay xuat: ${new Date().toLocaleDateString('vi-VN')}`, 140, 47);

    // 3. Bang chi tiet san xuat (AutoTable)
    const tableData = (batch.outputLogs || []).map((log, index) => [
        index + 1,
        log.process || '-',
        log.ingridient || '-',
        log.rm_batch_id || '-',
        log.input || '0',
        log.timestamp || '-'
    ]);

    doc.autoTable({
        startY: 65,
        head: [['STT', 'CONG DOAN', 'NGUYEN LIEU', 'LO RM', 'SO LUONG', 'THOI GIAN']],
        body: tableData,
        theme: 'striped',
        headStyles: { fillColor: [0, 210, 255] }
    });

    // 4. Phan ghi chu QC
    let finalY = doc.lastAutoTable.finalY + 15;
    doc.setFontSize(14);
    doc.text("KET QUA KIEM DINH (QC)", 14, finalY);
    doc.setFontSize(11);
    doc.text(`Ket luan: ${batch.pqc_status || 'Chua kiem tra'}`, 14, finalY + 10);
    doc.text(`Ghi chu: ${batch.note || 'Khong co'}`, 14, finalY + 17);

    // 5. Chu ky
    doc.text("Quan doc xuong", 40, finalY + 40);
    doc.text("Kiem dinh viên", 150, finalY + 40);
    doc.setFontSize(8);
    doc.text("(Ky và ghi ro ho ten)", 41, finalY + 45);
    doc.text("(Ky và ghi ro ho ten)", 151, finalY + 45);

    // 6. Xuat file
    doc.save(`MES_Report_${batch.batch_id}.pdf`);
    showToast("Đã tải xuống hồ sơ PDF!", "success");
};
//HÀM HIỂN THỊ <DASHBOARD>24/02/2026</DASHBOARD>
window.updateDashboard = function() {
    if (!db || db.length === 0) return;

    const total = db.length;
    const completed = db.filter(b => b.status === 'Completed').length;
    const pending = db.filter(b => b.status === 'Created' || b.status === 'Produced').length;

    // Cập nhật lên giao diện
    const totalEl = document.getElementById('dash-total');
    const compEl = document.getElementById('dash-completed');
    const pendEl = document.getElementById('dash-pending');

    if (totalEl) totalEl.textContent = total;
    if (compEl) compEl.textContent = completed;
    if (pendEl) pendEl.textContent = pending;
};

// GỌI HÀM NÀY Ở ĐÂU?
// 1. Cuối hàm loadExistingBatches (khi vừa tải xong từ server)
// 2. Cuối hàm initBatch (khi vừa tạo lô mới)
// 3. Cuối hàm finalizeQC (khi vừa chốt xong 1 lô)
//HÀM LOGIC QUÉT MÃ <QR>24/02/2026</QR>
// Hàm mở camera để quét
let html5QrCode;

window.startScan = async function(targetId) {
    const confirmModal = document.getElementById('confirm-modal');
    const btnAllow = document.getElementById('btn-allow-cam');
    const btnCancel = document.getElementById('btn-cancel-cam');

    // 1. Hiển thị Modal xác nhận
    confirmModal.style.display = 'flex';

    // 2. Tạo một lời hứa (Promise) chờ người dùng phản hồi
    const userChoice = await new Promise((resolve) => {
        btnAllow.onclick = () => {
            confirmModal.style.display = 'none';
            resolve(true);
        };
        btnCancel.onclick = () => {
            confirmModal.style.display = 'none';
            resolve(false);
        };
    });

    if (!userChoice) {
        window.showToast("Đã hủy thao tác quét mã.", "warning");
        return;
    }

    // 3. Tiến trình mở Camera (Như cũ)
    const cameraModal = document.getElementById('camera-modal');
    cameraModal.style.display = 'flex';
    
    if (!html5QrCode) {
        html5QrCode = new Html5Qrcode("reader");
    }

    try {
        await html5QrCode.start(
            { facingMode: "environment" }, 
            { fps: 10, qrbox: { width: 250, height: 250 } },
            (decodedText) => {
                const selectEl = document.getElementById(targetId);
                if ([...selectEl.options].some(opt => opt.value === decodedText)) {
                    selectEl.value = decodedText;
                    window.loadBatchData(decodedText);
                    window.showToast("Nhận diện thành công!", "success");
                    window.stopScan();
                } else {
                    window.showToast("Mã QR không thuộc danh sách lô!", "error");
                }
            }
        );
      } catch (err) {
          let errorMsg = "Không thể truy cập Camera.";
          if (err.name === 'NotAllowedError') {
              errorMsg = "Bạn đã chặn quyền Camera. Hãy mở lại ở biểu tượng ổ khóa đầu trang!";
          } else if (err.name === 'NotFoundError') {
              errorMsg = "Máy tính/Điện thoại của bạn không có Camera!";
          } else {
              errorMsg = "Lỗi kỹ thuật: " + err.message;
          }
          window.showToast(errorMsg, "error");
          window.stopScan();
      }
};

window.stopScan = function() {
    if (html5QrCode) {
        html5QrCode.stop().then(() => {
            html5QrCode.clear(); // Quan trọng: Xóa sạch trạng thái quét cũ
            document.getElementById('camera-modal').style.display = 'none';
            console.log("Camera đã được giải phóng hoàn toàn.");
        }).catch(err => {
            console.warn("Camera đã đóng trước đó hoặc có lỗi giải phóng:", err);
            document.getElementById('camera-modal').style.display = 'none';
        });
    } else {
        document.getElementById('camera-modal').style.display = 'none';
    }
};
