/**
 * ====================================================================
 *                 ARMS INTEGRATION SUITE FOR GOOGLE SHEETS
 *                       Phiên bản Premium: 2.0.0
 * ====================================================================
 * Hệ thống tích hợp toàn diện:
 * 1. Trình cấu hình Wizard từng bước (không cần vào Project Settings).
 * 2. Đồng bộ hóa dữ liệu thời gian thực có hiển thị tiến độ.
 * 3. Tìm kiếm tệp tin chứa tài khoản trên Drive bằng bộ lọc Google Indexing.
 * 4. Gom dữ liệu tài khoản từ các tệp con cùng thư mục theo thời gian thực.
 * ====================================================================
 */

const ARMS_SCRIPT_VERSION = '2.0.0';

/**
 * Tạo Custom Menu khi người dùng mở trang tính.
 */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('ARMS')
    .addItem('1. Đồng bộ Tab hiện tại (Sync Current)', 'syncCurrentTab')
    .addItem('2. Đồng bộ Tất cả các Tab (Sync All)', 'syncAllTabs')
    .addSeparator()
    .addItem('🔍 Tra Cứu Danh Sách Tài Khoản (Paste List)', 'pasteAndLookupAccounts')
    .addItem('📊 Xem Thống Kê Kho MongoDB (Realtime)', 'showDashboardStats')
    .addItem('📋 Báo Cáo Tiến Độ Quét & Bóc Tách', 'checkScanProgressReport')
    .addItem('💾 Lưu Danh Sách File Tìm Được Vào MongoDB', 'saveSheetIndexToDb')
    .addItem('🔄 Khôi Phục Danh Sách File Từ MongoDB', 'restoreSheetIndexFromDb')
    .addSeparator()
    .addItem('3. Gom tài khoản các Sheet con chung Thư mục', 'aggregateFolderSheetsAutomatically')
    .addItem('4. Quét Tìm Sheet tài khoản Shopee cũ trên Drive', 'findOldShopeeAccountSheets')
    .addItem('5. Nhập kho tài khoản từ các Sheet đã tìm được', 'importDiscoveredSheetsToArms')
    .addItem('6. Trích xuất tài khoản chi tiết ra trang tính hiện tại', 'extractAccountsToMasterSheet')
    .addSeparator()
    .addItem('🚀 [AUTO] Toàn Bộ Pipeline → MongoDB (4+5+6)', 'runFullPipeline')
    .addItem('🛑 [AUTO] Dừng Pipeline Đang Chạy', 'stopPipeline')
    .addSeparator()
    .addItem('⚡ Kiểm tra kết nối API (Test Connection)', 'testConnection')
    .addItem('⚙️ Cấu hình thông tin kết nối (Setup Wizard)', 'runSetupWizard')
    .addToUi();
}

/**
 * ====================================================================
 * [1] WIZARD CẤU HÌNH NHANH (PREMIUM FEATURE)
 * ====================================================================
 */
function runSetupWizard() {
  const ui = SpreadsheetApp.getUi();
  const props = PropertiesService.getScriptProperties();

  // 1. Nhập API URL
  const currentUrl = props.getProperty('ARMS_API_BASE_URL') || 'https://xxxxxxxx.serveousercontent.com';
  const urlPrompt = ui.prompt(
    'BƯỚC 1/4: CẤU HÌNH ĐƯỜNG DẪN API',
    'Nhập đường link kết nối của bạn (Ví dụ từ Serveo hoặc tên miền chạy online):\n\nHiện tại: ' + currentUrl,
    ui.ButtonSet.OK_CANCEL
  );
  if (urlPrompt.getSelectedButton() !== ui.Button.OK) return;
  let newUrl = urlPrompt.getResponseText().trim();
  if (!newUrl) {
    newUrl = currentUrl;
  }
  
  // Chuẩn hóa URL: tự động thêm giao thức và xóa dấu gạch chéo cuối cùng
  if (newUrl.indexOf('http://') !== 0 && newUrl.indexOf('https://') !== 0) {
    newUrl = 'https://' + newUrl;
  }
  newUrl = newUrl.replace(/\/+$/, '');

  // 2. Nhập API Key
  const currentKey = props.getProperty('ARMS_API_KEY') || 'arms_apikey_xxxx';
  const keyPrompt = ui.prompt(
    'BƯỚC 2/4: CẤU HÌNH KHÓA BẢO MẬT (API KEY)',
    'Nhập API Key dự án (Lấy trong file .env):\n\nHiện tại: ' + currentKey,
    ui.ButtonSet.OK_CANCEL
  );
  if (keyPrompt.getSelectedButton() !== ui.Button.OK) return;
  let newKey = keyPrompt.getResponseText().trim();
  if (!newKey) {
    newKey = currentKey;
  }

  // 3. Nhập Web App URL (Tùy chọn cho đồng bộ 2 chiều)
  const currentWebAppUrl = props.getProperty('ARMS_WEB_APP_URL') || '';
  const webAppPrompt = ui.prompt(
    'BƯỚC 3/4: CẤU HÌNH WEB APP URL (ĐỒNG BỘ 2 CHIỀU)',
    'Dán link URL Ứng dụng web bạn vừa Triển khai để nhận phản hồi từ Server ngược về Google Sheets:\n\nHiện tại: ' + currentWebAppUrl,
    ui.ButtonSet.OK_CANCEL
  );
  if (webAppPrompt.getSelectedButton() !== ui.Button.OK) return;
  let newWebAppUrl = webAppPrompt.getResponseText().trim();
  if (!newWebAppUrl) {
    newWebAppUrl = currentWebAppUrl;
  }

  // 4. Nhập Người Quản Lý
  const currentManager = props.getProperty('ARMS_MANAGED_BY') || 'Admin Sơn Tây';
  const managerPrompt = ui.prompt(
    'BƯỚC 4/4: CẤU HÌNH NGƯỜI QUẢN LÝ',
    'Nhập tên hiển thị của bạn khi lưu trữ tài khoản:\n\nHiện tại: ' + currentManager,
    ui.ButtonSet.OK_CANCEL
  );
  if (managerPrompt.getSelectedButton() !== ui.Button.OK) return;
  let newManager = managerPrompt.getResponseText().trim();
  if (!newManager) {
    newManager = currentManager;
  }

  // Lưu cấu hình
  props.setProperty('ARMS_API_BASE_URL', newUrl);
  props.setProperty('ARMS_API_KEY', newKey);
  props.setProperty('ARMS_MANAGED_BY', newManager);
  if (newWebAppUrl) {
    props.setProperty('ARMS_WEB_APP_URL', newWebAppUrl);
  } else {
    props.deleteProperty('ARMS_WEB_APP_URL');
  }
  
  // Xóa HMAC cũ để đảm bảo mặc định dùng API Key ổn định
  props.deleteProperty('ARMS_HMAC_SECRET');

  ui.alert(
    'CẤU HÌNH THÀNH CÔNG',
    'Thông tin kết nối đã được cập nhật:\n\n' +
    '• API URL: ' + newUrl + '\n' +
    '• API Key: ' + newKey + '\n' +
    '• Web App URL: ' + (newWebAppUrl || 'Chưa cấu hình') + '\n' +
    '• Manager: ' + newManager + '\n\n' +
    'Bây giờ bạn đã có thể bắt đầu sử dụng các tính năng của ARMS.',
    ui.ButtonSet.OK
  );
}

/**
 * ====================================================================
 * [2] ĐỒNG BỘ HÓA DỮ LIỆU VỀ ARMS API
 * ====================================================================
 */

function syncCurrentTab() {
  const ui = SpreadsheetApp.getUi();
  const activeSs = SpreadsheetApp.getActiveSpreadsheet();
  
  try {
    const sheet = activeSs.getActiveSheet();
    const sheetName = sheet.getName();
    
    if (!shouldSyncSheet_(sheetName)) {
      ui.alert('Bỏ qua', 'Tab này nằm trong danh sách loại trừ hoặc là tab hệ thống.', ui.ButtonSet.OK);
      return;
    }

    if (!checkRowLimitAndConfirm_([sheet])) return;

    activeSs.toast('Đang đọc dữ liệu tab: ' + sheetName + '...', 'ARMS Sync', 1);
    const payload = buildPayload_(activeSs, [sheet], 'CURRENT_TAB');
    
    activeSs.toast('Đang gửi dữ liệu về Server...', 'ARMS Sync', 2);
    const result = sendToArms_(payload);
    
    showResult_(result);
  } catch (error) {
    ui.alert('Đồng bộ thất bại', 'Lỗi: ' + error.message, ui.ButtonSet.OK);
  }
}

function syncAllTabs() {
  const ui = SpreadsheetApp.getUi();
  const activeSs = SpreadsheetApp.getActiveSpreadsheet();
  
  try {
    const sheets = activeSs.getSheets().filter(function(sheet) {
      return shouldSyncSheet_(sheet.getName());
    });

    if (sheets.length === 0) {
      ui.alert('Không tìm thấy dữ liệu', 'Không có tab chứa tài khoản hợp lệ nào để đồng bộ.', ui.ButtonSet.OK);
      return;
    }

    if (!checkRowLimitAndConfirm_(sheets)) return;

    activeSs.toast('Đang gom dữ liệu từ ' + sheets.length + ' tab...', 'ARMS Sync', 2);
    const payload = buildPayload_(activeSs, sheets, 'ALL_TABS');
    
    activeSs.toast('Đang gửi dữ liệu về Server...', 'ARMS Sync', 2);
    const result = sendToArms_(payload);
    
    showResult_(result);
  } catch (error) {
    ui.alert('Đồng bộ thất bại', 'Lỗi: ' + error.message, ui.ButtonSet.OK);
  }
}

/**
 * ====================================================================
 * [3] GOM TÀI KHOẢN TỪ CÁC FILE CON CHUNG THƯ MỤC (REAL-TIME UPDATE)
 * ====================================================================
 */
