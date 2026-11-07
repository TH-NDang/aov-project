-- The game shows armor, magic armor and both pierce stats as "<number> | <percent>%". The percent is what the game
-- displays, not something the number gives: the 2026-10-30 captures hold 137 | 0%, 150 | 20% and 171 | 0%.
ALTER TABLE hero.hero_combat_stat_value
    ADD COLUMN percent_value NUMERIC,
    ADD CONSTRAINT hero_combat_stat_value_percent_check
        CHECK (percent_value IS NULL OR (base_value IS NOT NULL AND percent_value BETWEEN 0 AND 100));
