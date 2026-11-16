-- A skill translation may carry a short plain summary beside the game's own description, for readers new to the game.
-- NULL means no summary has been written. Published rows keep NULL: a summary reaches a published hero through a new draft.
ALTER TABLE hero.hero_skill_translation
    ADD COLUMN summary VARCHAR(300),
    ADD CONSTRAINT hero_skill_translation_summary_check
        CHECK (summary IS NULL
            OR (btrim(summary) <> '' AND strpos(summary, chr(10)) = 0 AND strpos(summary, chr(13)) = 0));