function aggregateFolderSheetsAutomatically() {
  const ui = SpreadsheetApp.getUi();
  const activeSs = SpreadsheetApp.getActiveSpreadsheet();
  
  try {
    const currentFile = DriveApp.getFileById(activeSs.getId());
    const parents = currentFile.getParents();
    
    if (!parents.hasNext()) {
      ui.alert('Lỗi', 'Không tìm thấy thư mục chứa file này trên Drive.', ui.ButtonSet.OK);
      return;
    }
    
    const parentFolder = parents.next();
    const files = parentFolder.getFilesByType(MimeType.GOOGLE_SHEETS);
    
    let masterSheet = activeSs.getSheetByName("MASTER_ACCOUNTS");
    if (!masterSheet) {
      masterSheet = activeSs.insertSheet("MASTER_ACCOUNTS");
    }
    masterSheet.clearContents();
    masterSheet.appendRow(["Username", "Password", "Cookie", "Email", "Email Password", "Tên Tab Nguồn", "Tên File Nguồn"]);
    SpreadsheetApp.flush();

    let totalFilesProcessed = 0;
    let totalRowsAggregated = 0;

    activeSs.toast('Bắt đầu gom dữ liệu từ thư mục...', 'ARMS Aggregator', 2);

    while (files.hasNext()) {
      const file = files.next();
      // Bỏ qua chính file tổng hợp
      if (file.getId() === activeSs.getId()) {
        continue;
      }
      
      totalFilesProcessed++;
      const fileName = file.getName();
      activeSs.toast('Đang đọc file (' + totalFilesProcessed + '): ' + fileName, 'ARMS Aggregator', 2);
      
      try {
        const ss = SpreadsheetApp.open(file);
        const sheets = ss.getSheets();
        
        sheets.forEach(function(sheet) {
          const sheetName = sheet.getName();
          if (!shouldSyncSheet_(sheetName)) return;
          
          const lastRow = sheet.getLastRow();
          const lastCol = sheet.getLastColumn();
          if (lastRow === 0 || lastCol === 0) return;
          
          // Chỉ đọc tối đa 10 cột đầu của sheet (tiết kiệm 90% bộ nhớ so với đọc cả grid trống bên phải)
          const colsToRead = Math.min(10, lastCol);
          const values = sheet.getRange(1, 1, lastRow, colsToRead).getValues();

          const cleanedRows = [];
          const hasHeader = detectHeader_(values);
          const startRow = hasHeader ? 1 : 0;

          for (let i = startRow; i < values.length; i++) {
            const row = values[i];
            if (row.join("").trim() !== "") {
              cleanedRows.push([
                String(row[0] || '').trim(),
                String(row[1] || '').trim(),
                String(row[2] || '').trim(),
                String(row[3] || '').trim(),
                String(row[4] || '').trim(),
                sheetName,
                fileName
              ]);
            }
          }
          
          if (cleanedRows.length > 0) {
            totalRowsAggregated += cleanedRows.length;
            masterSheet.getRange(masterSheet.getLastRow() + 1, 1, cleanedRows.length, 7).setValues(cleanedRows);
            SpreadsheetApp.flush();
          }
        });
      } catch (e) {
        Logger.log("Lỗi đọc file: " + fileName + " - " + e.message);
      }
    }
    
    activeSs.toast('Gom dữ liệu hoàn tất!', 'ARMS Aggregator', 3);
    ui.alert(
      'GOM DỮ LIỆU HOÀN TẤT',
      'Đã hoàn thành gộp dữ liệu:\n\n' +
      '• Tổng số file con đã quét: ' + totalFilesProcessed + '\n' +
      '• Tổng số dòng tài khoản đã gộp: ' + totalRowsAggregated + '\n\n' +
      'Dữ liệu hiện đã sẵn sàng tại tab MASTER_ACCOUNTS.',
      ui.ButtonSet.OK
    );
  } catch (error) {
    ui.alert('Lỗi gộp dữ liệu', error.message, ui.ButtonSet.OK);
  }
}

/**
 * ====================================================================
 * [4] QUÉT TÌM SHEET CHỨA ACC SHOPEE TRÊN DRIVE (REAL-TIME UPDATE)
 * ====================================================================
 */
function findOldShopeeAccountSheets() {
  const ui = getSafeUi_();
  const activeSs = SpreadsheetApp.getActiveSpreadsheet();
  const startTime = new Date().getTime();
  const maxAllowedTimeMs = 270000; // 4.5 phút (an toàn tuyệt đối, tránh lỗi quá 6 phút của Google)
  const props = PropertiesService.getScriptProperties();
  const continuationToken = props.getProperty('DRIVE_SCAN_CONTINUATION_TOKEN');
  const pipelineState = getAutoState_('PIPELINE');
  let stoppedEarly = false;
  let isContinuation = false;
  let isFastScan = true;
  
  try {
    let reportSheet = activeSs.getSheetByName("FOUND_SHOPEE_SHEETS");
    if (!reportSheet) {
      reportSheet = activeSs.insertSheet("FOUND_SHOPEE_SHEETS");
    }

    if (pipelineState) {
      // Chạy tự động trong Pipeline (không hiển thị popup chặn luồng)
      isFastScan = (pipelineState.scanMode !== 'DETAIL');
      if (continuationToken) {
        isContinuation = true;
      }
    } else if (ui) {
      // 1. Hỏi người dùng chọn chế độ quét khi chạy thủ công
      const scanModeResponse = ui.alert(
        'CHỌN CHẾ ĐỘ QUÉT',
        'Hệ thống hỗ trợ 2 chế độ quét tài khoản Shopee trên Drive:\n\n' +
        '• Chọn YES: QUÉT NHANH (Chỉ tìm và liệt kê các File chứa tài khoản, cực nhanh, chỉ mất khoảng 5 giây).\n' +
        '• Chọn NO: QUÉT CHI TIẾT (Mở từng file để tìm và liệt kê chi tiết từng Tab bên trong, tốn thời gian hơn).\n' +
        '• Chọn CANCEL: Hủy bỏ thao tác.',
        ui.ButtonSet.YES_NO_CANCEL
      );
      
      if (scanModeResponse === ui.Button.CANCEL) return;
      isFastScan = (scanModeResponse === ui.Button.YES);

      // 2. Nếu quét chi tiết, kiểm tra tiến trình cũ
      if (!isFastScan && continuationToken) {
        const response = ui.alert(
          'QUÉT TIẾP TỤC?',
          'Phát hiện tiến trình Quét Chi Tiết trước đó chưa chạy xong.\n\n' +
          '• YES: Quét tiếp tục từ vị trí dừng cũ (giữ nguyên các dòng cũ).\n' +
          '• NO: Xóa dữ liệu cũ và quét lại từ đầu.',
          ui.ButtonSet.YES_NO
        );
        if (response === ui.Button.YES) {
          isContinuation = true;
        }
      }
    }

    let isAppendMode = false;
    const existingFileKeys = new Set();
    const lastRow = reportSheet.getLastRow();
    
    if (ui && lastRow > 1 && !isContinuation && !pipelineState) {
      const existingRowsCount = lastRow - 1;
      const appendResp = ui.alert(
        'PHÁT HIỆN ' + existingRowsCount + ' FILE TRONG BẢNG',
        'Tab FOUND_SHOPEE_SHEETS hiện đã có ' + existingRowsCount + ' file từ lần quét trước.\n\n' +
        '• YES: QUÉT BỔ SUNG (Giữ nguyên ' + existingRowsCount + ' file cũ, chỉ tìm & nối tiếp file mới vào cuối bảng)\n' +
        '• NO: QUÉT LẠI MỚI (Xóa sạch bảng cũ và quét lại Drive từ đầu)\n' +
        '• CANCEL: Hủy',
        ui.ButtonSet.YES_NO_CANCEL
      );
      
      if (appendResp === ui.Button.CANCEL) return;
      if (appendResp === ui.Button.YES) {
        isAppendMode = true;
        const existingData = reportSheet.getRange(2, 4, existingRowsCount, 1).getValues();
        existingData.forEach(function(r) {
          if (r[0]) existingFileKeys.add(String(r[0]));
        });
      }
    }

    if (!isContinuation && !isAppendMode) {
      reportSheet.clearContents();
      reportSheet.appendRow(["Tên File Sheet", "Tên Tab", "Link Truy Cập", "ID File", "Thời gian quét (Timestamp)", "Chủ sở hữu", "Lần sửa đổi gần nhất", "Trạng thái Nhập kho", "Trạng thái Bóc tách"]);
      SpreadsheetApp.flush();
      props.deleteProperty('DRIVE_SCAN_CONTINUATION_TOKEN');
    }
    
    safeToast_(activeSs, "Đang bắt đầu tìm kiếm tệp tin trên Drive...", "ARMS Scanner", 3);
    
    let files;
    if (!isFastScan && isContinuation && continuationToken) {
      files = DriveApp.continueFileIterator(continuationToken);
    } else {
      files = DriveApp.searchFiles("mimeType = 'application/vnd.google-apps.spreadsheet' and trashed = false");
    }
    
    let filesScanned = 0;
    let filesFound = 0;
    let tabsFound = 0;
    
    while (files.hasNext()) {
      // KIỂM TRA THỜI GIAN (Chỉ giới hạn cho chế độ Quét Chi Tiết)
      if (!isFastScan && (new Date().getTime() - startTime > maxAllowedTimeMs)) {
        stoppedEarly = true;
        break;
      }
      
      // KIỂM TRA GIỚI HẠN BATCH (Chỉ giới hạn cho chế độ Quét Chi Tiết)
      if (!isFastScan && filesScanned >= 50) {
        break;
      }

      const file = files.next();
      const fileId = file.getId();

      // Ở chế độ Quét Bổ Sung, nếu fileId đã có trong bảng cũ thì bỏ qua
      if (isAppendMode && existingFileKeys.has(fileId)) {
        continue;
      }

      filesScanned++;
      const fileName = file.getName();
      
      if (isFastScan) {
        activeSs.toast("Đang tìm thấy file (" + filesScanned + "): " + fileName, "ARMS Scanner", 1);
        filesFound++;
        const timestamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss");
        const owner = getSafeOwner_(file);
        const lastUpdated = getSafeLastUpdated_(file);
        reportSheet.appendRow([fileName, "Tất cả các Tab (Quét Nhanh)", file.getUrl(), file.getId(), timestamp, owner, lastUpdated, "Chưa nhập", "Chưa bóc tách"]);
        if (filesScanned % 10 === 0) {
          SpreadsheetApp.flush();
        }
      } else {
        activeSs.toast("Đang quét chi tiết file (" + filesScanned + "): " + fileName, "ARMS Scanner", 2);
        
        try {
          const ss = SpreadsheetApp.open(file);
          const sheets = ss.getSheets();
          const timestamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss");
          const owner = getSafeOwner_(file);
          const lastUpdated = getSafeLastUpdated_(file);
          
          sheets.forEach(function(sheet) {
            try {
              // TỐI ƯU HÓA CỰC LỚN: Đọc thẳng vùng A1:J15 cố định thay vì dùng getLastRow/getLastColumn rất chậm
              const values = sheet.getRange(1, 1, 15, 10).getValues();
              let isShopeeFormat = false;
              
              for (let i = 0; i < values.length; i++) {
                const row = values[i];
                if (row && row.length >= 2) {
                  const hasShopeeCookie = row.some(function(cell) {
                    const cellStr = String(cell).toLowerCase();
                    return cellStr.indexOf("spc_") !== -1 || cellStr.indexOf("shopee") !== -1 || cellStr.indexOf("cookie") !== -1;
                  });
                  
                  const hasAccountHeader = row.some(function(cell) {
                    const cellStr = String(cell).toLowerCase();
                    return cellStr.indexOf("user") !== -1 || cellStr.indexOf("pass") !== -1 || cellStr.indexOf("email") !== -1 || cellStr.indexOf("phone") !== -1 || cellStr.indexOf("sđt") !== -1 || cellStr.indexOf("@") !== -1;
                  });
                  
                  if (hasShopeeCookie || hasAccountHeader) {
                    isShopeeFormat = true;
                    break;
                  }
                }
              }
              
              if (isShopeeFormat) {
                tabsFound++;
                reportSheet.appendRow([fileName, sheet.getName(), file.getUrl(), file.getId(), timestamp, owner, lastUpdated, "Chưa nhập", "Chưa bóc tách"]);
                SpreadsheetApp.flush();
              }
            } catch (err) {
              // Bỏ qua sheet lỗi
            }
          });
          filesFound++;
        } catch (e) {
          // Bỏ qua file lỗi/không có quyền đọc
        }
      }
    }
    
    SpreadsheetApp.flush();
    
    // Lưu hoặc xóa continuation token
    let hasMore = false;
    if (!isFastScan) {
      hasMore = files.hasNext();
      if (hasMore) {
        const nextToken = files.getContinuationToken();
        props.setProperty('DRIVE_SCAN_CONTINUATION_TOKEN', nextToken);
      } else {
        props.deleteProperty('DRIVE_SCAN_CONTINUATION_TOKEN');
      }
    }
    
    activeSs.toast(hasMore ? "Tạm dừng quét chi tiết!" : "Hoàn tất quét!", "ARMS Scanner", 5);
    
    // ── AUTO-RESUME: Nếu đang chạy pipeline tự động ──
    const pipelineState_ = getAutoState_('PIPELINE');
    
    let message = '';
    if (isFastScan) {
      message = '• Đã quét toàn bộ Google Drive.\n' +
                '• Tìm thấy và liệt kê: ' + filesFound + ' file chứa tài khoản Shopee.\n\n' +
                'Danh sách liên kết đã hiển thị đầy đủ tại tab FOUND_SHOPEE_SHEETS.';
      // FastScan xong → chuyển sang bước Import nếu đang trong pipeline
      if (pipelineState_) {
        setAutoState_('PIPELINE', { step: 'IMPORT', startedAt: new Date().toISOString() });
        scheduleResume_('resumePipeline');
        activeSs.toast('Quét nhanh xong! Tự động chuyển sang Nhập kho sau 70 giây...', 'ARMS Pipeline', 5);
      } else {
        ui.alert("QUÉT NHANH HOÀN TẤT", "🎉 Đã quét nhanh thành công toàn bộ Google Drive!\n\n" + message, ui.ButtonSet.OK);
      }
    } else {
      message = '• Tổng số file Sheets đã kiểm tra ở lượt này: ' + filesScanned + '\n' +
                '• Tìm thấy ở lượt này: ' + tabsFound + ' tab chứa tài khoản Shopee phù hợp.\n\n' +
                'Danh sách liên kết đã hiển thị đầy đủ tại tab FOUND_SHOPEE_SHEETS.';
                  
      if (hasMore) {
        // Còn dữ liệu → lên lịch tự resume hoặc thông báo thủ công
        if (pipelineState_) {
          scheduleResume_('resumePipeline');
          activeSs.toast(
            'Đã quét ' + filesScanned + ' file. Tự tiếp tục sau 70 giây...',
            'ARMS Pipeline Auto', 8
          );
        } else {
          message = '⚠️ CẢNH BÁO: Tiến trình quét chi tiết tạm dừng để tránh quá giới hạn thời gian chạy của Google hoặc số lượng file.\n' +
                    'Script tự động dừng để bảo toàn dữ liệu đã tìm được.\n\n' +
                    'Bạn có thể chạy lại chức năng số 4 và chọn "YES" (Quét tiếp tục) để quét phần còn lại trên Drive.\n\n' + message;
          ui.alert("QUÉT CHI TIẾT TẠM DỪNG", message, ui.ButtonSet.OK);
        }
      } else {
        // Quét xong toàn bộ → chuyển sang bước Import nếu đang trong pipeline
        if (pipelineState_) {
          setAutoState_('PIPELINE', { step: 'IMPORT', startedAt: new Date().toISOString() });
          scheduleResume_('resumePipeline');
          activeSs.toast('Quét Drive hoàn tất! Tự động chuyển sang Nhập kho sau 70 giây...', 'ARMS Pipeline', 5);
        } else {
          ui.alert(
            "QUÉT CHI TIẾT HOÀN TẤT",
            "🎉 Chúc mừng! Đã quét chi tiết hoàn tất toàn bộ các file phù hợp trên Google Drive của bạn.\n\n" + message,
            ui.ButtonSet.OK
          );
        }
      }
    }
  } catch (error) {
    ui.alert('Lỗi quét Drive', error.message, ui.ButtonSet.OK);
  }
}

