-- A hero's lanes belong to the hero, next to its roles. Until now they could only be read from a captured skill
-- snapshot, which no editor could reach and a hero without skills could not hold.
CREATE TABLE hero.hero_profile_position (
 profile_revision_id UUID NOT NULL REFERENCES hero.hero_profile_revision,
 position_code VARCHAR(16) NOT NULL CHECK(position_code IN ('TOP','MID','JUNGLE','DRAGON','SUPPORT')),
 PRIMARY KEY(profile_revision_id,position_code)
);

-- What was captured from game screens comes first.
INSERT INTO hero.hero_profile_position (profile_revision_id, position_code)
SELECT DISTINCT revision.profile_revision_id,
       CASE captured.value
           WHEN 'top' THEN 'TOP'
           WHEN 'mid' THEN 'MID'
           WHEN 'rung' THEN 'JUNGLE'
           WHEN 'rong-ad' THEN 'DRAGON'
           WHEN 'tro-thu' THEN 'SUPPORT'
       END
FROM hero.hero_revision revision
JOIN hero.hero_skill_effect effect
  ON effect.skill_set_revision_id = revision.skills_revision_id AND effect.effect_type = 'SOURCE_SNAPSHOT'
CROSS JOIN LATERAL jsonb_array_elements_text(
    CASE
        WHEN jsonb_typeof(effect.metadata #> '{heroClassification,recommendedPositions}') = 'array'
        THEN effect.metadata #> '{heroClassification,recommendedPositions}'
        ELSE '[]'::jsonb
    END
) AS captured(value)
WHERE revision.profile_revision_id IS NOT NULL
  AND captured.value IN ('top','mid','rung','rong-ad','tro-thu');

-- Heroes without a capture keep the provisional lanes the public site has been showing. Editors can now correct them.
INSERT INTO hero.hero_profile_position (profile_revision_id, position_code)
SELECT DISTINCT revision.profile_revision_id, provisional.position_code
FROM (VALUES
    ('aleister','MID'),
    ('amily','TOP'),('amily','JUNGLE'),
    ('ata','TOP'),('ata','SUPPORT'),
    ('baldum','SUPPORT'),
    ('celica','DRAGON'),
    ('d-arcy','MID'),('d-arcy','JUNGLE'),
    ('dirak','MID'),
    ('eland-orr','JUNGLE'),
    ('errol','TOP'),('errol','JUNGLE'),
    ('flowborn-ad','DRAGON'),
    ('gildur','MID'),('gildur','SUPPORT'),
    ('hayate','DRAGON'),
    ('kriknak','JUNGLE'),
    ('krizzix','SUPPORT'),
    ('lauriel','MID'),
    ('natalya','MID'),
    ('raz','MID'),
    ('roxie','TOP'),
    ('ryoma','TOP'),('ryoma','JUNGLE'),
    ('toro','SUPPORT'),
    ('volkath','TOP'),('volkath','JUNGLE'),
    ('wukong','TOP'),('wukong','JUNGLE'),
    ('yorn','DRAGON'),
    ('zanis','JUNGLE')
) AS provisional(code, position_code)
JOIN hero.hero hero ON hero.code = provisional.code
JOIN hero.hero_revision revision ON revision.hero_id = hero.id
WHERE revision.profile_revision_id IS NOT NULL
  AND NOT EXISTS (
      SELECT 1 FROM hero.hero_profile_position existing
      WHERE existing.profile_revision_id = revision.profile_revision_id
  );

CREATE TRIGGER trg_hero_profile_position_immutable BEFORE INSERT OR UPDATE OR DELETE ON hero.hero_profile_position
    FOR EACH ROW EXECUTE FUNCTION hero.guard_section_child('hero_profile_revision','profile_revision_id');
