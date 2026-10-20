CREATE SCHEMA terminology;
CREATE TABLE terminology.configuration (
    id UUID PRIMARY KEY, version BIGINT NOT NULL CHECK (version > 0),
    auto_recognize BOOLEAN NOT NULL, fallback_locale VARCHAR(64) NOT NULL, updated_at TIMESTAMPTZ NOT NULL
);
INSERT INTO terminology.configuration VALUES ('47df8910-0c55-4c51-9407-343282a45233', 1, true, 'vi-VN', now());
CREATE TABLE terminology.entry (
    id UUID PRIMARY KEY, reference_key VARCHAR(128) NOT NULL, kind VARCHAR(16) NOT NULL,
    icon VARCHAR(2048), auto_match BOOLEAN, display_order INTEGER NOT NULL,
    display JSONB, destinations JSONB,
    UNIQUE(kind, reference_key), CHECK(kind IN ('term','hero','item'))
);
CREATE TABLE terminology.translation (
    id UUID PRIMARY KEY, entry_id UUID NOT NULL REFERENCES terminology.entry(id),
    locale VARCHAR(64) NOT NULL, name VARCHAR(200) NOT NULL, description TEXT NOT NULL,
    aliases JSONB NOT NULL, UNIQUE(entry_id, locale)
);

INSERT INTO terminology.entry (id, reference_key, kind, display_order, display) VALUES ('1331984b-e74d-53b8-92ba-daa3ef30f17c','sat-thuong-vat-ly','term',0,'{"underline":true,"showIcon":false}'::jsonb);
INSERT INTO terminology.translation (id, entry_id, locale, name, description, aliases) VALUES ('a2d9e89c-8d3d-4504-9a27-8d1fc119a12e','1331984b-e74d-53b8-92ba-daa3ef30f17c','vi-VN','Sát thương vật lý','Loại sát thương chịu ảnh hưởng bởi giáp và xuyên giáp của các bên.','["ST vật lý"]'::jsonb);

INSERT INTO terminology.entry (id, reference_key, kind, display_order, display) VALUES ('2c51ff6f-3461-5b66-91a0-8b5b7200caf8','sat-thuong-phep','term',1,'{"underline":true,"showIcon":false}'::jsonb);
INSERT INTO terminology.translation (id, entry_id, locale, name, description, aliases) VALUES ('add47a22-dd76-405b-b008-9470db300d65','2c51ff6f-3461-5b66-91a0-8b5b7200caf8','vi-VN','Sát thương phép','Loại sát thương chịu ảnh hưởng bởi giáp phép và xuyên giáp phép.','["ST phép"]'::jsonb);

INSERT INTO terminology.entry (id, reference_key, kind, display_order, display) VALUES ('38881f70-661e-58d8-844c-90e1ac42144c','sat-thuong-chuan','term',2,'{"underline":true,"showIcon":false}'::jsonb);
INSERT INTO terminology.translation (id, entry_id, locale, name, description, aliases) VALUES ('a882349b-f64d-4a96-b6a2-58e9b9ff4a26','38881f70-661e-58d8-844c-90e1ac42144c','vi-VN','Sát thương chuẩn','Loại sát thương bỏ qua giáp và giáp phép.','["ST chuẩn"]'::jsonb);

INSERT INTO terminology.entry (id, reference_key, kind, display_order, display) VALUES ('841b14d9-3ab0-50da-9875-4fa883e38619','cong-vat-ly','term',3,'{"underline":true,"showIcon":false}'::jsonb);
INSERT INTO terminology.translation (id, entry_id, locale, name, description, aliases) VALUES ('9f2ec275-b8de-42fa-ac9c-6dfa0a1adfc4','841b14d9-3ab0-50da-9875-4fa883e38619','vi-VN','Công vật lý','Chỉ số được dùng trong tính sát thương của đòn đánh và các chiêu thức vật lý.','["Công VL"]'::jsonb);

INSERT INTO terminology.entry (id, reference_key, kind, display_order, display) VALUES ('23d30d70-bdff-5a94-8294-aa0636816198','cong-phep','term',4,'{"underline":true,"showIcon":false}'::jsonb);
INSERT INTO terminology.translation (id, entry_id, locale, name, description, aliases) VALUES ('dea842d7-d033-40ea-b4f6-a21c1f6dc51c','23d30d70-bdff-5a94-8294-aa0636816198','vi-VN','Công phép','Chỉ số được dùng trong tính sát thương hoặc hiệu ứng của các chiêu thức có hệ số công phép.','[]'::jsonb);

INSERT INTO terminology.entry (id, reference_key, kind, display_order, display) VALUES ('7e211f4a-f71e-5f8d-ab67-a4ba759f63d5','giap','term',5,'{"underline":true,"showIcon":false}'::jsonb);
INSERT INTO terminology.translation (id, entry_id, locale, name, description, aliases) VALUES ('83efac17-07fe-4158-9c8e-256b95d5acb3','7e211f4a-f71e-5f8d-ab67-a4ba759f63d5','vi-VN','Giáp','Chỉ số giúp giảm sát thương vật lý phải nhận.','["Giáp vật lý"]'::jsonb);

INSERT INTO terminology.entry (id, reference_key, kind, display_order, display) VALUES ('43510396-af1a-5399-b9e1-9348caf1d63a','giap-phep','term',6,'{"underline":true,"showIcon":false}'::jsonb);
INSERT INTO terminology.translation (id, entry_id, locale, name, description, aliases) VALUES ('d770324f-cf20-457e-b47a-8dd4aaca4550','43510396-af1a-5399-b9e1-9348caf1d63a','vi-VN','Giáp phép','Chỉ số giúp giảm sát thương phép phải nhận.','["Kháng phép"]'::jsonb);

