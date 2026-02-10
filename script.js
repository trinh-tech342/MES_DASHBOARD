const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyZi4_9BUts0mJDeP4g8huVWREki0__EGVFjoN9DyvOMkFz8BVWQHoBft00gg5Uu38vOg/exec";

// 1. QUẢN ĐỐC KHỞI TẠO (Ghi vào sheet INPUT)
async function initBatch() {
    const batchId = document.getElementById('batchId').value;
    const orderId = document.getElementById('orderId').value;
    const skuId = document.getElementById('skuId').value;

    if(!batchId) return alert("Thiếu Batch ID!");

    const payload = {
        action: 'init',
        batchId: batchId,
        orderId: orderId,
        skuId: skuId
    };

    const success = await sendToDatabase(payload);
    if(success) {
        db.push({...payload, status: 'Created', outputLogs: []});
        updateBatchSelector();
        alert("✅ Quản đốc đã khởi tạo Lô thành công!");
    }
}

// 2. SẢN XUẤT CẬP NHẬT (Ghi vào sheet OUTPUT)
async function saveProduction() {
    const bId = document.getElementById('activeBatches').value;
    const batch = db.find(b => b.batchId === bId);
    if(!batch) return alert("Chọn Batch!");

    const rows = document.querySelectorAll('#outputBody tr');
    const now = new Date();
        function addRow(target) {
            const tbody = document.getElementById(target);
            const row = document.createElement('tr');
            row.innerHTML = `
                <td><input type="text" class="c-d-start" placeholder="Ngày bắt đầu" onfocus="(this.type='date')"></td>
                <td><input type="text" class="c-t-start" placeholder="Giờ bắt đầu" onfocus="(this.type='time')"></td>
                <td><input type="number" class="c-out" placeholder="Sản lượng (Out)"></td>
                <td><input type="text" class="c-note" placeholder="Ghi chú dòng"></td>
                <td><button onclick="this.closest('tr').remove()" class="btn-del">✕</button></td>
            `;
            tbody.appendChild(row);
        }
    const outputLogs = Array.from(rows).map(r => ({
        out: r.querySelector('.c-out')?.value || 0,
        note: r.querySelector('.c-note')?.value || "",
        timeStart: r.querySelector('.c-t-start')?.value || "",
        dateStart: r.querySelector('.c-d-start')?.value || "",
        timeFinish: now.toLocaleTimeString('vi-VN'),
        dateFinish: now.toLocaleDateString('vi-VN')
    }));

    const payload = {
        action: 'save',
        ...batch,
        outputLogs: outputLogs
    };

    const success = await sendToDatabase(payload);
    if(success) {
        batch.status = 'Produced';
        updateBadgeStatus(batch);
        alert("💾 Đã lưu Nhật ký vào sheet OUTPUT!");
    }
}

// 3. QC XÁC NHẬN (Cập nhật trạng thái PQC vào OUTPUT)
async function finalizeQC() {
    const bId = document.getElementById('activeBatches').value;
    const batch = db.find(b => b.batchId === bId);
    
    batch.pqcStatus = document.getElementById('pqcStatus').value;
    batch.qcNote = document.getElementById('qcNote').value;

    const payload = {
        action: 'finalize',
        ...batch
    };

    const success = await sendToDatabase(payload);
    if(success) {
        batch.status = 'Completed';
        updateBadgeStatus(batch);
        alert("✅ QC đã chốt hồ sơ và lưu vào OUTPUT!");
    }
}

// Hàm bổ trợ gửi dữ liệu
async function sendToDatabase(payload) {
    try {
        await fetch(GOOGLE_SCRIPT_URL, {
            method: "POST",
            mode: "no-cors",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });
        return true;
    } catch (e) {
        alert("Lỗi kết nối database!");
        return false;
    }
}
