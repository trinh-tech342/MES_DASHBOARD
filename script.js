// Khai báo db ở đầu file
let db = []; 
const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxQoyOquzvXQeUXo_of0Cj3wRvqN0JWydh49BeNX8hk9s1Jb8M3No2unWgPfrvEonZz1Q/exec";

// --- HÀM 1: KHỞI TẠO LÔ (QUẢN ĐỐC) ---
window.initBatch = async function() {
    console.log("Đang khởi tạo lô...");
    const batchEl = document.getElementById('batchID');
    const orderEl = document.getElementById('orderID');
    const skuEl = document.getElementById('skuID');

    // Kiểm tra an toàn để tránh lỗi "reading value of null"
    if (!batchEl || !skuEl) {
        alert("Lỗi: Không tìm thấy ô nhập liệu! Hãy kiểm tra lại ID trong HTML.");
        return;
    }

    const bVal = batchEl.value;
    const oVal = orderEl ? orderEl.value : "";
    const sVal = skuEl.value;

    if(!bVal || !sVal) return alert("Vui lòng nhập đầy đủ Mã Lô và SKU!");

    const payload = {
        action: 'init',
        batch_id: bVal,
        order_id: oVal,
        sku_id: sVal
    };

    // Thêm vào db cục bộ và cập nhật UI ngay
    db.push({...payload, status: 'Created', outputLogs: []});
    window.updateBatchSelector();
    
    alert("✅ Đã khởi tạo Lô thành công!");
    await window.sendToDatabase(payload);
};

// --- HÀM 2: LƯU SẢN XUẤT (VẬN HÀNH) ---
window.saveProduction = async function() {
    const bId = document.getElementById('activeBatches').value;
    const batch = db.find(b => b.batch_id === bId); 
    
    if(!batch) return alert("Vui lòng chọn một Lô để lưu!");

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
        output: outputLogs 
    };

    const success = await window.sendToDatabase(payload);
    if(success) {
        batch.status = 'Produced';
        window.updateBadgeStatus(batch);
        alert("💾 Đã lưu Nhật ký sản xuất thành công!");
    }
};

// --- HÀM 3: HÀM GỬI DATA (CHỐNG TREO) ---
window.sendToDatabase = async function(payload) {
    try {
        // BỎ mode: "no-cors" để nhận phản hồi thực
        const response = await fetch(GOOGLE_SCRIPT_URL, {
            method: "POST",
            body: JSON.stringify(payload)
        });
        return true; 
    } catch (e) {
        console.error("Lỗi gửi dữ liệu:", e);
        return false;
    }
};

// --- CÁC HÀM UI HỖ TRỢ (PHẢI CÓ window.) ---
window.addRow = function(target) {
    const tbody = document.getElementById(target);
    if (!tbody) return;
    const row = document.createElement('tr');
    row.innerHTML = `
        <td><input type="text" class="c-step" placeholder="Công đoạn"></td>
        <td><input type="text" class="c-rm" placeholder="Nguyên liệu"></td>
        <td><input type="text" class="c-lot" placeholder="Lô RM"></td>
        <td><input type="number" class="c-out" placeholder="Số lượng"></td>
        <td><button onclick="this.closest('tr').remove()" style="background:none; border:none; color:#ff453a; cursor:pointer;">✕</button></td>
    `;
    tbody.appendChild(row);
};

window.updateBatchSelector = function() {
    const selector = document.getElementById('activeBatches');
    if(!selector) return;
    selector.innerHTML = '<option value="">-- CHỌN LÔ ĐANG VẬN HÀNH --</option>';
    db.forEach(batch => {
        const opt = document.createElement('option');
        opt.value = batch.batch_id; 
        opt.textContent = `${batch.batch_id} - ${batch.sku_id}`;
        selector.appendChild(opt);
    });
};

window.loadBatchData = function(selectedId) {
    const batch = db.find(b => b.batch_id === selectedId); 
    if (!batch) return;
    window.updateBadgeStatus(batch);
    document.getElementById('outputBody').innerHTML = ''; 
};

// --- 3. QC XÁC NHẬN ---
window.finalizeQC = async function() {
    // Lấy ID lô đang chọn từ Section 02
    const bId = document.getElementById('activeBatches')?.value;
    
    // Tìm lô trong cơ sở dữ liệu tạm thời
    const batch = db.find(b => b.batch_id === bId); 
    
    if(!bId || !batch) {
        return alert("⚠️ Vui lòng chọn một Lô tại mục 02 trước khi xác nhận QC!");
    }

    // Lấy dữ liệu từ các thẻ bạn vừa gửi
    const pqcStatus = document.getElementById('pqcStatus').value;
    const qcNote = document.getElementById('qcNote').value;
    // Tính tổng sản lượng từ bảng
    let total = 0;
    document.querySelectorAll('.c-out').forEach(input => {
        total += Number(input.value) || 0;
    });

    const payload = {
        action: 'finalize',
        batch_id: bId,
        total_output: total,
        pqc_status: document.getElementById('pqcStatus').value,
        note: document.getElementById('qcNote').value,
        start_time: batch.timestamp // Lấy từ lúc khởi tạo
    };
    
    // Hiển thị trạng thái đang xử lý
    console.log("Đang gửi xác nhận QC...", payload);

    const success = await window.sendToDatabase(payload);
    
    if(success) {
        batch.status = 'Completed'; // Cập nhật trạng thái cục bộ
        window.updateBadgeStatus(batch); // Cập nhật thanh trạng thái (Badges)
        alert("✅ Hồ sơ lô " + bId + " đã được QC chốt thành công!");
    } else {
        alert("❌ Lỗi hệ thống: Không thể gửi dữ liệu QC. Vui lòng kiểm tra kết nối!");
    }
};

window.updateBadgeStatus = function(batch) {
    document.querySelectorAll('.badge').forEach(b => b.classList.remove('active'));
    if (batch.status === 'Created') document.getElementById('badge-supervisor')?.classList.add('active');
    else if (batch.status === 'Produced') document.getElementById('badge-operator')?.classList.add('active');
    else if (batch.status === 'Completed') document.getElementById('badge-qc')?.classList.add('active');
};