/**
 * Hàm lấy an toàn Chủ sở hữu (Owner) của tệp tin.
 */
function getSafeOwner_(file) {
  try {
    const owner = file.getOwner();
    if (owner) {
      const name = owner.getName() || '';
      const email = owner.getEmail() || '';
      return name ? name + (email ? ' (' + email + ')' : '') : email;
    }
  } catch (e) {
    // Thư mục dùng chung hoặc không có quyền truy cập thông tin chủ sở hữu
  }
  return "N/A";
}

/**
 * Hàm lấy ngày giờ sửa đổi gần nhất của tệp tin.
 */
function getSafeLastUpdated_(file) {
  try {
    const lastUpdated = file.getLastUpdated();
    if (lastUpdated) {
      return Utilities.formatDate(lastUpdated, Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss");
    }
  } catch (e) {}
  return "N/A";
}

/**
 * ====================================================================
 * PHẦN HÀM BỔ TRỢ HỆ THỐNG (SYSTEM HELPERS)
 * ====================================================================
 */

function buildPayload_(spreadsheet, sheets, syncMode) {
  const props = PropertiesService.getScriptProperties();
  const managedBy = props.getProperty('ARMS_MANAGED_BY') || 'Admin';
  const actorEmail = Session.getActiveUser().getEmail() || '';
  
  // Lấy URL Web App của dự án này để nhận callback kết quả từ server ngược về sheet
  let callbackUrl = '';
  try {
    callbackUrl = props.getProperty('ARMS_WEB_APP_URL') || ScriptApp.getService().getUrl() || '';
  } catch (e) {
    callbackUrl = props.getProperty('ARMS_WEB_APP_URL') || '';
  }

  return {
    spreadsheetId: spreadsheet.getId(),
    spreadsheetName: spreadsheet.getName(),
    spreadsheetUrl: spreadsheet.getUrl(),
    callbackUrl: callbackUrl,
    syncMode: syncMode,
    actor: {
      email: actorEmail,
      name: managedBy
    },
    tabs: sheets.map(function(sheet) {
      return readSheet_(sheet, managedBy);
    }),
    clientMeta: {
      scriptVersion: ARMS_SCRIPT_VERSION,
      timezone: Session.getScriptTimeZone(),
      sentAt: new Date().toISOString()
    }
  };
}

function readSheet_(sheet, managedBy) {
  const range = sheet.getDataRange();
  const values = range.getValues();
  
  // Chuẩn hóa và đính kèm chỉ số dòng gốc (1-indexed) làm cột cuối cùng của mỗi dòng để mapping khi cập nhật trạng thái
  const cleanedRows = values
    .map(function(row, idx) {
      const normalized = row.map(function(cell) {
        return normalizeCell_(cell);
      });
      normalized.push(String(idx + 1)); // Dòng 1-indexed trong Google Sheet
      return normalized;
    })
    .filter(function(row) {
      // Bỏ qua các dòng trống (không tính cột index vừa chèn ở cuối)
      return row.slice(0, -1).some(function(cell) {
        return cell !== '';
      });
    });

  return {
    sheetId: sheet.getSheetId(),
    sheetName: sheet.getName(),
    managedBy: managedBy,
    rangeA1: range.getA1Notation(),
    hasHeader: detectHeader_(cleanedRows),
    rows: cleanedRows
  };
}

function normalizeCell_(cell) {
  if (cell === null || cell === undefined) return '';
  if (cell instanceof Date) {
    try {
      return cell.toISOString();
    } catch (e) {
      return '';
    }
  }
  return String(cell).trim();
}

function detectHeader_(rows) {
  if (!rows.length) return false;
  const firstRow = rows[0].join(' ').toLowerCase();
  const markers = ['username', 'user', 'account', 'tai khoan', 'password', 'cookie', 'email'];
  return markers.some(function(marker) {
    return firstRow.indexOf(marker) !== -1;
  });
}

function shouldSyncSheet_(sheetName) {
  const normalized = String(sheetName).trim().toUpperCase();
  if (!normalized) return false;
  if (normalized.charAt(0) === '_') return false;
  
  const excludedSheets = ['README', 'CONFIG', 'SUMMARY', 'REPORT', 'FOUND_SHOPEE_SHEETS', 'MASTER_ACCOUNTS'];
  return excludedSheets.indexOf(normalized) === -1;
}

function sendToArms_(payload) {
  const props = PropertiesService.getScriptProperties();
  const baseUrl = props.getProperty('ARMS_API_BASE_URL');
  const apiKey = props.getProperty('ARMS_API_KEY');

  if (!baseUrl) {
    throw new Error('Chưa thiết lập ARMS_API_BASE_URL. Vui lòng chạy cấu hình Setup Wizard.');
  }

  const url = baseUrl.replace(/\/$/, '') + '/api/integrations/google-sheets/sync';
  const body = JSON.stringify(payload);
  const timestamp = new Date().toISOString();
  
  const headers = {
    'Content-Type': 'application/json',
    'X-ARMS-Client': 'google-apps-script',
    'X-ARMS-Timestamp': timestamp,
    'Bypass-Tunnel-Reminder': 'true' // Vượt qua trang chặn cảnh báo của Localtunnel / Serveo
  };

  if (apiKey) {
    headers['X-ARMS-API-Key'] = apiKey;
  } else {
    throw new Error('Chưa cấu hình API Key. Vui lòng chạy cấu hình Setup Wizard.');
  }

  const response = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    headers: headers,
    payload: body,
    muteHttpExceptions: true
  });

  const text = response.getContentText();
  const statusCode = response.getResponseCode();
  let json;

  try {
    json = JSON.parse(text);
  } catch (error) {
    json = {
      ok: false,
      code: 'INVALID_JSON_RESPONSE',
      message: text
    };
  }

  if (statusCode < 200 || statusCode >= 300) {
    json.ok = false;
    json.httpStatus = statusCode;
  }

  return json;
}

function showResult_(result) {
  const ui = SpreadsheetApp.getUi();
  if (result.ok) {
    const summary = result.summary || {};
    ui.alert(
      'ARMS: ĐỒNG BỘ THÀNH CÔNG',
      'Đã đưa dữ liệu vào hàng đợi quét hệ thống:\n\n' +
      '• Batch ID: ' + result.batchId + '\n' +
      '• Trạng thái: ' + (result.status || 'QUEUED') + '\n\n' +
      'Thống kê nạp dữ liệu:\n' +
      '- Số tab nhận được: ' + (summary.receivedTabs || 0) + '\n' +
      '- Tổng số dòng dữ liệu: ' + (summary.receivedRows || 0) + '\n\n' +
      'Worker đang tiến hành quét ngầm tài khoản trên database local của bạn.',
      ui.ButtonSet.OK
    );
    return;
  }

  ui.alert(
    'Đồng bộ thất bại',
    'Mã lỗi: ' + (result.code || result.httpStatus || 'UNKNOWN') + '\n' +
    'Chi tiết: ' + (result.message || 'Lỗi kết nối từ server/tunnel'),
    ui.ButtonSet.OK
  );
}

/**
 * Kiểm tra giới hạn số dòng tài khoản để cảnh báo người dùng tránh quá tải giới hạn 10MB của Google
 */
function checkRowLimitAndConfirm_(sheets) {
  const ui = SpreadsheetApp.getUi();
  let totalRows = 0;
  sheets.forEach(function(s) {
    totalRows += s.getLastRow();
  });
  
  if (totalRows > 15000) {
    const confirm = ui.alert(
      'CẢNH BÁO DUNG LƯỢNG LỚN',
      'Tổng số dòng tài khoản chuẩn bị đồng bộ rất lớn (' + totalRows + ' dòng).\n' +
      'Google Apps Script giới hạn gói tin gửi đi tối đa là 10MB.\n\n' +
      'Bạn có muốn tiếp tục gửi không?',
      ui.ButtonSet.YES_NO
    );
    return confirm === ui.Button.YES;
  }
  return true;
}

/**
 * ====================================================================
 * [5] WEBHOOK NHẬN PHẢN HỒI KẾT QUẢ QUÉT TỪ SERVER (CALLBACK RECEIVER)
 * ====================================================================
 * Chức năng: Nhận kết quả check Live/Die hoặc kết quả import từ Project
 * và tự động cập nhật màu sắc/ghi chú ngược trở lại Google Sheet tương ứng.
 */
