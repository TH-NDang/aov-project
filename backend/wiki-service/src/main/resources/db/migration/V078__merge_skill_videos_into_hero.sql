-- Skills no longer keep videos of their own (ADR-019, amended 2026-11-27): every video about a hero, its skills
-- included, sits in the hero's one list. Each skill video becomes a video of its hero.

-- A hero cannot hold the same video twice from the same start point. Where the hero already has it, or two skills
-- share it, one row stays: a published one first, then the hero's own, then the oldest.
WITH ranked AS (
    SELECT id,
           subject_kind,
           row_number() OVER (
               PARTITION BY subject_id, url, start_seconds
               ORDER BY CASE status WHEN 'PUBLISHED' THEN 0 WHEN 'DRAFT' THEN 1 ELSE 2 END,
                        CASE subject_kind WHEN 'HERO' THEN 0 ELSE 1 END,
                        created_at,
                        id) AS position,
           count(*) FILTER (WHERE subject_kind = 'SKILL') OVER (PARTITION BY subject_id, url, start_seconds) AS skills
    FROM video.subject_video
    WHERE subject_kind IN ('HERO', 'SKILL')
)
DELETE FROM video.subject_video v
USING ranked r
WHERE v.id = r.id AND r.position > 1 AND r.skills > 0;

-- The former skill videos follow the hero's own, skill by skill, each skill keeping its editor's order.
WITH hero_end AS (
    SELECT subject_id, max(display_order) + 1 AS first_free
    FROM video.subject_video
    WHERE subject_kind = 'HERO'
    GROUP BY subject_id
),
moved AS (
    SELECT v.id,
           coalesce(e.first_free, 0)
               + row_number() OVER (
                     PARTITION BY v.subject_id
                     ORDER BY v.subject_key, v.display_order, v.created_at, v.id) - 1 AS display_order
    FROM video.subject_video v
    LEFT JOIN hero_end e ON e.subject_id = v.subject_id
    WHERE v.subject_kind = 'SKILL'
)
UPDATE video.subject_video v
SET subject_kind = 'HERO',
    subject_key = NULL,
    display_order = m.display_order,
    version = v.version + 1,
    updated_at = now()
FROM moved m
WHERE v.id = m.id;

ALTER TABLE video.subject_video
    DROP CONSTRAINT subject_video_key_matches_kind,
    DROP CONSTRAINT subject_video_subject_kind_check;

ALTER TABLE video.subject_video
    ADD CONSTRAINT subject_video_subject_kind_check
        CHECK (subject_kind IN ('HERO', 'SKIN', 'ITEM', 'ENCHANTMENT', 'ARCANA', 'SPELL')),
    ADD CONSTRAINT subject_video_key_matches_kind CHECK ((subject_kind = 'SKIN') = (subject_key IS NOT NULL));
