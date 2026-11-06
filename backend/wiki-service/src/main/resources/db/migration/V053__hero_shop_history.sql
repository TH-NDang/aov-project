-- Prices and ways of getting a skin change over time, and an older view must still show what held then. Each row now
-- says what the shop showed from its date on, so a new date adds a step instead of replacing the last one.
UPDATE hero.hero_shop_price SET captured_on = updated_at::date WHERE captured_on IS NULL;
ALTER TABLE hero.hero_shop_price ALTER COLUMN captured_on SET NOT NULL;
ALTER TABLE hero.hero_shop_price DROP CONSTRAINT hero_shop_price_pkey;
ALTER TABLE hero.hero_shop_price ADD PRIMARY KEY (hero_id, region_code, captured_on);

UPDATE hero.hero_skin_acquisition SET captured_on = updated_at::date WHERE captured_on IS NULL;
ALTER TABLE hero.hero_skin_acquisition ALTER COLUMN captured_on SET NOT NULL;
ALTER TABLE hero.hero_skin_acquisition DROP CONSTRAINT hero_skin_acquisition_pkey;
ALTER TABLE hero.hero_skin_acquisition ADD PRIMARY KEY (hero_id, skin_key, region_code, captured_on);