function doPost(e) {
  try {
    const postData = JSON.parse(e.postData.contents);
    const props = PropertiesService.getScriptProperties();
    const serverApiKey = props.getProperty('ARMS_API_KEY');
    const clientApiKey = postData.apiKey;
    
    // Bảo mật: Kiểm tra trùng khớp API Key của dự án
    if (!serverApiKey || serverApiKey !== clientApiKey) {
      return ContentService.createTextOutput(JSON.stringify({ ok: false, error: 'Unauthorized: API Key mismatch' }))
                           .setMimeType(ContentService.MimeType.JSON);
    }
    
    if (postData.action === 'update_status') {
      const ss = SpreadsheetApp.openById(postData.spreadsheetId);
      const updates = postData.updates || []; // danh sách { sheetName: string, row: number, status: string, message: string }
      
      // Phân nhóm các bản ghi update theo tên tab
      const updatesBySheet = {};
      updates.forEach(function(item) {
        if (!item.sheetName) return;
        if (!updatesBySheet[item.sheetName]) {
          updatesBySheet[item.sheetName] = [];
        }
        updatesBySheet[item.sheetName].push(item);
      });
      
      // Duyệt qua từng tab cần cập nhật
      for (const sName in updatesBySheet) {
        const sheet = ss.getSheetByName(sName);
        if (!sheet) continue;
        
        const items = updatesBySheet[sName];
        const lastCol = sheet.getLastColumn();
        const headerRow = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
        
        let statusColIdx = -1;
        let noteColIdx = -1;
        
        // Tìm vị trí cột Trạng thái và Chi tiết quét
        for (let i = 0; i < headerRow.length; i++) {
          const colName = String(headerRow[i]).toLowerCase().trim();
          if (colName === 'trạng thái' || colName === 'status') {
            statusColIdx = i + 1;
          }
          if (colName === 'chi tiết quét' || colName === 'chi tiết' || colName === 'note') {
            noteColIdx = i + 1;
          }
        }
        
        // Tự động chèn cột mới nếu chưa tồn tại trong cấu trúc sheet hiện hành
        if (statusColIdx === -1) {
          statusColIdx = lastCol + 1;
          sheet.getRange(1, statusColIdx).setValue('Trạng thái');
        }
        if (noteColIdx === -1) {
          noteColIdx = statusColIdx + 1;
          sheet.getRange(1, noteColIdx).setValue('Chi tiết quét');
        }
        
        // Ghi đè trạng thái và đổi màu sắc trực quan (Green cho LIVE, Red cho DIE)
        items.forEach(function(updateItem) {
          const rowNum = updateItem.row;
          if (rowNum <= 1) return; // Tránh ghi đè dòng Header tiêu đề
          
          const statusCell = sheet.getRange(rowNum, statusColIdx);
          statusCell.setValue(updateItem.status);
          
          if (updateItem.status === 'LIVE') {
            statusCell.setBackground('#d4edda').setFontColor('#155724'); // Xanh lá cây nhạt (Thành công)
          } else if (updateItem.status === 'DIE') {
            statusCell.setBackground('#f8d7da').setFontColor('#721c24'); // Đỏ hồng nhạt (Lỗi/Die)
          } else {
            statusCell.setBackground('#fff3cd').setFontColor('#856404'); // Vàng nhạt (Cảnh báo)
          }
          
          if (updateItem.message) {
            sheet.getRange(rowNum, noteColIdx).setValue(updateItem.message);
          }
        });
      }
      
      SpreadsheetApp.flush();
      return ContentService.createTextOutput(JSON.stringify({ ok: true }))
                           .setMimeType(ContentService.MimeType.JSON);
    }
    
    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: 'Unsupported action' }))
                         .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: err.message }))
                         .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Hàm kiểm tra nhanh kết nối giữa Google Sheet và Server ARMS
 */
function testConnection() {
  const ui = SpreadsheetApp.getUi();
  const props = PropertiesService.getScriptProperties();
  const baseUrl = props.getProperty('ARMS_API_BASE_URL');
  
  if (!baseUrl) {
    ui.alert('LỖI KẾT NỐI', 'Chưa cấu hình API URL. Vui lòng chạy Setup Wizard.', ui.ButtonSet.OK);
    return;
  }
  
  SpreadsheetApp.getActiveSpreadsheet().toast('Đang gửi gói tin kiểm tra tới Server...', 'ARMS Tích Hợp', 5);
  
  const payload = {
    spreadsheetId: SpreadsheetApp.getActiveSpreadsheet().getId(),
    spreadsheetName: 'KIỂM TRA KẾT NỐI TỪ SHEET',
    tabs: []
  };
  
  try {
    const result = sendToArms_(payload);
    if (result.ok) {
      ui.alert(
        'KẾT NỐI THÀNH CÔNG 🎉',
        'Đường truyền hoạt động hoàn hảo!\n\n' +
        '• API URL: ' + baseUrl + '\n' +
        '• Trạng thái: Server đã phản hồi và xác thực API Key thành công.',
        ui.ButtonSet.OK
      );
    } else {
      ui.alert(
        'KẾT NỐI THẤT BẠI ❌',
        'Server phản hồi lỗi hoặc không thể xác thực.\n\n' +
        'Chi tiết: ' + (result.message || 'Mã lỗi HTTP hoặc sai API Key.'),
        ui.ButtonSet.OK
      );
    }
  } catch (e) {
    ui.alert(
      'LỖI KẾT NỐI ❌',
      'Không thể liên kết tới Server. Vui lòng kiểm tra xem bạn đã khởi động tunnel (Serveo) chưa.\n\n' +
      'Chi tiết lỗi: ' + e.message,
      ui.ButtonSet.OK
    );
  }
}

/**
 * Chức năng 5: Nhập kho tài khoản hàng loạt từ các sheet đã tìm thấy ở chức năng 4.
 */
function importDiscoveredSheetsToArms() {
  const ui = getSafeUi_();
  const activeSs = SpreadsheetApp.getActiveSpreadsheet();
  const startTime = new Date().getTime();
  const maxAllowedTimeMs = 270000; // 4.5 phút chống timeout
  const pipelineState = getAutoState_('PIPELINE');
  
  const reportSheet = activeSs.getSheetByName("FOUND_SHOPEE_SHEETS");
  if (!reportSheet) {
    if (ui) ui.alert("Lỗi", "Không tìm thấy tab FOUND_SHOPEE_SHEETS. Vui lòng chạy Chức năng 4 trước.", ui.ButtonSet.OK);
    return;
  }
  
  const lastRow = reportSheet.getLastRow();
  if (lastRow <= 1) {
    if (ui) ui.alert("Lỗi", "Tab FOUND_SHOPEE_SHEETS không có dữ liệu để nhập kho.", ui.ButtonSet.OK);
    return;
  }
  
  // Đọc toàn bộ bảng dữ liệu (từ cột 1 đến cột 8)
  const dataRange = reportSheet.getRange(2, 1, lastRow - 1, 8);
  const data = dataRange.getValues();
  
  // Lọc các dòng chưa nhập (Cột 8 là Trạng thái Nhập kho, index là 7)
  const pendingRows = [];
  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    const status = String(row[7] || '').trim();
    if (status !== "Đã nhập vào ARMS" && status !== "Đang nhập...") {
      // Lưu chỉ số hàng thực tế trong sheet (1-indexed, cộng 2 vì bắt đầu từ dòng 2)
      pendingRows.push({
        rowIndex: i + 2,
        fileName: row[0],
        tabName: row[1],
        fileUrl: row[2],
        fileId: row[3]
      });
    }
  }
  
  if (pendingRows.length === 0) {
    if (pipelineState) {
      setAutoState_('PIPELINE', { ...pipelineState, step: 'EXTRACT' });
      safeToast_(activeSs, 'Tất cả file đã được nhập kho! Đang tự động chuyển sang Bóc tách chi tiết (Bước 6)...', 'ARMS Pipeline', 5);
      extractAccountsToMasterSheet();
      return;
    } else if (ui) {
      ui.alert("Thông báo", "Tất cả các dòng tài khoản đã được nhập kho thành công trước đó.", ui.ButtonSet.OK);
    }
    return;
  }
  
  // Xác nhận từ người dùng nếu chạy thủ công
  if (!pipelineState && ui) {
    const confirm = ui.alert(
      "XÁC NHẬN NHẬP KHO HÀNG LOẠT",
      "Phát hiện có " + pendingRows.length + " hàng chưa được nhập kho.\n\n" +
      "Hệ thống sẽ mở các file tương ứng, bóc tách tài khoản từ các tab phù hợp và đẩy về Server ARMS.\n" +
      "Bạn có muốn bắt đầu không?",
      ui.ButtonSet.YES_NO
    );
    if (confirm !== ui.Button.YES) return;
  }
  
  // Gom nhóm theo fileId để chỉ mở mỗi file 1 lần (tối ưu hóa tốc độ mở file)
  const filesGroup = {};
  pendingRows.forEach(function(row) {
    if (!filesGroup[row.fileId]) {
      filesGroup[row.fileId] = {
        fileName: row.fileName,
        rows: []
      };
    }
    filesGroup[row.fileId].rows.push(row);
  });
  
  const fileIds = Object.keys(filesGroup);
  let filesProcessed = 0;
  let tabsProcessed = 0;
  let skippedFiles = 0;
  let stoppedEarly = false;
  
  activeSs.toast("Bắt đầu nhập kho hàng loạt...", "ARMS Importer", 3);
  
  for (let i = 0; i < fileIds.length; i++) {
    // Kiểm tra chống timeout
    if (new Date().getTime() - startTime > maxAllowedTimeMs) {
      stoppedEarly = true;
      break;
    }
    
    const fileId = fileIds[i];
    const fileInfo = filesGroup[fileId];
    activeSs.toast("Đang mở file (" + (i + 1) + "/" + fileIds.length + "): " + fileInfo.fileName, "ARMS Importer", 3);
    
    let targetSs;
    try {
      targetSs = SpreadsheetApp.openById(fileId);
    } catch (e) {
      // Đánh dấu lỗi không mở được file do thiếu quyền
      fileInfo.rows.forEach(function(row) {
        reportSheet.getRange(row.rowIndex, 8).setValue("Lỗi: Không mở được file");
      });
      SpreadsheetApp.flush();
      skippedFiles++;
      continue;
    }
    
    // Xử lý từng hàng cần nhập thuộc file này
    for (let r = 0; r < fileInfo.rows.length; r++) {
      const rowInfo = fileInfo.rows[r];
      const tabName = rowInfo.tabName;
      
      reportSheet.getRange(rowInfo.rowIndex, 8).setValue("Đang nhập...");
      SpreadsheetApp.flush();
      
      let sheetsToSync = [];
      
      if (tabName === "Tất cả các Tab (Quét Nhanh)") {
        sheetsToSync = targetSs.getSheets();
      } else {
        const targetSheet = targetSs.getSheetByName(tabName);
        if (targetSheet) {
          sheetsToSync.push(targetSheet);
        } else {
          sheetsToSync = targetSs.getSheets();
        }
      }
      
      if (sheetsToSync.length === 0) {
        reportSheet.getRange(rowInfo.rowIndex, 8).setValue("Bỏ qua: Không thấy tab phù hợp");
        SpreadsheetApp.flush();
        continue;
      }
      
      try {
        activeSs.toast("Đang gửi dữ liệu đồng bộ về Server...", "ARMS Importer", 2);
        const payload = buildPayload_(targetSs, sheetsToSync, 'ALL_TABS');
        const result = sendToArms_(payload);
        
        if (result && result.ok) {
          reportSheet.getRange(rowInfo.rowIndex, 8).setValue("Đã nhập vào ARMS");
          tabsProcessed += sheetsToSync.length;
        } else {
          reportSheet.getRange(rowInfo.rowIndex, 8).setValue("Lỗi: Server từ chối");
        }
      } catch (err) {
        reportSheet.getRange(rowInfo.rowIndex, 8).setValue("Lỗi: " + err.message);
      }
      SpreadsheetApp.flush();
    }
    
    filesProcessed++;
  }
  
  activeSs.toast("Tiến trình hoàn tất!", "ARMS Importer", 5);
  
  let resultMsg = "• Số file đã xử lý thành công: " + filesProcessed + "/" + fileIds.length + "\n" +
                  "• Số tab tài khoản đã đồng bộ về Server: " + tabsProcessed + "\n";
                  
  if (skippedFiles > 0) {
    resultMsg += "• Số file bị bỏ qua do lỗi quyền: " + skippedFiles + "\n";
  }
  
  // ── AUTO-RESUME: Kiểm tra pipeline state ──
  const pipelineStateImport_ = getAutoState_('PIPELINE');
  
  if (stoppedEarly) {
    // Còn file chưa xử lý
    if (pipelineStateImport_) {
      // Lưu vị trí đang dừng để lần sau tiếp tục
      PropertiesService.getScriptProperties().setProperty(
        'ARMS_IMPORT_SKIP_DONE', 'true'
      );
      scheduleResume_('resumePipeline');
      activeSs.toast(
        'Nhập kho tạm dừng (' + filesProcessed + '/' + fileIds.length + ' file). Tự tiếp tục sau 70 giây...',
        'ARMS Pipeline Auto', 8
      );
    } else {
      resultMsg = "⚠️ TIẾN TRÌNH TẠM DỪNG ĐỂ TRÁNH QUÁ GIỜ (TIMEOUT)\n\n" + resultMsg +
                  "\nBạn có thể chạy lại Chức năng 5 để tiếp tục nhập kho các file chưa xử lý còn lại.";
      ui.alert("NHẬP KHO TẠM DỪNG", resultMsg, ui.ButtonSet.OK);
    }
  } else {
    // Nhập kho xong toàn bộ
    PropertiesService.getScriptProperties().deleteProperty('ARMS_IMPORT_SKIP_DONE');
    if (pipelineStateImport_) {
      // Chuyển sang bước cuối: Trích xuất ngay lập tức
      setAutoState_('PIPELINE', { step: 'EXTRACT', startedAt: new Date().toISOString() });
      safeToast_(
        activeSs,
        'Nhập kho hoàn tất! Đang tự động chuyển sang Bóc tách chi tiết (Bước 6)...',
        'ARMS Pipeline', 5
      );
      extractAccountsToMasterSheet();
      return;
    } else {
      ui.alert("NHẬP KHO HOÀN TẤT", "🎉 Thành công!\n\n" + resultMsg, ui.ButtonSet.OK);
    }
  }
}

