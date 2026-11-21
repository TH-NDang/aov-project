-- A hero's attributes do not change with its level: the game's attribute screen shows the same values from level 1
-- to 15, and only items, arcana and enchantments add to them. No row ever recorded a per-level growth.
ALTER TABLE hero.hero_combat_stat_value DROP COLUMN growth_per_level;
