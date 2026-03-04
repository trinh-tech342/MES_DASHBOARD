/* ==========================================================================
   BLOCK 0: CẤU HÌNH HỆ THỐNG (BỎ SKU KHI KHỞI TẠO)
   ========================================================================== */
window.db = window.db || [];
const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbw2NIYJGSLO3k_FbgkZfUEsbNFeHnUsDNEt8OBRHgelFRyGgi6q6vRNLJJa7rdxHcv0Zw/exec";
const API_SECRET_TOKEN = "MES_PRO_SECRET_2026"; 
// Hàm chuyển tiếng Việt có dấu thành không dấu
const vniSafe = (str) => {
    if (!str) return "";
    return str.normalize('NFD')
              .replace(/[\u0300-\u036f]/g, '')
              .replace(/đ/g, 'd').replace(/Đ/g, 'D');
};
let GLOBAL_BOM = {}; 
let html5QrCode;

/* ==========================================================================
   BLOCK 1: DATA ENGINE (GIỮ NGUYÊN)
   ========================================================================== */
window.sendToDatabase = async function(payload) {
    try {
        payload.token = API_SECRET_TOKEN; 
        await fetch(GOOGLE_SCRIPT_URL, {
            method: "POST", mode: "no-cors", cache: "no-cache",
            headers: { "Content-Type": "text/plain" },
            body: JSON.stringify(payload)
        });
        return true; 
    } catch (e) { return false; }
};

window.saveToLocal = function() { localStorage.setItem('mes_db_backup', JSON.stringify(window.db)); };
window.loadFromLocal = function() {
    const saved = localStorage.getItem('mes_db_backup');
    if (saved) { window.db = JSON.parse(saved); window.updateBatchSelector(); window.updateDashboard(); }
};
// Hàm tải danh sách các lô đã tồn tại từ Server
// 1. Hàm nạp danh sách lô từ Server
window.loadExistingBatches = async function() {
    try {
        // Gọi action 'read' đã sửa ở Apps Script
        const response = await fetch(`${GOOGLE_SCRIPT_URL}?action=read`);
        const data = await response.json();
        
        if (Array.isArray(data)) {
            window.db = data;
            window.updateBatchSelector();
            window.updateDashboard();
        }
    } catch (e) {
        console.error("CORS hoặc Lỗi kết nối:", e);
    }
};

// 2. Hàm xử lý khi chọn một lô hàng (Fix lỗi "is not a function")
window.loadBatchData = function(batchId) {
    if (!batchId) return;
    console.log("Đang xem lô:", batchId);
    // Tại đây bạn có thể thêm logic hiển thị thông tin chi tiết lô nếu muốn
};

