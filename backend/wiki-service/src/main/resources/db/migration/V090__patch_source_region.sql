-- A patch's official notes are published by every market in its own languages. Each link may name the market that
-- published it, so readers can find their market's page (2026-11-28). Existing links keep no market.
ALTER TABLE patch.variant_source ADD COLUMN region_code VARCHAR(16);
