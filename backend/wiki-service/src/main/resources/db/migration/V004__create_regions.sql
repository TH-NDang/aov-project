CREATE TABLE patch.region (
    id UUID PRIMARY KEY,
    code VARCHAR(16) NOT NULL UNIQUE,
    display_name VARCHAR(80) NOT NULL,
    product_name VARCHAR(80) NOT NULL,
    default_locale VARCHAR(16) NOT NULL,
    timezone VARCHAR(64) NOT NULL,
    lifecycle_state VARCHAR(16) NOT NULL CHECK (lifecycle_state IN ('ACTIVE', 'LOCKED')),
    unavailable_reason VARCHAR(255),
    sort_order INTEGER NOT NULL,
    CHECK (lifecycle_state <> 'LOCKED' OR unavailable_reason IS NOT NULL)
);

INSERT INTO patch.region
    (id, code, display_name, product_name, default_locale, timezone, lifecycle_state, unavailable_reason, sort_order)
VALUES
    ('5d5dcd5e-15b9-4d43-884d-111111111111', 'VN', 'Việt Nam', 'Liên Quân Mobile', 'vi-VN', 'Asia/Ho_Chi_Minh', 'ACTIVE', NULL, 1),
    ('5d5dcd5e-15b9-4d43-884d-222222222222', 'TH', 'Thái Lan', 'RoV', 'th-TH', 'Asia/Bangkok', 'LOCKED', 'Chưa hỗ trợ dữ liệu thị trường Thái Lan.', 2),
    ('5d5dcd5e-15b9-4d43-884d-333333333333', 'TW', 'Đài Loan', '傳說對決', 'zh-TW', 'Asia/Taipei', 'LOCKED', 'Chưa hỗ trợ dữ liệu thị trường Đài Loan.', 3),
    ('5d5dcd5e-15b9-4d43-884d-444444444444', 'ID', 'Indonesia', 'Garena AOV', 'id-ID', 'Asia/Jakarta', 'LOCKED', 'Chưa hỗ trợ dữ liệu thị trường Indonesia.', 4),
    ('5d5dcd5e-15b9-4d43-884d-555555555555', 'GLOBAL', 'Global', 'Arena of Valor', 'en-US', 'UTC', 'LOCKED', 'Chưa xác định phạm vi và dữ liệu cho bản quốc tế.', 5);
