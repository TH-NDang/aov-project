const MESSAGES: Record<string, string> = {
  "ID must be a string or number.": "ID phải là chuỗi hoặc số.",
  "ID must not be empty.": "ID không được để trống.",
  "Table name must not be empty.": "Tên bảng không được để trống.",
  "Column names are invalid or duplicated.": "Tên cột không hợp lệ hoặc bị trùng.",
  "ID column does not exist.": "Cột ID không tồn tại.",
  "Select an ID column before adding data.": "Hãy chọn cột ID trước khi thêm dữ liệu.",
  "Row contains an undeclared column.": "Dữ liệu chứa cột chưa khai báo.",
  "CSV contains invalid quotes.": "CSV có dấu nháy không hợp lệ.",
  "CSV contains an unclosed quote.": "CSV có dấu nháy chưa đóng.",
  "CSV requires unique nonempty column headers.": "CSV cần hàng tiêu đề với tên cột duy nhất, không để trống.",
  "JSON must contain a record array or an object property containing one.":
    "JSON cần chứa danh sách các bản ghi, hoặc một thuộc tính chứa danh sách đó.",
  "Select an ID column.": "Hãy chọn cột làm ID.",
  "Destination columns must be unique and must not replace the ID column.":
    "Mỗi cột đích chỉ được ánh xạ một lần; cột ID được ánh xạ riêng.",
  "Table exceeds 20 MB.": "Dung lượng bảng vượt quá 20 MB.",
  "Table was changed elsewhere. Reload before saving.": "Bảng đã được sửa ở nơi khác. Hãy tải lại trước khi lưu.",
  "Cannot change the ID column of a populated table.": "Không thể đổi cột ID khi bảng đã có dữ liệu.",
  "Import file exceeds 10 MB.": "File import tối đa 10 MB.",
  "Import exceeds 10000 rows.": "Mỗi lần import tối đa 10.000 dòng.",
  "Import file has no records.": "File không có bản ghi để import.",
  "JSON storage requires the local dev or preview server.":
    "Kho JSON chỉ hoạt động khi chạy admin bằng dev server hoặc preview tại máy này.",
  "Storage request failed.": "Không thể lưu dữ liệu.",
  "Column name is invalid or already exists.": "Tên cột không hợp lệ hoặc đã tồn tại.",
  "Select an ID column before adding rows.": "Hãy chọn cột ID trước khi thêm dòng.",
}

export function storageErrorMessage(message: string): string {
  if (message.startsWith("Duplicate ID:")) return message.replace("Duplicate ID:", "ID bị trùng:")
  if (message.startsWith("Duplicate import ID:"))
    return message.replace("Duplicate import ID:", "ID bị trùng trong file:")
  const invalidId = message.match(/^Import row (\d+) has an empty or invalid ID\.$/)
  if (invalidId) return `Dòng ${invalidId[1]}: ID trống hoặc không hợp lệ.`
  const invalidCsv = message.match(/^CSV row (\d+) has an unexpected column count\.$/)
  if (invalidCsv) return `Dòng ${invalidCsv[1]} không có đủ số cột như tiêu đề.`
  if (message === "Table name already exists.") return "Tên bảng đã tồn tại."
  return MESSAGES[message] ?? message
}
