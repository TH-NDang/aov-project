-- What a hero costs and how each skin is obtained, per market. This follows the in-game shop rather than a game patch,
-- so it sits beside the versioned hero content and changes without a draft.
CREATE TABLE hero.hero_shop_price (
 hero_id UUID NOT NULL REFERENCES hero.hero,
 region_code VARCHAR(16) NOT NULL,
 availability VARCHAR(16) NOT NULL CHECK(availability IN ('ON_SALE','NOT_OPEN','COMING_SOON','UNKNOWN')),
 gold_price INTEGER CHECK(gold_price >= 0),
 voucher_price INTEGER CHECK(voucher_price >= 0),
 captured_on DATE,
 needs_review BOOLEAN NOT NULL DEFAULT FALSE,
 note VARCHAR(500),
 updated_at TIMESTAMPTZ NOT NULL,
 PRIMARY KEY(hero_id,region_code)
);

CREATE TABLE hero.hero_skin_acquisition (
 hero_id UUID NOT NULL,
 skin_key VARCHAR(64) NOT NULL,
 region_code VARCHAR(16) NOT NULL,
 method VARCHAR(16) NOT NULL CHECK(method IN ('VOUCHER','EVENT','NOT_OPEN','OTHER','UNKNOWN')),
 voucher_price INTEGER CHECK(voucher_price >= 0),
 event_name VARCHAR(200),
 captured_on DATE,
 needs_review BOOLEAN NOT NULL DEFAULT FALSE,
 note VARCHAR(500),
 updated_at TIMESTAMPTZ NOT NULL,
 PRIMARY KEY(hero_id,skin_key,region_code),
 FOREIGN KEY(hero_id,skin_key) REFERENCES hero.hero_skin(hero_id,skin_key)
);