/**
 * Hàm phân tách dòng nếu bất kỳ ô dữ liệu nào trong hàng bị gộp/chứa chuỗi phân cách |, tab hoặc khoảng trắng đặc trưng MMO.
 */
function splitRowIfSingleCell_(row) {
  if (!row || row.length === 0) return [];
  
  for (let i = 0; i < row.length; i++) {
    const val = String(row[i] || '').trim();
    if (!val) continue;
    
    if (val.indexOf('|') !== -1) {
      return val.split('|').map(function(s) { return s.trim(); });
    }
    if (val.indexOf('\t') !== -1) {
      return val.split('\t').map(function(s) { return s.trim(); });
    }
    // Nếu chứa nhiều khoảng trắng phân tách các trường và có định dạng của tài khoản Shopee MMO (có @ hoặc SPC_F)
    if (val.indexOf(' ') !== -1 && (val.indexOf('@') !== -1 || val.indexOf('SPC_F') !== -1 || val.indexOf('spc_f') !== -1)) {
      return val.split(/\s+/).map(function(s) { return s.trim(); });
    }
  }
  return row;
}

/**
 * Hàm phân tích và nhận diện từng trường dựa trên nội dung thực tế của ô dữ liệu.
 */
function parseRowByContent_(rawRow) {
  const row = splitRowIfSingleCell_(rawRow);
  if (row.length === 0) return null;
  
  const acc = {
    username: '',
    password: '',
    phone: '',
    coins: '',
    cookie: '',
    token: '',
    email: '',
    email_password: '',
    status: 'Hợp lệ'
  };
  
  let cookieIdx = -1;
  let phoneIdx = -1;
  let coinIdx = -1;
  const emailIndices = [];
  
  // 1. Phân loại các trường đặc trưng (Cookie, Email, SĐT, Xu)
  for (let i = 0; i < row.length; i++) {
    const val = String(row[i] || '').trim();
    if (!val) continue;
    
    // Cookie Shopee
    if (val.indexOf('spc_f=') !== -1 || val.indexOf('.shopee.vn') !== -1) {
      acc.cookie = val;
      cookieIdx = i;
      continue;
    }
    
    // Email
    if (val.indexOf('@') !== -1 && val.indexOf('.') !== -1) {
      emailIndices.push(i);
      continue;
    }
    
    // Số điện thoại (SĐT) - 9 đến 11 số, bắt đầu bằng 84 hoặc 0 hoặc chỉ chứa số
    const isPhone = /^(84|0)\d{8,10}$/.test(val) || /^\d{9,11}$/.test(val);
    if (isPhone && phoneIdx === -1) {
      acc.phone = val;
      phoneIdx = i;
      continue;
    }
    
    // Số xu: dao động từ 0 đến 500000 xu (chứa chữ "xu" hoặc là số từ 0 - 500000)
    const lowerVal = val.toLowerCase();
    const isExplicitXu = lowerVal.indexOf('xu') !== -1;
    const cleanNumOnly = lowerVal.replace(/[^0-9]/g, '');
    const numVal = parseInt(cleanNumOnly, 10);
    if (isExplicitXu && coinIdx === -1) {
      acc.coins = val;
      coinIdx = i;
    } else if (/^\d+$/.test(val) && !isNaN(numVal) && numVal >= 0 && numVal <= 500000 && coinIdx === -1) {
      // Chỉ nhận diện là số xu nếu nằm ở cột thứ 4 trở đi (index >= 3) hoặc ở 2 cột cuối cùng của hàng
      // Điều này tránh nhận diện nhầm mật khẩu dạng số (ví dụ: 123456) ở các cột đầu
      if (i >= 3 || i >= row.length - 2) {
        acc.coins = val;
        coinIdx = i;
      }
    }
  }
  
  // Gán Email và tìm mật khẩu email đi kèm
  if (emailIndices.length > 0) {
    acc.email = String(row[emailIndices[0]] || '').trim();
    
    // Mật khẩu email thường nằm ngay sau email chính
    const nextIdx = emailIndices[0] + 1;
    if (nextIdx < row.length && emailIndices.indexOf(nextIdx) === -1 && nextIdx !== cookieIdx) {
      const nextVal = String(row[nextIdx] || '').trim();
      // Không lấy số xu hoặc chuỗi số ngắn làm pass email
      if (nextVal && nextVal.length >= 4 && !/^\d+$/.test(nextVal) && nextIdx !== coinIdx) {
        acc.email_password = nextVal;
      }
    }
  }
  
  // 2. Tìm Username và Password ở các cột còn lại
  const remainingVals = [];
  for (let i = 0; i < row.length; i++) {
    if (i === cookieIdx) continue;
    if (emailIndices.indexOf(i) !== -1) continue;
    if (i === emailIndices[0] + 1 && acc.email_password) continue;
    if (i === phoneIdx) continue;
    if (i === coinIdx) continue;
    
    const val = String(row[i] || '').trim();
    if (val) {
      remainingVals.push({ index: i, value: val });
    }
  }
  
  // Gán Username và Password
  if (remainingVals.length > 0) {
    acc.username = remainingVals[0].value;
  }
  if (remainingVals.length > 1) {
    acc.password = remainingVals[1].value;
  }
  
  // 3. ĐỒNG BỘ THEO DẠNG PHÂN CỘT CHUẨN (Mặc định: Username(0), Password(1), SĐT(2), Email(3), Pass Mail(4), Cookie(5))
  if (row.length >= 6) {
    const possibleCookie = String(row[5] || '').trim();
    const possibleEmail = String(row[3] || '').trim();
    
    const hasCookieCol5 = possibleCookie.indexOf('spc_') !== -1 || possibleCookie.indexOf('shopee') !== -1;
    const hasEmailCol3 = possibleEmail.indexOf('@') !== -1 && possibleEmail.indexOf('.') !== -1;
    
    if (hasCookieCol5) {
      acc.username = String(row[0] || '').trim();
      acc.password = String(row[1] || '').trim();
      acc.phone = String(row[2] || '').trim();
      acc.email = possibleEmail;
      acc.email_password = String(row[4] || '').trim();
      acc.cookie = possibleCookie;
      
      // Quét tìm Số xu ở các cột còn lại từ cột thứ 7 trở đi
      acc.coins = '';
      for (let k = 6; k < row.length; k++) {
        const val = String(row[k] || '').trim();
        if (val) {
          const cleanNumOnly = val.toLowerCase().replace(/[^0-9]/g, '');
          const numVal = parseInt(cleanNumOnly, 10);
          if (val.toLowerCase().indexOf('xu') !== -1 || (/^\d+$/.test(val) && numVal >= 0 && numVal <= 500000)) {
            acc.coins = val;
            break;
          }
        }
      }
    }
  }
  
  // Hỗ trợ dạng chuẩn có thêm cột STT/Serial ở cột đầu (Username(1), Password(2), SĐT(3), Email(4), Pass Mail(5), Cookie(6))
  if (row.length >= 7) {
    const possibleCookie = String(row[6] || '').trim();
    const possibleEmail = String(row[4] || '').trim();
    
    const hasCookieCol6 = possibleCookie.indexOf('spc_') !== -1 || possibleCookie.indexOf('shopee') !== -1;
    const hasEmailCol4 = possibleEmail.indexOf('@') !== -1 && possibleEmail.indexOf('.') !== -1;
    
    if (hasCookieCol6) {
      acc.username = String(row[1] || '').trim();
      acc.password = String(row[2] || '').trim();
      acc.phone = String(row[3] || '').trim();
      acc.email = possibleEmail;
      acc.email_password = String(row[5] || '').trim();
      acc.cookie = possibleCookie;
      
      // Quét tìm Số xu ở các cột còn lại từ cột thứ 8 trở đi
      acc.coins = '';
      for (let k = 7; k < row.length; k++) {
        const val = String(row[k] || '').trim();
        if (val) {
          const cleanNumOnly = val.toLowerCase().replace(/[^0-9]/g, '');
          const numVal = parseInt(cleanNumOnly, 10);
          if (val.toLowerCase().indexOf('xu') !== -1 || (/^\d+$/.test(val) && numVal >= 0 && numVal <= 500000)) {
            acc.coins = val;
            break;
          }
        }
      }
    }
  }
  
  // Kiểm tra loại trừ username bị sai lệch format
  if (acc.username && (acc.username.indexOf('@') !== -1 || acc.username.indexOf('spc_f') !== -1 || acc.username.length > 35)) {
    acc.username = '';
  }
  
  if (!acc.username) return null;
  
  // Phân loại trạng thái dữ liệu
  if (!acc.cookie && !acc.email) {
    acc.status = 'Thiếu cả Cookie & Email';
  } else if (!acc.cookie) {
    acc.status = 'Chỉ có Email';
  } else if (!acc.email) {
    acc.status = 'Chỉ có Cookie';
  }
  
  return acc;
}

/**
 * Hàm phân tích và bóc tách tài khoản từ một sheet bất kỳ
 */
function extractAccountsFromSheet_(sheet) {
  const range = sheet.getDataRange();
  const values = range.getValues();
  if (values.length === 0) return [];
  
  const accounts = [];
  
  for (let i = 0; i < values.length; i++) {
    const rawRow = values[i];
    
    // Bỏ qua dòng tiêu đề
    const isHeaderRow = rawRow.some(function(cell) {
      const cellStr = String(cell).toLowerCase().trim();
      return cellStr === 'username' || cellStr === 'tai khoan' || cellStr === 'cookie' || cellStr === 'password' || cellStr === 'mat khau' || cellStr === 'tên đăng nhập';
    });
    if (isHeaderRow) continue;
    
    const acc = parseRowByContent_(rawRow);
    if (acc) {
      accounts.push(acc);
    }
  }
  
  return accounts;
}

