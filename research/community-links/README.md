# Điền ngược liên kết thi đấu (ADR-032)

Lần nhập Liquipedia ngày 06/11/2026 để lại MVP, bình luận viên, đội của giải thưởng, ê-kíp phát sóng và ban huấn luyện
dưới dạng chữ. Script này đổi chữ thành liên kết khi chắc chắn, theo đặc tả 04 mục "Liên kết giữa các bản ghi thi đấu".
Phần không chắc ở lại màn "Liên kết cần xem" của Admin.

Chỉ dùng thư viện chuẩn của Python. Không chạy như migration: ghi dữ liệu thật cần người dùng đồng ý riêng.

## 1. Xuất dữ liệu (chỉ đọc)

Trên stack thật (`aov-vps`):

```sh
ssh aov-vps "cd /opt/aov-project/infra && docker compose exec -T postgres sh -c 'psql -X -q -At -v ON_ERROR_STOP=1 -U \"\$POSTGRES_USER\" -d community'" < export-links.sql > export.json
```

## 2. Lập kế hoạch

```sh
python link_backfill.py plan export.json --out ket-qua
```

Ghi `ket-qua/plan.json` (các thay đổi đề xuất), `ket-qua/review.tsv` (chỗ không khớp chắc chắn và lý do) và
`ket-qua/summary.json` (số đếm theo loại). Quy tắc khớp:

| Loại | Khớp khi |
|---|---|
| MVP của ván | Tên sau "MVP: " (tới câu kế tiếp của ghi chú) trùng đúng tên thi đấu hoặc tên gọi khác của một tuyển thủ ngồi trong ván hoặc có trong đội hình hai đội của trận ở giải đó. Liên kết Liquipedia dạng "Trang (Taiwanese Player)\|Tên" tính cả hai phía |
| MVP của trận | Tên trước "(" ở dòng "MVP trận: " hoặc "MVP: " trùng đúng một tuyển thủ trong đội hình hai đội |
| Bình luận viên của trận | Mọi tên sau "Bình luận: " đều trùng đúng một hồ sơ PERSON hoặc PLAYER; thiếu một tên thì không ghi |
| Ê-kíp phát sóng của giải | Mục lịch sử có URL nguồn `<URL của giải>#Broadcast`; vai trò từ chữ ("MC", "Bình luận viên", "Phỏng vấn", "Khách mời phân tích") |
| Ban huấn luyện | Mục lịch sử có hồ sơ đội và URL nguồn trùng đúng một giải chưa xóa; "Huấn luyện viên…" là COACH, "…phân tích…" là TEAM_ANALYST, chữ gốc vào `title` |
| Giải của mốc lịch sử | URL nguồn (bỏ phần sau "#") trùng đúng một giải, kể cả giải ở thùng rác |
| Đội của giải thưởng | `teamName` trùng tên, tên ngắn hoặc tên gọi khác của đúng một đội có đội hình, thứ hạng hoặc trận ở giải đó |

Tên được so như `tournament.normalize_reference_search`: không phân biệt hoa thường và dấu, dấu câu coi như khoảng trắng.

## 3. Ghi và hoàn tác

Cần access token Admin có `tournament:write` trong biến môi trường `COMMUNITY_ADMIN_TOKEN` (script không in token):

```sh
python link_backfill.py apply ket-qua/plan.json --api https://athahub.com/api/community/v1 --ledger ket-qua/ledger.jsonl
python link_backfill.py undo ket-qua/ledger.jsonl --api https://athahub.com/api/community/v1
```

Mỗi bản ghi được đọc lại trước khi ghi; trường đã có giá trị (do biên tập viên điền trong lúc đó) được giữ nguyên, mục
giải thưởng hay lịch sử đã đổi chỗ thì bỏ qua. Xung đột version thì đọc lại một lần. Mỗi lần lưu ghi một dòng vào sổ;
`undo` chỉ trả lại giá trị cũ ở chỗ còn đúng giá trị script đã ghi. Backend phải có ADR-032 trước khi chạy `apply`.

## Test

```sh
python -m unittest discover --pattern "test_*.py"
```
