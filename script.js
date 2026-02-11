
// Khai báo db ở đầu file
let db = []; 

const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzRR59TJxarKIlptYAGoN-g-C5BeL1OdeiKNGq8QVsZgiPbUwfjGBTYanCusNNZYjY5/exec";

// Định nghĩa hàm rõ ràng
window.initBatch = async function() {
    console.log("Đang khởi tạo lô..."); // Dòng này để kiểm tra trong Console
    const batchId = document.getElementById('batchId').value;
    const orderId = document.getElementById('orderId').value;
    const skuId = document.getElementById('skuId').value;

    if(!batchId) {
        alert("Thiếu Batch ID!");
        return;
    }

    const payload = {
        action: 'init',
        batch_id: batchId,
        order_id: orderId,
        sku_id: skuId
    };

    // Thêm vào db cục bộ
    db.push({...payload, status: 'Created', outputLogs: []});
    
    // Gọi hàm cập nhật giao diện
    if (typeof updateBatchSelector === "function") {
        updateBatchSelector();
    }

    alert("✅ Khởi tạo thành công lô: " + batchId);
    
    // Gửi đi
    await sendToDatabase(payload);
};

// Đảm bảo hàm sendToDatabase cũng tồn tại
async function sendToDatabase(payload) {
    try {
        await fetch(GOOGLE_SCRIPT_URL, {
            method: "POST",
            mode: "no-cors",
            body: JSON.stringify(payload)
        });
        return true;
    } catch (e) {
        console.error(e);
        return false;
    }
}

// Cần định nghĩa thêm hàm này để không bị lỗi khi gọi ở trên
window.updateBatchSelector = function() {
    const selector = document.getElementById('activeBatches');
    if(!selector) return;
    selector.innerHTML = '<option value="">-- CHỌN LÔ ĐANG VẬN HÀNH --</option>';
    db.forEach(batch => {
        const opt = document.createElement('option');
        opt.value = batch.batchId;
        opt.textContent = batch.batchId;
        selector.appendChild(opt);
    });
};
// --- CÁC HÀM UI BỔ TRỢ ---

function updateBatchSelector() {
    const selector = document.getElementById('activeBatches');
    selector.innerHTML = '<option value="">-- CHỌN LÔ ĐANG VẬN HÀNH --</option>';
    db.forEach(batch => {
        const opt = document.createElement('option');
        opt.value = batch.batchId;
        opt.textContent = `${batch.batchId} - ${batch.skuId}`;
        selector.appendChild(opt);
    });
}

function updateBadgeStatus(batch) {
    // Reset all badges
    document.querySelectorAll('.badge').forEach(b => b.classList.remove('active'));
    
    if (batch.status === 'Created') {
        document.getElementById('badge-supervisor').classList.add('active');
    } else if (batch.status === 'Produced') {
        document.getElementById('badge-operator').classList.add('active');
    } else if (batch.status === 'Completed') {
        document.getElementById('badge-qc').classList.add('active');
    }
}

// Load dữ liệu khi chọn lô từ dropdown
function loadBatchData(batchId) {
    const batch = db.find(b => b.batchId === batchId);
    if (!batch) return;
    
    updateBadgeStatus(batch);
    const tbody = document.getElementById('outputBody');
    tbody.innerHTML = ''; // Clear table
    
    // Nếu lô này đã có dữ liệu sản xuất trước đó, có thể render lại ở đây
}

// --- CÁC HÀM CHÍNH ---

// 1. QUẢN ĐỐC KHỞI TẠO
async function initBatch() {
    const batchId = document.getElementById('batchID').value;
    const orderId = document.getElementById('orderID').value;
    const skuId = document.getElementById('skuID').value;

    if(!batchId || !skuId) return alert("Vui lòng nhập đầy đủ thông tin!");

    const payload = {
        action: 'init',
        batch_id: batchId,
        order_id: orderId,
        sku_id: skuId
    };

    // Lưu vào bộ nhớ tạm trước để UI mượt mà
    db.push({...payload, status: 'Created', outputLogs: []});
    updateBatchSelector();
    
    await sendToDatabase(payload);
    alert("✅ Quản đốc đã khởi tạo Lô thành công!");
}

// Thêm dòng mới vào bảng
function addRow(target) {
    const tbody = document.getElementById(target);
    const row = document.createElement('tr');
    // Cập nhật lại HTML row để khớp với tiêu đề bảng của bạn
    row.innerHTML = `
        <td><input type="text" class="c-step" placeholder="Công đoạn"></td>
        <td><input type="text" class="c-rm" placeholder="Nguyên liệu"></td>
        <td><input type="text" class="c-lot" placeholder="Lô RM"></td>
        <td><input type="number" class="c-out" placeholder="Số lượng"></td>
        <td><button onclick="this.closest('tr').remove()" style="background:none; border:none; color:#ff453a; cursor:pointer;">✕</button></td>
    `;
    tbody.appendChild(row);
}

// 2. SẢN XUẤT CẬP NHẬT
async function saveProduction() {
    const bId = document.getElementById('activeBatches').value;
    const batch = db.find(b => b.batchId === bId);
    if(!batch) return alert("Vui lòng chọn một Lô để lưu!");

    const rows = document.querySelectorAll('#outputBody tr');
    const outputLogs = Array.from(rows).map(r => ({
        step: r.querySelector('.c-step')?.value,
        rm: r.querySelector('.c-rm')?.value,
        lot: r.querySelector('.c-lot')?.value,
        out: r.querySelector('.c-out')?.value,
        timestamp: new Date().toLocaleString('vi-VN')
    }));

    const payload = {
        action: 'save',
        batch_id: bId,
        outputLogs: outputLogs
    };

    const success = await sendToDatabase(payload);
    if(success) {
        batch.status = 'Produced';
        updateBadgeStatus(batch);
        alert("💾 Đã lưu Nhật ký sản xuất thành công!");
    }
}

// 3. QC XÁC NHẬN
async function finalizeQC() {
    const bId = document.getElementById('activeBatches').value;
    const batch = db.find(b => b.batchId === bId);
    if(!batch) return alert("Chọn lô cần kiểm định!");
    
    const pqcStatus = document.getElementById('pqcStatus').value;
    const qcNote = document.getElementById('qcNote').value;

    const payload = {
        action: 'finalize',
        batch_id: bId,
        pqc_status: pqcStatus,
        note: qcNote
    };

    const success = await sendToDatabase(payload);
    if(success) {
        batch.status = 'Completed';
        updateBadgeStatus(batch);
        alert("✅ QC đã chốt hồ sơ thành công!");
    }
}

// Hàm gửi dữ liệu
async function sendToDatabase(payload) {
    try {
        // Lưu ý: no-cors sẽ không cho phép bạn đọc phản hồi từ Server, 
        // nhưng dữ liệu vẫn sẽ được gửi đi nếu URL đúng.
        await fetch(GOOGLE_SCRIPT_URL, {
            method: "POST",
            mode: "no-cors",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });
        return true;
    } catch (e) {
        console.error("Lỗi:", e);
        alert("Lỗi kết nối database!");
        return false;
    }
}