/**
 * Chức năng 6: Trích xuất tài khoản chi tiết ra tab tổng hợp của trang tính hiện tại.
 */
function extractAccountsToMasterSheet() {
  const ui = SpreadsheetApp.getUi();
  const activeSs = SpreadsheetApp.getActiveSpreadsheet();
  const startTime = new Date().getTime();
  const maxAllowedTimeMs = 270000; // 4.5 phút chống timeout
  const pipelineState = getAutoState_('PIPELINE');
  
  const reportSheet = activeSs.getSheetByName("FOUND_SHOPEE_SHEETS");
  if (!reportSheet) {
    ui.alert("Lỗi", "Không tìm thấy tab FOUND_SHOPEE_SHEETS. Vui lòng chạy Chức năng 4 trước.", ui.ButtonSet.OK);
    return;
  }
  
  const lastRow = reportSheet.getLastRow();
  if (lastRow <= 1) {
    ui.alert("Lỗi", "Tab FOUND_SHOPEE_SHEETS không có dữ liệu để trích xuất.", ui.ButtonSet.OK);
    return;
  }
  
  // Đọc dữ liệu (cột 1 đến cột 9)
  const dataRange = reportSheet.getRange(2, 1, lastRow - 1, 9);
  const data = dataRange.getValues();
  
  // Lọc các dòng chưa bóc tách (Cột 9, index là 8)
  const pendingRows = [];
  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    const status = String(row[8] || '').trim();
    if (status !== "Đã bóc tách" && status !== "Đang bóc tách...") {
      pendingRows.push({
        rowIndex: i + 2,
        fileName: row[0],
        tabName: row[1],
        fileUrl: row[2],
        fileId: row[3]
      });
    }
  }
  
  if (pendingRows.length === 0) {
    if (pipelineState) {
      setAutoState_('PIPELINE', { ...pipelineState, step: 'DONE' });
      scheduleResume_('resumePipeline');
    } else if (ui) {
      ui.alert("Thông báo", "Tất cả các dòng tài khoản đã được bóc tách chi tiết thành công trước đó.", ui.ButtonSet.OK);
    }
    return;
  }
  
  if (!pipelineState && ui) {
    const confirm = ui.alert(
      "XÁC NHẬN TRÍCH XUẤT",
      "Phát hiện có " + pendingRows.length + " hàng chưa được bóc tách.\n\n" +
      "Hệ thống sẽ mở từng file, trích xuất tất cả các tài khoản ra bảng chi tiết.\n" +
      "Bạn có muốn bắt đầu không?",
      ui.ButtonSet.YES_NO
    );
    if (confirm !== ui.Button.YES) return;
  }
  
  // Đảm bảo tab lưu trữ chi tiết tồn tại
  let detailSheet = activeSs.getSheetByName("DANH_SACH_TAI_KHOAN_CHI_TIET");
  if (!detailSheet) {
    detailSheet = activeSs.insertSheet("DANH_SACH_TAI_KHOAN_CHI_TIET");
    detailSheet.appendRow([
      "Tên File Sheet", 
      "Tên Tab", 
      "Tên đăng nhập (Username)", 
      "Mật khẩu (Password)", 
      "Số điện thoại (SĐT)", 
      "Số xu", 
      "Cookie Shopee", 
      "Token", 
      "Email", 
      "Mật khẩu Email", 
      "Trạng thái Dữ liệu"
    ]);
    detailSheet.setFrozenRows(1);
    SpreadsheetApp.flush();
  }
  
  // Gom nhóm theo fileId
  const filesGroup = {};
  pendingRows.forEach(function(row) {
    if (!filesGroup[row.fileId]) {
      filesGroup[row.fileId] = {
        fileName: row.fileName,
        rows: []
      };
    }
    filesGroup[row.fileId].rows.push(row);
  });
  
  const fileIds = Object.keys(filesGroup);
  let filesProcessed = 0;
  let totalAccountsExtracted = 0;
  let skippedFiles = 0;
  let stoppedEarly = false;
  
  activeSs.toast("Đang bắt đầu bóc tách tài khoản...", "ARMS Extractor", 3);
  
  for (let i = 0; i < fileIds.length; i++) {
    // Chống timeout
    if (new Date().getTime() - startTime > maxAllowedTimeMs) {
      stoppedEarly = true;
      break;
    }
    
    const fileId = fileIds[i];
    const fileInfo = filesGroup[fileId];
    activeSs.toast("Đang mở file (" + (i + 1) + "/" + fileIds.length + "): " + fileInfo.fileName, "ARMS Extractor", 3);
    
    let targetSs;
    try {
      targetSs = SpreadsheetApp.openById(fileId);
    } catch (e) {
      fileInfo.rows.forEach(function(row) {
        reportSheet.getRange(row.rowIndex, 9).setValue("Lỗi: Không mở được file");
      });
      SpreadsheetApp.flush();
      skippedFiles++;
      continue;
    }
    
    for (let r = 0; r < fileInfo.rows.length; r++) {
      const rowInfo = fileInfo.rows[r];
      const tabName = rowInfo.tabName;
      
      reportSheet.getRange(rowInfo.rowIndex, 9).setValue("Đang bóc tách...");
      SpreadsheetApp.flush();
      
      let sheetsToProcess = [];
      
      if (tabName === "Tất cả các Tab (Quét Nhanh)") {
        sheetsToProcess = targetSs.getSheets();
      } else {
        const targetSheet = targetSs.getSheetByName(tabName);
        if (targetSheet) {
          sheetsToProcess.push(targetSheet);
        } else {
          sheetsToProcess = targetSs.getSheets();
        }
      }
      
      if (sheetsToProcess.length === 0) {
        reportSheet.getRange(rowInfo.rowIndex, 9).setValue("Bỏ qua: Không thấy tab phù hợp");
        SpreadsheetApp.flush();
        continue;
      }
      
      // Tiến hành trích xuất từ các tab đã chọn
      let extractedCountForTab = 0;
      sheetsToProcess.forEach(function(sh) {
        try {
          const accounts = extractAccountsFromSheet_(sh);
          if (accounts.length > 0) {
            accounts.forEach(function(acc) {
              detailSheet.appendRow([
                fileInfo.fileName,
                sh.getName(),
                acc.username,
                acc.password,
                acc.phone,
                acc.coins,
                acc.cookie,
                acc.token,
                acc.email,
                acc.email_password,
                acc.status
              ]);
            });
            extractedCountForTab += accounts.length;
          }
        } catch (err) {
          // Bỏ qua lỗi tab đơn lẻ
        }
      });
      
      reportSheet.getRange(rowInfo.rowIndex, 9).setValue("Đã bóc tách");
      totalAccountsExtracted += extractedCountForTab;
      SpreadsheetApp.flush();
    }
    
    filesProcessed++;
  }
  
  activeSs.toast("Hoàn tất bóc tách!", "ARMS Extractor", 5);
  
  let resultMsg = "• Số file đã bóc tách thành công: " + filesProcessed + "/" + fileIds.length + "\n" +
                  "• Tổng số tài khoản chi tiết trích xuất ra sheet: " + totalAccountsExtracted + " tài khoản\n" +
                  "Dữ liệu chi tiết đã được điền đầy đủ tại tab DANH_SACH_TAI_KHOAN_CHI_TIET.\n";
                  
  if (skippedFiles > 0) {
    resultMsg += "• Số file bị bỏ qua do lỗi quyền: " + skippedFiles + "\n";
  }
  
  // ── AUTO-RESUME: Kiểm tra pipeline state ──
  const pipelineStateExtract_ = getAutoState_('PIPELINE');
  
  if (stoppedEarly) {
    if (pipelineStateExtract_) {
      scheduleResume_('resumePipeline');
      safeToast_(
        activeSs,
        'Bóc tách tạm dừng (' + filesProcessed + '/' + fileIds.length + ' file). Tự tiếp tục sau 70 giây...',
        'ARMS Pipeline Auto', 8
      );
    } else if (ui) {
      resultMsg = "⚠️ TIẾN TRÌNH TẠM DỪNG ĐỂ TRÁNH QUÁ GIỜ (TIMEOUT)\n\n" + resultMsg +
                  "\nBạn có thể chạy lại Chức năng 6 để tiếp tục bóc tách các file còn lại.";
      ui.alert("BÓC TÁCH TẠM DỪNG", resultMsg, ui.ButtonSet.OK);
    }
  } else {
    // Bóc tách hoàn tất → Pipeline DONE
    if (pipelineStateExtract_) {
      setAutoState_('PIPELINE', { step: 'DONE', startedAt: new Date().toISOString() });
      scheduleResume_('resumePipeline');
    } else if (ui) {
      ui.alert("BÓC TÁCH HOÀN TẤT", "🎉 Thành công!\n\n" + resultMsg, ui.ButtonSet.OK);
    }
  }
}

// ================================================================
//   ARMS AUTO-RESUME & PIPELINE ENGINE (ZERO SUPERVISION)
// ================================================================

/**
 * Lấy giao diện người dùng an toàn (không bị crash khi chạy trong background trigger).
 */
function getSafeUi_() {
  try {
    return SpreadsheetApp.getUi();
  } catch (e) {
    return null;
  }
}

/**
 * Hiển thị Toast thông báo an toàn.
 */
function safeToast_(activeSs, message, title, timeoutSeconds) {
  try {
    if (activeSs && typeof activeSs.toast === 'function') {
      activeSs.toast(message, title || 'ARMS', timeoutSeconds || 5);
    }
  } catch (e) {
    console.log('[' + (title || 'ARMS') + '] ' + message);
  }
}

/**
 * Tạo trigger one-shot để tự gọi lại hàm sau 70 giây.
 * Tự động xóa trigger cũ cùng tên trước khi tạo mới để tránh tràn hạn ngạch 20 trigger.
 */
function scheduleResume_(handlerName) {
  cancelResume_(handlerName);
  ScriptApp.newTrigger(handlerName)
    .timeBased()
    .after(70 * 1000)
    .create();
  console.log('[TRIGGER] Đã lên lịch tự chạy lại hàm: ' + handlerName + ' sau 70 giây');
}

/**
 * Hủy tất cả trigger của một hàm cụ thể.
 */
function cancelResume_(handlerName) {
  try {
    const triggers = ScriptApp.getProjectTriggers();
    triggers.forEach(function(t) {
      if (t.getHandlerFunction() === handlerName) {
        ScriptApp.deleteTrigger(t);
      }
    });
  } catch (e) {
    console.log('[TRIGGER] Lỗi xóa trigger: ' + e.message);
  }
}

/**
 * Lưu trạng thái vào ScriptProperties.
 */
function setAutoState_(key, value) {
  PropertiesService.getScriptProperties().setProperty(
    'AUTO_' + key, JSON.stringify(value)
  );
}

/**
 * Đọc trạng thái từ ScriptProperties.
 */
function getAutoState_(key) {
  const v = PropertiesService.getScriptProperties().getProperty('AUTO_' + key);
  return v ? JSON.parse(v) : null;
}

/**
 * Xóa trạng thái trong ScriptProperties.
 */
function clearAutoState_(key) {
  PropertiesService.getScriptProperties().deleteProperty('AUTO_' + key);
}

/**
 * Chạy toàn bộ Pipeline từ Quét Drive -> Nhập Kho MongoDB -> Bóc Tách Chi Tiết.
 * Người dùng chỉ cần click 1 lần duy nhất, sau đó có thể tắt máy / đóng tab.
 */