INSERT INTO terminology.entry (id, reference_key, kind, display_order, display) VALUES ('91acd20e-8179-50ce-9c61-9ba45b53972e','hoi-mau','term',7,'{"underline":true,"showIcon":false}'::jsonb);
INSERT INTO terminology.translation (id, entry_id, locale, name, description, aliases) VALUES ('4773c1e7-dcfa-4209-b6c7-1366725a13b7','91acd20e-8179-50ce-9c61-9ba45b53972e','vi-VN','Hồi máu','Khôi phục một lượng máu cho tướng.','["Hồi phục máu"]'::jsonb);

INSERT INTO terminology.entry (id, reference_key, kind, display_order, display) VALUES ('0b686559-e870-5ba1-9d22-93ee1acf7ddd','la-chan','term',8,'{"underline":true,"showIcon":false}'::jsonb);
INSERT INTO terminology.translation (id, entry_id, locale, name, description, aliases) VALUES ('08dc4405-90cd-49ed-861c-f63224325299','0b686559-e870-5ba1-9d22-93ee1acf7ddd','vi-VN','Lá chắn','Hiệu ứng giúp hấp thụ sát thương trong phạm vi và thời gian do chiêu thức quy định.','[]'::jsonb);

INSERT INTO terminology.entry (id, reference_key, kind, display_order, display) VALUES ('3a8d931b-46cf-54b1-88f5-3255439a267d','toc-chay','term',9,'{"underline":true,"showIcon":false}'::jsonb);
INSERT INTO terminology.translation (id, entry_id, locale, name, description, aliases) VALUES ('3a7ebdce-8512-4fda-bcbb-c79c166be738','3a8d931b-46cf-54b1-88f5-3255439a267d','vi-VN','Tốc chạy','Chỉ số thể hiện tốc độ di chuyển của tướng.','["Tốc độ di chuyển"]'::jsonb);

INSERT INTO terminology.entry (id, reference_key, kind, display_order, display) VALUES ('7f588cdf-71dd-55fe-a358-c75710f6fe3c','toc-danh','term',10,'{"underline":true,"showIcon":false}'::jsonb);
INSERT INTO terminology.translation (id, entry_id, locale, name, description, aliases) VALUES ('a24a41d6-2880-41de-968b-d99156a8637e','7f588cdf-71dd-55fe-a358-c75710f6fe3c','vi-VN','Tốc đánh','Chỉ số liên quan đến số đòn đánh thường tướng có thể thực hiện trong một khoảng thời gian.','["Tốc độ đánh"]'::jsonb);

INSERT INTO terminology.entry (id, reference_key, kind, display_order, display) VALUES ('0fae7f82-b10a-5311-a0f7-8cdf56ff6550','chi-mang','term',11,'{"underline":true,"showIcon":false}'::jsonb);
INSERT INTO terminology.translation (id, entry_id, locale, name, description, aliases) VALUES ('15125c3e-c644-46c3-bac0-4e8b054a397c','0fae7f82-b10a-5311-a0f7-8cdf56ff6550','vi-VN','Chí mạng','Đòn đánh gây thêm sát thương so với đòn đánh thông thường, theo quy tắc của hiệu ứng.','[]'::jsonb);

INSERT INTO terminology.entry (id, reference_key, kind, display_order, display) VALUES ('17b44f31-bf22-5d1b-8cbc-43236a63064d','lam-cham','term',12,'{"underline":true,"showIcon":false}'::jsonb);
INSERT INTO terminology.translation (id, entry_id, locale, name, description, aliases) VALUES ('c99f493b-270c-472a-8c82-11a297066be3','17b44f31-bf22-5d1b-8cbc-43236a63064d','vi-VN','Làm chậm','Hiệu ứng giảm tốc chạy của mục tiêu trong một khoảng thời gian.','[]'::jsonb);

INSERT INTO terminology.entry (id, reference_key, kind, display_order, display) VALUES ('77f7f439-3ebb-570f-a3ab-b7e0517f9c7b','choang','term',13,'{"underline":true,"showIcon":false}'::jsonb);
INSERT INTO terminology.translation (id, entry_id, locale, name, description, aliases) VALUES ('a17e8274-1406-4ca7-ba83-d43808a8141a','77f7f439-3ebb-570f-a3ab-b7e0517f9c7b','vi-VN','Choáng','Hiệu ứng khống chế khiến mục tiêu tạm thời không thể di chuyển, đánh thường hoặc dùng chiêu.','["Làm choáng"]'::jsonb);

INSERT INTO terminology.entry (id, reference_key, kind, display_order, display) VALUES ('dbb853a3-a82d-51a4-be15-842bf9493b30','giam-hoi-chieu','term',14,'{"underline":true,"showIcon":false}'::jsonb);
INSERT INTO terminology.translation (id, entry_id, locale, name, description, aliases) VALUES ('01274bf1-bcf0-4f69-ae31-94610a2cc18f','dbb853a3-a82d-51a4-be15-842bf9493b30','vi-VN','Giảm hồi chiêu','Chỉ số giúp rút ngắn thời gian chờ giữa các lần sử dụng chiêu thức.','["Giảm thời gian hồi chiêu"]'::jsonb);

INSERT INTO terminology.entry (id, reference_key, kind, display_order, display) VALUES ('b4a7c240-7742-5ed7-a137-02e12253f237','noi-tai','term',15,'{"underline":true,"showIcon":false}'::jsonb);
INSERT INTO terminology.translation (id, entry_id, locale, name, description, aliases) VALUES ('6b753f76-ff37-4c43-8188-6089915487e9','b4a7c240-7742-5ed7-a137-02e12253f237','vi-VN','Nội tại','Hiệu ứng bị động tự kích hoạt khi đáp ứng các điều kiện được mô tả.','[]'::jsonb);