// 3. Hàm áp dụng BOM vào bảng (Sửa lỗi ID null)
// HÀM QUAN TRỌNG: Đổ dữ liệu từ BOM vào bảng Nhật ký
window.applyBOMToTable = function() {
    // 1. Lấy phần tử trực tiếp bên trong hàm để đảm bảo không bị null
    const bomEl = document.getElementById('bomSelectorOperate'); 
    const batchEl = document.getElementById('activeBatches');
    const tbody = document.getElementById('outputBody');

    // Kiểm tra xem các phần tử có tồn tại trong HTML không
    if (!bomEl || !batchEl || !tbody) {
        console.error("Thiếu phần tử HTML:", { bomEl, batchEl, tbody });
        return window.showToast("Lỗi hệ thống: Không tìm thấy bảng nhập liệu!", "error");
    }

    const sku = bomEl.value;
    const bId = batchEl.value;
    
    if(!bId) return window.showToast("⚠️ Vui lòng chọn Mã Lô vận hành!", "warning");
    if(!sku) return window.showToast("⚠️ Vui lòng chọn công thức!", "warning");

    // Kiểm tra dữ liệu BOM có tồn tại trong bộ nhớ không
    console.log("Đang áp dụng SKU:", sku);
    console.log("Dữ liệu trong GLOBAL_BOM:", GLOBAL_BOM[sku]);

    if(!GLOBAL_BOM[sku]) {
        return window.showToast("❌ Không tìm thấy dữ liệu định mức cho mã này!", "error");
    }

    // Xóa sạch bảng hiện tại
    tbody.innerHTML = ''; 

    // Duyệt qua mảng nguyên liệu của SKU đó
    GLOBAL_BOM[sku].forEach(item => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>
              <select class="c-step" style="width:100%">
                  <option value="${item.process || 'Cân'}" selected>⚖️ ${item.process || 'Cân'}</option>
                  <option value="Trộn">🌀 Trộn</option>
                  <option value="Sấy">♨️ Sấy</option>
                  <option value="Chiết rót">🧪 Chiết rót</option>
                  <option value="Đóng gói">📦 Đóng gói</option>
                  <option value="Dán nhãn">🏷️ Dán nhãn</option>
              </select>
            </td>
            <td><input type="text" class="c-rm" value="${item.name || ''}" readonly style="background:rgba(255,255,255,0.05)"></td>
            <td><input type="text" class="c-lot" placeholder="Nhập lô NL"></td>
            <td>
                <div style="display:flex; gap:5px; align-items:center;">
                    <input type="number" class="c-out" value="${item.amount || 0}" style="width:70px">
                    <span style="font-size:11px">kg</span>
                </div>
            </td>
            <td><button onclick="this.closest('tr').remove()" class="btn-delete">✕</button></td>
        `;
        tbody.appendChild(row);
    });
    
    window.showToast(`✅ Đã áp dụng định mức cho ${sku}`, "success");
};
/* ==========================================================================
   BLOCK 2: MỤC 01 - QUẢN ĐỐC (ĐÃ LOẠI BỎ SKU)
   ========================================================================== */
window.initBatch = async function() {
    const batchEl = document.getElementById('batchID');
    const orderEl = document.getElementById('orderID');

    if(!batchEl || !batchEl.value) return window.showToast("Vui lòng nhập Mã Lô!", "warning");

    const payload = {
        action: 'init',
        batch_id: batchEl.value.trim(),
        order_id: orderEl ? orderEl.value.trim() : ""
    };

    window.showToast("Đang kích hoạt hồ sơ...", "warning");
    
    const success = await window.sendToDatabase(payload);
    if (success) {
        // Cập nhật tạm thời vào DB cục bộ
        window.db.push({
            batch_id: payload.batch_id,
            order_id: payload.order_id,
            status: 'Created',
            outputLogs: []
        });
        
        window.saveToLocal();
        window.updateBatchSelector();
        window.updateDashboard();
        window.showToast("Kích hoạt hồ sơ thành công!", "success");
        
        batchEl.value = "";
        if (orderEl) orderEl.value = "";

        // Gọi tải lại dữ liệu từ server (nếu hàm tồn tại)
        if (typeof window.loadExistingBatches === 'function') {
            await window.loadExistingBatches();
        }
    } else {
        window.showToast("Lỗi kết nối máy chủ!", "error");
    }
};

/* ==========================================================================
   BLOCK 3: MỤC 02 - VẬN HÀNH & TRA CỨU BOM (GỘP BOM VÀO BẢNG)
   ========================================================================== */
window.loadBOMFromServer = async function() {
    try {
        const response = await fetch(`${GOOGLE_SCRIPT_URL}?action=get_bom`);
        // Chờ nhận dữ liệu JSON từ Apps Script
        GLOBAL_BOM = await response.json(); 
        
        console.log("Dữ liệu BOM nhận được:", GLOBAL_BOM); // Kiểm tra trong Console F12

        const selector = document.getElementById('bomSelectorOperate'); 
        if(selector) {
            // Xóa sạch options cũ
            selector.innerHTML = '<option value="">-- CHỌN CÔNG THỨC (BOM) --</option>';
            
            // Lấy danh sách SKU từ các Key của Object GLOBAL_BOM
            const skus = Object.keys(GLOBAL_BOM);
            
            if (skus.length === 0) {
                console.warn("Cảnh báo: Sheet BOM trống hoặc không tìm thấy dữ liệu.");
                return;
            }

            skus.forEach(sku => {
                const opt = document.createElement('option');
                opt.value = sku.trim(); // Loại bỏ khoảng trắng thừa
                opt.textContent = sku.trim();
                selector.appendChild(opt);
            });
            
            window.showToast("Đã cập nhật danh sách BOM mới nhất", "info");
        }
    } catch (e) { 
        console.error("Lỗi khi kết nối lấy BOM:", e);
        window.showToast("Không thể tải danh sách BOM!", "error");
    }
};

// HÀM QUAN TRỌNG: Đổ dữ liệu từ BOM vào bảng Nhật ký
window.applyBOMToTable = function() {
    const bomEl = document.getElementById('bomSelectorOperate'); // ID đã đổi
    const batchEl = document.getElementById('activeBatches');
    const tbody = document.getElementById('outputBody');

    if (!bomEl || !batchEl) return;

    const sku = bomEl.value;
    const bId = batchEl.value;
    
    if(!bId) return window.showToast("⚠️ Vui lòng chọn Mã Lô vận hành!", "warning");
    if(!sku) return window.showToast("⚠️ Vui lòng chọn công thức!", "warning");

    tbody.innerHTML = ''; 
    GLOBAL_BOM[sku].forEach(item => {
        const row = document.createElement('tr');
        // Tìm đoạn row.innerHTML trong hàm applyBOMToTable và thay bằng:
        row.innerHTML = `
            <td>
              <select class="c-step" style="width:100%">
                  <option value="${item.process || 'Cân'}" selected>⚖️ ${item.process || 'Cân'}</option>
                  <option value="Trộn">🌀 Trộn</option>
                  <option value="Sấy">♨️ Sấy</option>
                  <option value="Chiết rót">🧪 Chiết rót</option>
                  <option value="Đóng gói">📦 Đóng gói</option>
                  <option value="Dán nhãn">🏷️ Dán nhãn</option>
              </select>
            </td>
            <td><input type="text" class="c-rm" value="${item.name}" readonly></td>
            <td><input type="text" class="c-lot" placeholder="NHẬP LÔ NL..."></td>
            <td>
                <div style="display:flex; gap:5px; align-items:center;">
                    <input type="number" 
                           class="c-out" 
                           value="${item.amount}" 
                           step="0.01" 
                           placeholder="0.00"
                           style="width:90px">
                    <span class="c-unit-label">kg</span>
                </div>
            </td>
            </td>
            <td><button onclick="this.closest('tr').remove()" class="btn-delete">✕</button></td>
        `;
        tbody.appendChild(row);
    });
    window.showToast("✅ Đã áp dụng định mức!");
};

window.saveProduction = async function() {
    const bId = document.getElementById('activeBatches').value;
    const batch = window.db.find(b => b.batch_id === bId); 
    if(!batch) return;

    const rows = document.querySelectorAll('#outputBody tr');
    const outputLogs = Array.from(rows).map(r => ({
        batch_id: bId,
        ingridient: r.querySelector('.c-rm')?.value,
        rm_batch_id: r.querySelector('.c-lot')?.value,
        input: r.querySelector('.c-out')?.value, 
        process: r.querySelector('.c-step')?.value,
        timestamp: new Date().toLocaleString('vi-VN')
    }));

    if(await window.sendToDatabase({ action: 'save', batch_id: bId, output: outputLogs })) {
        batch.status = 'Produced';
        batch.outputLogs = outputLogs;
        window.saveToLocal();
        window.updateBadgeStatus(batch);
        window.showToast("💾 Đã lưu dữ liệu sản xuất!");
    }
};
/* ==========================================================================
   BLOCK 4: MỤC 03 - KIỂM ĐỊNH (QC)
   ========================================================================== */

// 1. Hàm tải dữ liệu của lô cần kiểm định
window.loadQCData = function(batchId) {
    if (!batchId) return;
    
    const batch = window.db.find(b => b.batch_id === batchId);
    if (!batch) return;

    // Cập nhật trạng thái hiển thị (Badge)
    window.updateBadgeStatus(batch);
    
    // Nếu lô đã sản xuất, thông báo cho QC
    if (batch.status === 'Produced') {
        window.showToast(`Lô ${batchId} đã sẵn sàng kiểm định`, "info");
    }
};

// 2. Hàm cập nhật văn bản hiển thị khi gạt nút Pass/Fail
window.updateQCStatusText = function() {
    const toggle = document.getElementById('pqcToggle');
    const statusInput = document.getElementById('pqcStatus');
    // Nếu checkbox được tích (checked) là Pass, ngược lại là Fail
    const status = toggle.checked ? "Pass" : "Fail";
    
    if(statusInput) statusInput.value = status;
    
    // Hiển thị toast để người dùng biết trạng thái đang chọn
    const color = toggle.checked ? "#2ecc71" : "#e74c3c";
    window.showToast(`Trạng thái: ${status.toUpperCase()}`, toggle.checked ? "success" : "error");
};

// 3. Hàm xác nhận hoàn thành và đẩy dữ liệu lên Cloud
window.finalizeQC = async function() {
    const bId = document.getElementById('qcBatchSelect').value;
    const pqcStatus = document.getElementById('pqcToggle').checked ? "Pass" : "Fail";
    const note = document.getElementById('qcNote').value;
    const finalYield = document.getElementById('qcFinalYield').value; // Lấy sản lượng thành phẩm

    if (!bId) return window.showToast("⚠️ Vui lòng chọn mã lô cần thẩm định!", "warning");
    if (!finalYield) return window.showToast("⚠️ Vui lòng nhập sản lượng thành phẩm!", "warning");

    const payload = {
        action: 'finalize',
        batch_id: bId,
        pqc_status: pqcStatus,
        note: note,
        final_yield: finalYield // Gửi thêm trường sản lượng
    };

    window.showToast("Đang xác nhận hoàn thành...", "warning");

    const success = await window.sendToDatabase(payload);
    if (success) {
        const batch = window.db.find(b => b.batch_id === bId);
        if (batch) {
            batch.status = 'Completed';
            batch.pqc_status = pqcStatus;
            batch.final_yield = finalYield;
        }
        
        window.saveToLocal();
        window.updateBatchSelector();
        window.updateDashboard();
        window.updateBadgeStatus(batch);
        
        window.showToast("✅ ĐÃ HOÀN TẤT HỒ SƠ LÔ SẢN XUẤT!", "success");
        
        // Reset form
        document.getElementById('qcNote').value = "";
        document.getElementById('qcFinalYield').value = "";
    } else {
        window.showToast("Lỗi kết nối khi gửi dữ liệu QC!", "error");
    }
};
/* ==========================================================================
   BLOCK 5: UI & HỆ THỐNG (UI HELPERS)
   ========================================================================== */
// Xuất PDF
window.exportBatchPDF = function() {
    const searchId = document.getElementById('searchId')?.value.trim() || 
                     document.getElementById('qcBatchSelect')?.value || 
                     document.getElementById('activeBatches')?.value;

    const batch = (window.db || []).find(b => String(b.batch_id) === String(searchId));
    if (!batch) return window.showToast("Không tìm thấy mã lô để xuất báo cáo!", "error");
    // KIỂM TRA: Nếu lô có trong DB nhưng outputLogs trống, hãy báo nhắc người dùng
    if (!batch.outputLogs || batch.outputLogs.length === 0) {
        window.showToast("Cảnh báo: Lô này chưa có nhật ký sản xuất được lưu!", "warning");
        // Bạn có thể giữ lại lệnh return nếu muốn chặn xuất PDF trống
        // return; 
    }
    try {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();

        // 1. Vẽ Khung Viền Trang
        doc.setDrawColor(44, 62, 80);
        doc.setLineWidth(1);
        doc.rect(5, 5, pageWidth - 10, pageHeight - 10);

        // 2. Header Công Ty
        doc.setFont("helvetica", "bold");
        doc.setFontSize(18);
        doc.setTextColor(44, 62, 80);
        doc.text("NGOCDUY TEA Ltd. MANUFACTURING SYSTEM", pageWidth / 2, 20, { align: "center" });
        
        doc.setFontSize(10);
        doc.setTextColor(100);
        doc.setFont("helvetica", "normal");
        doc.text("Dia chi: 73/17 Phan Chu Trinh, P.Lam Vien - Da Lat, Lam Dong, Viet Nam", pageWidth / 2, 26, { align: "center" });
        doc.line(20, 30, pageWidth - 20, 30);

        // 3. Tên Báo Cáo
        doc.setFontSize(16);
        doc.setTextColor(0, 102, 204);
        doc.setFont("helvetica", "bold");
        doc.text("PHIEU KIEM SOAT LO SAN XUAT", pageWidth / 2, 42, { align: "center" });
        doc.text(`(E-BATCH RECORD: ${batch.batch_id})`, pageWidth / 2, 50, { align: "center" });

        // 4. Thông Tin Chung
        doc.setFontSize(11);
        doc.setTextColor(0);
        doc.text(`Ma Lo (Batch ID): ${batch.batch_id}`, 20, 65);
        doc.text(`Ma Lenh (Order ID): ${batch.order_id || 'N/A'}`, 20, 72);
        doc.text(`San Luong TP: ${batch.final_yield || '0'} kg`, 20, 79);

        doc.text(`Ngay Xuat: ${new Date().toLocaleDateString('vi-VN')}`, 130, 65);
        doc.text(`Trang Thai: ${batch.status}`, 130, 72);

        // Xử lý logic QC
        const rawStatus = batch.pqc_status ? String(batch.pqc_status).trim().toLowerCase() : "";
        const qcResultDisplay = rawStatus ? rawStatus.toUpperCase() : "CHUA KIEM DINH";
        doc.text(`Ket Qua QC: ${qcResultDisplay}`, 130, 79);

        // 5. Bảng Nhật Ký Sản Xuất
// 5. Bảng Nhật Ký Sản Xuất (Cập nhật logic đơn vị động)
        const tableData = (batch.outputLogs || []).map((log, index) => {
            // Xác định đơn vị dựa trên công đoạn
            let unit = "kg"; 
            const process = log.process ? log.process.trim() : "";

            if (process === "Đóng gói") {
                unit = "bao/thùng";
            } else if (process === "Dán nhãn") {
                unit = "tem";
            } else if (process === "Chiết rót") {
                unit = "chai/túi";
            }

            return [
                index + 1, 
                vniSafe(log.process || '-'),      // Khử dấu "Đóng gói" -> "Dong goi"
                vniSafe(log.ingridient || '-'),   // Khử dấu tên nguyên liệu
                log.rm_batch_id || '-', 
                `${log.input || '0'} ${unit}`, // KHỐI LƯỢNG ĐỊNH MỨC
                "",                      // CỘT MỚI: KHỐI LƯỢNG THỰC TẾ (Để trống)
                log.timestamp ? log.timestamp.split(',')[0] : '-'
            ];
        });

        doc.autoTable({
            startY: 85,
            head: [['STT', 'CONG DOAN', 'NGUYEN LIEU', 'LO RM (LOT)', 'KLUONG','KLG THUC TE', 'THOI GIAN']],
            body: tableData,
            theme: 'grid',
            headStyles: { fillColor: [44, 62, 80], textColor: [255, 255, 255], fontStyle: 'bold', halign: 'center',fontSize: 9}, // Giảm nhẹ font size để vừa với cột mới 
            bodyStyles: { halign: 'center' },
            columnStyles: { 2: { halign: 'left' }, 5: { cellWidth: 30 }},     // Ưu tiên độ rộng cho cột thực tế để dễ viết tay 
        });

        // 6. Ghi chú & Chữ ký (Tính toán tọa độ sau khi có bảng)
        let finalY = doc.lastAutoTable.finalY + 15;
        
        doc.setFont("helvetica", "italic");
        doc.setFontSize(10);
        doc.text(`Ghi chu QC: ${batch.note || 'Khong co ghi chu dac biet.'}`, 20, finalY);

        let signY = finalY + 20;
        doc.setFont("helvetica", "bold");
        doc.text("QUAN DOC XUONG", 40, signY, { align: "center" });
        doc.text("KIEM SOAT CHAT LUONG", pageWidth - 60, signY, { align: "center" });
        
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.text("(Ky va ghi ro ho ten)", 40, signY + 5, { align: "center" });
        doc.text("(Ky va ghi ro ho ten)", pageWidth - 60, signY + 5, { align: "center" });

        // 7. VẼ DẤU MỘC (Đây là phần quan trọng nhất)
        if (rawStatus === "pass") {
            doc.setDrawColor(255, 0, 0);
            doc.setLineWidth(0.8);
            doc.circle(pageWidth - 60, signY + 15, 12); // Vẽ mộc tròn
            doc.setTextColor(255, 0, 0);
            doc.setFontSize(10);
            doc.setFont("helvetica", "bold");
            doc.text("QC PASS", pageWidth - 60, signY + 16, { align: "center" });
        } 
        else if (batch.status === "Completed" && !rawStatus) {
            doc.setDrawColor(150);
            doc.setLineWidth(0.5);
            doc.circle(pageWidth - 60, signY + 15, 12);
            doc.setTextColor(150);
            doc.setFontSize(8);
            doc.text("DU LIEU CU", pageWidth - 60, signY + 16, { align: "center" });
        }

        // 8. Xuất file
        doc.save(`MES_Report_${batch.batch_id}.pdf`);
        window.showToast("Báo cáo đã sẵn sàng!", "success");

    } catch (err) { 
        console.error("Lỗi xuất PDF:", err);
        window.showToast("Lỗi khi tạo báo cáo PDF!", "error"); 
    }
};

// Quét mã QR
window.startScan = async function(targetId) {
    const confirmModal = document.getElementById('confirm-modal');
    confirmModal.style.display = 'flex';

    const userChoice = await new Promise((resolve) => {
        document.getElementById('btn-allow-cam').onclick = () => { confirmModal.style.display = 'none'; resolve(true); };
        document.getElementById('btn-cancel-cam').onclick = () => { confirmModal.style.display = 'none'; resolve(false); };
    });

    if (!userChoice) return;
    document.getElementById('camera-modal').style.display = 'flex';
    if (!html5QrCode) html5QrCode = new Html5Qrcode("reader");

    try {
        await html5QrCode.start(
            { facingMode: "environment" }, 
            { fps: 10, qrbox: 250 },
            (decodedText) => {
                const selectEl = document.getElementById(targetId);
                if ([...selectEl.options].some(opt => opt.value === decodedText)) {
                    selectEl.value = decodedText;
                    window.loadBatchData(decodedText);
                    window.showToast("Nhận diện thành công!", "success");
                    window.stopScan();
                } else { window.showToast("Mã QR không hợp lệ!", "error"); }
            }
        );
    } catch (err) { window.showToast("Lỗi camera!", "error"); window.stopScan(); }
};

window.stopScan = function() {
    if (html5QrCode) {
        html5QrCode.stop().then(() => {
            document.getElementById('camera-modal').style.display = 'none';
        }).catch(() => { document.getElementById('camera-modal').style.display = 'none'; });
    }
};

// Hỗ trợ UI: Table, Dashboard, Badge
window.addRow = function() {
    const tbody = document.getElementById('outputBody');
    const row = document.createElement('tr');
    
    // Ở đây chúng ta để giá trị cố định là "Cân", không dùng biến ${item...}
    row.innerHTML = `
        <td>
            <select class="c-step" style="width:100%" onchange="updateUnit(this)">
                <option value="Cân" selected>⚖️ Cân</option>
                <option value="Trộn">🌀 Trộn</option>
                <option value="Sấy">♨️ Sấy</option>
                <option value="Chiết rót">🧪 Chiết rót</option>
                <option value="Đóng gói">📦 Đóng gói</option>
                <option value="Dán nhãn">🏷️ Dán nhãn</option>
            </select>
        </td>
        <td><input type="text" class="c-rm" placeholder="Tên nguyên liệu..."></td>
        <td><input type="text" class="c-lot" placeholder="NHẬP LÔ NL..."></td>
        <td>
            <div style="display:flex; gap:5px; align-items:center;">
                <input type="number" class="c-out" value="0" step="0.01" style="width:90px">
                <span class="c-unit-label" style="color: #FFD700; font-weight: bold;">kg</span>
            </div>
        </td>
        <td><button onclick="this.closest('tr').remove()" class="btn-delete">✕</button></td>
    `;
    tbody.appendChild(row);
};

window.addRowWithData = function(target, log) {
    const tbody = document.getElementById(target);
    const row = document.createElement('tr');
    row.innerHTML = `
        <td><select class="c-step"><option value="Cân" ${log.process === 'Cân' ? 'selected' : ''}>⚖️ Cân</option></select></td>
        <td><input type="text" class="c-rm" value="${log.ingridient || ''}"></td>
        <td><input type="text" class="c-lot" value="${log.rm_batch_id || ''}"></td>
        <td style="display: flex; gap: 5px;"><input type="number" class="c-out" value="${log.input || ''}"><select class="c-unit"><option value="Kg">Kg</option></select></td>
        <td><button onclick="this.closest('tr').remove()" class="btn-delete">✕</button></td>`;
    tbody.appendChild(row);
};

window.updateBatchSelector = function() {
    const optionsHtml = window.db.map(batch => `<option value="${batch.batch_id}">${batch.batch_id} - ${batch.sku_id} [${batch.status}]</option>`).join('');
    const defaultOption = '<option value="">-- CHỌN MÃ LÔ --</option>';
    ['activeBatches', 'qcBatchSelect'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.innerHTML = defaultOption + optionsHtml;
    });
};

window.updateDashboard = function() {
    if (!window.db) return;
    document.getElementById('dash-total').textContent = window.db.length;
    document.getElementById('dash-completed').textContent = window.db.filter(b => b.status === 'Completed').length;
    document.getElementById('dash-pending').textContent = window.db.filter(b => b.status !== 'Completed').length;
};

window.updateBadgeStatus = function(batch) {
    document.querySelectorAll('.badge').forEach(b => b.classList.remove('active'));
    if (batch.status === 'Created') document.getElementById('badge-supervisor')?.classList.add('active');
    else if (batch.status === 'Produced') document.getElementById('badge-operator')?.classList.add('active');
    else if (batch.status === 'Completed') document.getElementById('badge-qc')?.classList.add('active');
    window.controlSections(batch.status);
};

window.controlSections = function(status) {
    const sec2 = document.querySelector('.section-2');
    const sec3 = document.querySelector('.section-3');
    
    // Reset lại trạng thái trước khi áp dụng logic mới
    [sec2, sec3].forEach(s => {
        s.style.opacity = "1";
        s.style.pointerEvents = "all";
        s.querySelectorAll('input, select, button').forEach(i => i.disabled = false);
    });

    if (status === 'Created') { 
        // Lô mới tạo: Chỉ cho làm ở Section 2, khóa Section 3
        sec3.style.opacity = "0.4"; 
        sec3.style.pointerEvents = "none"; 
    } 
    else if (status === 'Produced') { 
        // Lô đã sản xuất: Mở cả 2 để QC kiểm tra
        sec2.style.opacity = "1"; 
        sec3.style.opacity = "1"; 
    } 
    else if (status === 'Completed') { 
        // Lô đã đóng hồ sơ: KHÓA TOÀN BỘ để bảo mật dữ liệu
        [sec2, sec3].forEach(s => { 
            s.style.opacity = "0.6"; 
            s.querySelectorAll('input, select, button').forEach(i => {
                if(!i.classList.contains('btn-icon')) i.disabled = true; 
            });
        });
        window.showToast("Hồ sơ này đã đóng, không thể chỉnh sửa.", "info");
    }
};

window.showToast = function(message, type = 'success') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    const icon = type === 'success' ? '✅' : type === 'error' ? '❌' : '⚠️';
    toast.className = `toast ${type}`;
    toast.innerHTML = `<span>${icon}</span> <span>${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => { toast.style.animation = "slideIn 0.4s reverse forwards"; setTimeout(() => toast.remove(), 400); }, 4000);
};

window.updateUnit = function(selectElement) {
    // Tìm đến hàng (tr) chứa cái select này
    const row = selectElement.closest('tr');
    // Tìm nhãn đơn vị trong hàng đó
    const unitLabel = row.querySelector('.c-unit-label');
    const selectedValue = selectElement.value;

    // Logic đổi tên đơn vị
    if (selectedValue === "Đóng gói") {
        unitLabel.innerText = "bao/thùng";
    } else if (selectedValue === "Dán nhãn") {
        unitLabel.innerText = "tem";
    } else if (selectedValue === "Chiết rót") {
        unitLabel.innerText = "chai/túi";
    } else {
        unitLabel.innerText = "kg"; // Mặc định cho Cân và Trộn
    }
};
//HÀM KHỬ DẤU CHO XUẤT PDF
window.removeVietnameseTones = function(str) {
    if (!str) return "";
    str = str.replace(/à|á|ạ|ả|ã|â|ầ|ấ|ậ|ẩ|ẫ|ă|ằ|ắ|ặ|ẳ|ẵ/g, "a");
    str = str.replace(/è|é|ẹ|ẻ|ẽ|ê|ề|ế|ệ|ể|ễ/g, "e");
    str = str.replace(/ì|í|ị|ỉ|ĩ/g, "i");
    str = str.replace(/ò|ó|ọ|ỏ|õ|ô|ồ|ố|ộ|ổ|ỗ|ơ|ờ|ớ|ợ|ở|ỡ/g, "o");
    str = str.replace(/ù|ú|ụ|ủ|ũ|ư|ừ|ứ|ự|ử|ữ/g, "u");
    str = str.replace(/ỳ|ý|ỵ|ỷ|ỹ/g, "y");
    str = str.replace(/đ/g, "d");
    str = str.replace(/À|Á|Ạ|Ả|Ã|Â|Ầ|Ấ|Ậ|Ẩ|Ẫ|Ă|Ằ|Ắ|Ặ|Ẳ|Ẵ/g, "A");
    str = str.replace(/È|É|Ẹ|Ẻ|Ẽ|Ê|Ề|Ế|Ệ|Ể|Ễ/g, "E");
    str = str.replace(/Ì|Í|Ị|Ỉ|Ĩ/g, "I");
    str = str.replace(/Ò|Ó|Ọ|Ỏ|Õ|Ô|Ồ|Ố|Ộ|Ổ|Ỗ|Ơ|Ờ|Ớ|Ợ|Ở|Ỡ/g, "O");
    str = str.replace(/Ù|Ú|Ụ|Ủ|Ũ|Ư|Ừ|Ứ|Ự|Ử|Ữ/g, "U");
    str = str.replace(/Ỳ|Ý|Y|Ỷ|Ỹ/g, "Y");
    str = str.replace(/Đ/g, "D");
    return str;
};
/* ==========================================================================
   BLOCK 6: KHỞI CHẠY (INITIALIZE)
   ========================================================================== */
window.addEventListener('DOMContentLoaded', async () => {
    console.log("🚀 MES PRO đang khởi động...");
    
    // 1. Tải dữ liệu từ bộ nhớ tạm
    window.loadFromLocal();
    
    // 2. Tải danh sách lô từ Server
    await window.loadExistingBatches();
    
    // 3. Tải danh sách Công thức (BOM)
    // Hàm này sẽ lấy các mã sản phẩm (sku_id) đổ vào dropdown
    await window.loadBOMFromServer();
    
    console.log("✅ Hệ thống đã sẵn sàng.");
});