function runFullPipeline() {
  const ui = getSafeUi_();
  const state = getAutoState_('PIPELINE');
  const activeSs = SpreadsheetApp.getActiveSpreadsheet();

  let scanMode = 'FAST';
  if (ui) {
    if (state) {
      const resp = ui.alert(
        'PIPELINE ĐANG CHẠY',
        'Phát hiện pipeline đang ở bước: ' + state.step + '\n\n' +
        '• YES: Tiếp tục từ bước đang dở\n' +
        '• NO: Hủy và bắt đầu lại từ đầu\n' +
        '• CANCEL: Thoát không làm gì',
        ui.ButtonSet.YES_NO_CANCEL
      );
      if (resp === ui.Button.CANCEL) return;
      if (resp === ui.Button.YES) {
        resumePipeline();
        return;
      }
      stopPipeline();
    }

    const reportSheet = activeSs.getSheetByName("FOUND_SHOPEE_SHEETS");
    const existingRows = reportSheet ? (reportSheet.getLastRow() - 1) : 0;
    if (existingRows > 0) {
      const existingResp = ui.alert(
        'PHÁT HIỆN DỮ LIỆU ĐÃ QUÉT',
        'Tìm thấy ' + existingRows + ' file trong tab FOUND_SHOPEE_SHEETS từ lần trước.\n\n' +
        '• YES: Bỏ qua Quét Drive, NHẬP KHO TIẾP các dòng chưa xong vào MongoDB\n' +
        '• NO: Xóa danh sách cũ và Quét lại Drive từ đầu\n' +
        '• CANCEL: Hủy',
        ui.ButtonSet.YES_NO_CANCEL
      );
      if (existingResp === ui.Button.CANCEL) return;
      if (existingResp === ui.Button.YES) {
        setAutoState_('PIPELINE', {
          step: 'IMPORT',
          scanMode: 'FAST',
          startedAt: new Date().toISOString()
        });
        safeToast_(activeSs, 'Đang nhập kho tiếp từ ' + existingRows + ' file đã quét...', 'ARMS Pipeline', 8);
        importDiscoveredSheetsToArms();
        return;
      }
    }

    const modeResp = ui.alert(
      'KHỞI ĐỘNG PIPELINE TỰ ĐỘNG END-TO-END',
      'Hệ thống sẽ tự động thực hiện tuần tự không cần giám sát:\n' +
      '1. Quét Drive tìm tất cả Sheets tài khoản Shopee\n' +
      '2. Đẩy tài khoản vào MongoDB (mã hóa AES-256)\n' +
      '3. Bóc tách tài khoản ra trang tính chi tiết\n\n' +
      '• Chọn YES: Quét Nhanh (Khuyến nghị)\n' +
      '• Chọn NO: Quét Chi Tiết từng tab\n' +
      '• Chọn CANCEL: Hủy',
      ui.ButtonSet.YES_NO_CANCEL
    );
    if (modeResp === ui.Button.CANCEL) return;
    scanMode = (modeResp === ui.Button.YES) ? 'FAST' : 'DETAIL';
  }

  setAutoState_('PIPELINE', {
    step: 'SCAN_DRIVE',
    scanMode: scanMode,
    startedAt: new Date().toISOString()
  });

  safeToast_(activeSs, 'Pipeline tự động khởi động! Bạn có thể đóng Sheet, hệ thống sẽ tự chạy ngầm.', 'ARMS AutoPipeline', 8);
  resumePipeline();
}

/**
 * Hàm điều phối resume được gọi bởi Trigger tự động hoặc bấm tiếp tục.
 */
function resumePipeline() {
  const state = getAutoState_('PIPELINE');
  const activeSs = SpreadsheetApp.getActiveSpreadsheet();
  if (!state) {
    console.log('[PIPELINE] Không tìm thấy trạng thái pipeline.');
    return;
  }

  console.log('[PIPELINE] Đang thực thi bước: ' + state.step);

  switch (state.step) {
    case 'SCAN_DRIVE':
      findOldShopeeAccountSheets();
      break;
    case 'IMPORT':
      importDiscoveredSheetsToArms();
      break;
    case 'EXTRACT':
      extractAccountsToMasterSheet();
      break;
    case 'DONE':
      cancelResume_('resumePipeline');
      clearAutoState_('PIPELINE');
      PropertiesService.getScriptProperties().deleteProperty('DRIVE_SCAN_CONTINUATION_TOKEN');
      PropertiesService.getScriptProperties().deleteProperty('ARMS_IMPORT_SKIP_DONE');
      safeToast_(activeSs, '🎉 Pipeline hoàn tất! Toàn bộ tài khoản đã được đưa về MongoDB tập trung.', 'ARMS Hoàn Tất', 15);
      const ui = getSafeUi_();
      if (ui) {
        ui.alert(
          'PIPELINE HOÀN THÀNH 🎉',
          'Tất cả tài khoản Shopee từ Google Drive đã được quét, mã hóa và lưu trữ an toàn trong MongoDB.\n\n' +
          'Bạn có thể quản lý tập trung, tra cứu và xuất kho từ hệ thống ARMS.',
          ui.ButtonSet.OK
        );
      }
      break;
    default:
      console.log('[PIPELINE] Bước không xác định: ' + state.step);
      break;
  }
}

/**
 * Dừng khẩn cấp Pipeline và hủy tất cả trigger tự động.
 */
function stopPipeline() {
  cancelResume_('resumePipeline');
  cancelResume_('findOldShopeeAccountSheets');
  cancelResume_('importDiscoveredSheetsToArms');
  cancelResume_('extractAccountsToMasterSheet');
  clearAutoState_('PIPELINE');
  PropertiesService.getScriptProperties().deleteProperty('DRIVE_SCAN_CONTINUATION_TOKEN');
  PropertiesService.getScriptProperties().deleteProperty('ARMS_IMPORT_SKIP_DONE');
  const activeSs = SpreadsheetApp.getActiveSpreadsheet();
  safeToast_(activeSs, 'Đã dừng tất cả tiến trình tự động và hủy trigger.', 'ARMS Pipeline Stopped', 5);
  const ui = getSafeUi_();
  if (ui) {
    ui.alert('ĐÃ DỪNG PIPELINE', 'Đã hủy bỏ tất cả trigger chạy tự động và xóa trạng thái tạm.', ui.ButtonSet.OK);
  }
}

/**
 * ====================================================================
 * [7] TRA CỨU NHANH DANH SÁCH TÀI KHOẢN (PASTE LIST)
 * ====================================================================
 */
function pasteAndLookupAccounts() {
  const ui = getSafeUi_();
  const activeSs = SpreadsheetApp.getActiveSpreadsheet();
  const props = PropertiesService.getScriptProperties();
  const baseUrl = props.getProperty('ARMS_API_BASE_URL');
  const apiKey = props.getProperty('ARMS_API_KEY');

  if (!baseUrl) {
    if (ui) ui.alert('Chưa cấu hình', 'Vui lòng chạy Setup Wizard (Bước số 1) để cài đặt API URL.', ui.ButtonSet.OK);
    return;
  }

  const prompt = ui.prompt(
    '🔍 TRA CỨU TÀI KHOẢN NHANH TRONG MONGODB',
    'Dán danh sách username hoặc các dòng dữ liệu (user|pass|cookie...):\n(Mỗi dòng một tài khoản)',
    ui.ButtonSet.OK_CANCEL
  );

  if (prompt.getSelectedButton() !== ui.Button.OK) return;

  const rawText = prompt.getResponseText().trim();
  if (!rawText) {
    if (ui) ui.alert('Thông báo', 'Bạn chưa nhập danh sách tài khoản cần tra cứu.', ui.ButtonSet.OK);
    return;
  }

  const lines = rawText.split(/\r?\n/).map(function(l) { return l.trim(); }).filter(Boolean);
  const usernames = lines.map(function(l) {
    return l.split('|')[0].trim();
  }).filter(Boolean);

  activeSs.toast('Đang đối soát ' + usernames.length + ' tài khoản với MongoDB...', 'ARMS Lookup', 3);

  try {
    const url = baseUrl + '/api/accounts/lookup-bulk';
    const options = {
      method: 'post',
      contentType: 'application/json',
      headers: {
        'x-arms-api-key': apiKey || ''
      },
      payload: JSON.stringify({ usernames: usernames }),
      muteHttpExceptions: true
    };

    const response = UrlFetchApp.fetch(url, options);
    const code = response.getResponseCode();
    const text = response.getContentText();

    if (code !== 200 && code !== 201) {
      if (ui) ui.alert('Lỗi tra cứu (' + code + ')', text, ui.ButtonSet.OK);
      return;
    }

    const data = JSON.parse(text);
    const results = data.results || [];

    // Tạo hoặc mở tab TRA_CUU_TAI_KHOAN
    let lookupSheet = activeSs.getSheetByName('TRA_CUU_TAI_KHOAN');
    if (!lookupSheet) {
      lookupSheet = activeSs.insertSheet('TRA_CUU_TAI_KHOAN');
    }
    lookupSheet.clear();

    // Thiết lập tiêu đề
    const headers = [
      'STT', 'Tài khoản (Username)', 'Kết quả Đối soát', 
      'Trạng thái MongoDB', 'Nguồn File', 'Tab Nguồn', 
      'Ngày Quét Đầu', 'Đã Bán Cho', 'Ngày Bán', 'Chi tiết / Ghi chú'
    ];
    lookupSheet.appendRow(headers);

    const headerRange = lookupSheet.getRange(1, 1, 1, headers.length);
    headerRange.setBackground('#1e1b4b');
    headerRange.setFontColor('#ffffff');
    headerRange.setFontWeight('bold');

    const outputRows = [];
    for (let i = 0; i < results.length; i++) {
      const r = results[i];
      outputRows.push([
        i + 1,
        r.username || '',
        r.lookup_status === 'FOUND' ? 'ĐÃ CÓ TRONG KHO' : (r.lookup_status === 'INVALID' ? 'USERNAME LỖI' : 'CHƯA CÓ (MỚI)'),
        r.account_status || '---',
        r.source_file || '---',
        r.source_sheet || '---',
        r.first_scan_at ? new Date(r.first_scan_at).toLocaleDateString('vi-VN') : '---',
        r.sold_to || '---',
        r.sold_at ? new Date(r.sold_at).toLocaleDateString('vi-VN') : '---',
        r.message || ''
      ]);
    }

    if (outputRows.length > 0) {
      const dataRange = lookupSheet.getRange(2, 1, outputRows.length, headers.length);
      dataRange.setValues(outputRows);
      
      // Định dạng màu sắc cột Trạng thái
      for (let i = 0; i < results.length; i++) {
        const r = results[i];
        const rowNum = i + 2;
        const cell = lookupSheet.getRange(rowNum, 3);
        if (r.lookup_status === 'FOUND') {
          cell.setBackground('#dcfce7'); // Xanh lá
          cell.setFontColor('#15803d');
        } else if (r.lookup_status === 'NOT_FOUND') {
          cell.setBackground('#f3f4f6'); // Xám
          cell.setFontColor('#4b5563');
        } else {
          cell.setBackground('#fee2e2'); // Đỏ
          cell.setFontColor('#b91c1c');
        }
      }
    }

    lookupSheet.autoResizeColumns(1, headers.length);
    activeSs.setActiveSheet(lookupSheet);

    const summaryMsg = '🎉 Tra cứu hoàn tất!\n\n' +
      '• Tổng số: ' + (data.summary?.total || 0) + ' tài khoản\n' +
      '• Đã có trong MongoDB: ' + (data.summary?.found || 0) + ' tài khoản\n' +
      '• Chưa có (sẵn sàng nhập mới): ' + (data.summary?.not_found || 0) + ' tài khoản\n\n' +
      'Dữ liệu chi tiết đã được hiển thị trên tab "TRA_CUU_TAI_KHOAN".';

    if (ui) ui.alert('KẾT QUẢ TRA CỨU', summaryMsg, ui.ButtonSet.OK);

  } catch (error) {
    if (ui) ui.alert('Lỗi tra cứu', error.message, ui.ButtonSet.OK);
  }
}

/**
 * ====================================================================
 * [8] XEM THỐNG KÊ KHO MONGODB THỜI GIAN THỰC
 * ====================================================================
 */
function showDashboardStats() {
  const ui = getSafeUi_();
  const props = PropertiesService.getScriptProperties();
  const baseUrl = props.getProperty('ARMS_API_BASE_URL');
  const apiKey = props.getProperty('ARMS_API_KEY');

  if (!baseUrl) {
    if (ui) ui.alert('Chưa cấu hình', 'Vui lòng chạy Setup Wizard (Bước số 1) để cài đặt API URL.', ui.ButtonSet.OK);
    return;
  }

  try {
    const url = baseUrl + '/api/accounts/stats';
    const options = {
      method: 'get',
      contentType: 'application/json',
      headers: {
        'x-arms-api-key': apiKey || ''
      },
      muteHttpExceptions: true
    };

    const response = UrlFetchApp.fetch(url, options);
    const code = response.getResponseCode();
    const text = response.getContentText();

    if (code !== 200) {
      if (ui) ui.alert('Lỗi lấy thống kê (' + code + ')', text, ui.ButtonSet.OK);
      return;
    }

    const data = JSON.parse(text);
    const total = data.total || 0;
    const byStatus = data.by_status || {};
    const byQuality = data.by_quality || {};

    let topSourcesText = '';
    if (data.top_sources && data.top_sources.length > 0) {
      topSourcesText = '\n📂 Nguồn tệp nhiều nhất:\n';
      data.top_sources.slice(0, 5).forEach(function(s, idx) {
        topSourcesText += '  ' + (idx + 1) + '. ' + s.source_file + ' (' + s.count + ' TK)\n';
      });
    }

    const statsMsg = '📊 THỐNG KÊ KHO TÀI KHOẢN MONGODB\n' +
      '═══════════════════════════════\n\n' +
      '🔢 TỔNG TÀI KHOẢN: ' + total.toLocaleString('vi-VN') + '\n\n' +
      '📈 Phân loại theo Trạng thái:\n' +
      '  • 🟢 Sẵn có (AVAILABLE): ' + (byStatus.AVAILABLE || 0).toLocaleString('vi-VN') + '\n' +
      '  • 🔴 Đã bán (SOLD): ' + (byStatus.SOLD || 0).toLocaleString('vi-VN') + '\n' +
      '  • 🟣 Đã dùng (USED): ' + (byStatus.USED || 0).toLocaleString('vi-VN') + '\n' +
      '  • ⛔ Bị khóa (BLACKLISTED): ' + (byStatus.BLACKLISTED || 0).toLocaleString('vi-VN') + '\n\n' +
      '💎 Chất lượng tài khoản:\n' +
      '  • 🍪 Có Cookie Shopee: ' + (byQuality.has_cookie || 0).toLocaleString('vi-VN') + '\n' +
      '  • ✉️ Có Email/Pass Mail: ' + (byQuality.has_email || 0).toLocaleString('vi-VN') + '\n' +
      '  • ⭐ Đầy đủ thông tin (Full): ' + (byQuality.full_info || 0).toLocaleString('vi-VN') + '\n' +
      topSourcesText;

    if (ui) ui.alert('THỐNG KÊ KHO TẬP TRUNG', statsMsg, ui.ButtonSet.OK);

  } catch (error) {
    if (ui) ui.alert('Lỗi kết nối', error.message, ui.ButtonSet.OK);
  }
}

/**
 * Báo cáo thống kê tiến độ quét, nhập kho MongoDB & bóc tách chi tiết.
 */
function checkScanProgressReport() {
  const ui = SpreadsheetApp.getUi();
  const activeSs = SpreadsheetApp.getActiveSpreadsheet();
  const reportSheet = activeSs.getSheetByName("FOUND_SHOPEE_SHEETS");
  const detailSheet = activeSs.getSheetByName("DANH_SACH_TAI_KHOAN_CHI_TIET");
  
  if (!reportSheet) {
    ui.alert("Thông Báo", "Chưa có dữ liệu quét. Vui lòng chạy Bước 4 trước.", ui.ButtonSet.OK);
    return;
  }
  
  const lastRow = reportSheet.getLastRow();
  if (lastRow <= 1) {
    ui.alert("Thông Báo", "Tab FOUND_SHOPEE_SHEETS hiện đang trống.", ui.ButtonSet.OK);
    return;
  }
  
  const data = reportSheet.getRange(2, 1, lastRow - 1, 9).getValues();
  let totalFiles = data.length;
  let importedCount = 0;
  let extractedCount = 0;
  let pendingImport = 0;
  let pendingExtract = 0;
  
  data.forEach(function(row) {
    const importStatus = String(row[7] || '').trim();
    const extractStatus = String(row[8] || '').trim();
    
    if (importStatus === "Đã nhập vào ARMS") {
      importedCount++;
    } else {
      pendingImport++;
    }
    
    if (extractStatus === "Đã bóc tách") {
      extractedCount++;
    } else {
      pendingExtract++;
    }
  });
  
  const detailAccountsCount = detailSheet ? Math.max(0, detailSheet.getLastRow() - 1) : 0;
  
  let msg = "📊 BÁO CÁO TIẾN ĐỘ QUÉT & NHẬP KHO ARMS\n\n" +
            "• Tổng số file Sheets tìm thấy: " + totalFiles + " tệp\n" +
            "----------------------------------------\n" +
            "• Nhập kho MongoDB (Bước 5): " + importedCount + "/" + totalFiles + " file (" + (pendingImport > 0 ? "Còn " + pendingImport + " file chưa nhập" : "Đã xong 100% 🎉") + ")\n" +
            "• Bóc tách chi tiết (Bước 6): " + extractedCount + "/" + totalFiles + " file (" + (pendingExtract > 0 ? "Còn " + pendingExtract + " file chưa bóc tách" : "Đã xong 100% 🎉") + ")\n" +
            "• Tổng tài khoản tại tab DANH_SACH_TAI_KHOAN_CHI_TIET: " + detailAccountsCount + " tài khoản\n\n";
            
  if (pendingImport > 0 || pendingExtract > 0) {
    msg += "👉 GỢI Ý: Chọn 'ARMS -> 🚀 [AUTO] Toàn Bộ Pipeline' để nhập nốt " + Math.max(pendingImport, pendingExtract) + " file còn lại!";
  } else {
    msg += "🎉 HOÀN THÀNH: Tất cả dữ liệu đã được đồng bộ và bóc tách đầy đủ!";
  }
  
  ui.alert("BÁO CÁO TIẾN ĐỘ", msg, ui.ButtonSet.OK);
}

/**
 * Lưu danh sách file từ tab FOUND_SHOPEE_SHEETS vào MongoDB.
 */
function saveSheetIndexToDb() {
  const ui = SpreadsheetApp.getUi();
  const activeSs = SpreadsheetApp.getActiveSpreadsheet();
  const reportSheet = activeSs.getSheetByName("FOUND_SHOPEE_SHEETS");
  if (!reportSheet || reportSheet.getLastRow() <= 1) {
    ui.alert("Thông Báo", "Không có dữ liệu trong tab FOUND_SHOPEE_SHEETS để lưu.", ui.ButtonSet.OK);
    return;
  }

  const props = PropertiesService.getScriptProperties();
  const baseUrl = props.getProperty('ARMS_BASE_URL');
  const apiKey = props.getProperty('ARMS_API_KEY');
  if (!baseUrl) {
    ui.alert("Lỗi", "Chưa cấu hình API URL. Vui lòng chạy Setup Wizard trước.", ui.ButtonSet.OK);
    return;
  }

  const data = reportSheet.getRange(2, 1, reportSheet.getLastRow() - 1, 9).getValues();
  const sheets = data.map(function(row) {
    return {
      fileName: row[0],
      tabName: row[1],
      fileUrl: row[2],
      fileId: row[3],
      timestamp: row[4],
      owner: row[5],
      lastUpdated: row[6],
      importStatus: row[7],
      extractStatus: row[8]
    };
  });

  try {
    const response = UrlFetchApp.fetch(baseUrl + '/api/integrations/google-sheets/save-sheet-index', {
      method: 'post',
      contentType: 'application/json',
      headers: { 'x-arms-api-key': apiKey || '' },
      payload: JSON.stringify({ sheets: sheets }),
      muteHttpExceptions: true
    });

    if (response.getResponseCode() === 200) {
      ui.alert("Thành Công 🎉", "Đã lưu " + sheets.length + " file trang tính vào Database MongoDB an toàn!", ui.ButtonSet.OK);
    } else {
      ui.alert("Lỗi", "Server phản hồi lỗi: " + response.getContentText(), ui.ButtonSet.OK);
    }
  } catch (e) {
    ui.alert("Lỗi Kết Nối", e.message, ui.ButtonSet.OK);
  }
}

/**
 * Khôi phục danh sách file từ MongoDB ra tab FOUND_SHOPEE_SHEETS.
 */
function restoreSheetIndexFromDb() {
  const ui = SpreadsheetApp.getUi();
  const activeSs = SpreadsheetApp.getActiveSpreadsheet();
  const props = PropertiesService.getScriptProperties();
  const baseUrl = props.getProperty('ARMS_BASE_URL');
  const apiKey = props.getProperty('ARMS_API_KEY');
  if (!baseUrl) {
    ui.alert("Lỗi", "Chưa cấu hình API URL. Vui lòng chạy Setup Wizard trước.", ui.ButtonSet.OK);
    return;
  }

  try {
    const response = UrlFetchApp.fetch(baseUrl + '/api/integrations/google-sheets/get-sheet-index', {
      method: 'get',
      contentType: 'application/json',
      headers: { 'x-arms-api-key': apiKey || '' },
      muteHttpExceptions: true
    });

    if (response.getResponseCode() !== 200) {
      ui.alert("Lỗi", "Server phản hồi lỗi: " + response.getContentText(), ui.ButtonSet.OK);
      return;
    }

    const resData = JSON.parse(response.getContentText());
    const sheets = resData.sheets || [];
    if (sheets.length === 0) {
      ui.alert("Thông Báo", "Chưa có danh sách file nào được lưu trong Database MongoDB.", ui.ButtonSet.OK);
      return;
    }

    let reportSheet = activeSs.getSheetByName("FOUND_SHOPEE_SHEETS");
    if (!reportSheet) {
      reportSheet = activeSs.insertSheet("FOUND_SHOPEE_SHEETS");
    }
    reportSheet.clearContents();
    reportSheet.appendRow(["Tên File Sheet", "Tên Tab", "Link Truy Cập", "ID File", "Thời gian quét (Timestamp)", "Chủ sở hữu", "Lần sửa đổi gần nhất", "Trạng thái Nhập kho", "Trạng thái Bóc tách"]);

    sheets.forEach(function(s) {
      reportSheet.appendRow([
        s.fileName,
        s.tabName,
        s.fileUrl,
        s.fileId,
        s.timestamp,
        s.owner,
        s.lastUpdated,
        s.importStatus || 'Chưa nhập',
        s.extractStatus || 'Chưa bóc tách'
      ]);
    });
    SpreadsheetApp.flush();

    ui.alert("Thành Công 🎉", "Đã khôi phục đầy đủ " + sheets.length + " file từ Database MongoDB ra tab FOUND_SHOPEE_SHEETS!", ui.ButtonSet.OK);
  } catch (e) {
    ui.alert("Lỗi Kết Nối", e.message, ui.ButtonSet.OK);
  }
}


