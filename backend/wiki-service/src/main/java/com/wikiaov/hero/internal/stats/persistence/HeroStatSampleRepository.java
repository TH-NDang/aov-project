package com.wikiaov.hero.internal.stats.persistence;

import com.wikiaov.hero.internal.stats.persistence.entity.StatRow;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.Repository;

public interface HeroStatSampleRepository extends Repository<StatRow, StatRow.Key> {
    @Query(value = """
            with revisions as (
                select distinct on (hero_id) hero_id, state, profile_revision_id, combat_stats_revision_id, skills_revision_id
                from hero.hero_revision
                where effective_from_patch_variant_id = :variantId and ruleset_id = :rulesetId
                    and state in ('DRAFT', 'PUBLISHED')
                order by hero_id, revision_no desc
            )
            select cast(jsonb_build_object(
                'heroId', r.hero_id, 'draft', r.state = 'DRAFT',
                'roles', coalesce((select jsonb_agg(role_code order by role_code) from hero.hero_profile_role
                    where profile_revision_id = r.profile_revision_id), '[]'),
                'baseStats', coalesce((select jsonb_object_agg(stat_key,
                        jsonb_build_object('value',base_value,'unit',unit_code,'percent',percent_value))
                    from hero.hero_combat_stat_value where stats_revision_id = r.combat_stats_revision_id and base_value is not null), '{}'),
                'capture', capture.data
            ) as text)
            from revisions r
            left join lateral (
                select jsonb_build_object('patchCode', e.metadata ->> 'patchCode',
                    'level', case when jsonb_typeof(e.metadata #> '{observedAttributes,heroLevel}') = 'number'
                        then e.metadata #> '{observedAttributes,heroLevel}' end,
                    'values', e.metadata #> '{observedAttributes,values}') data
                from hero.hero_skill_effect e
                join hero.hero_skill_snapshot s using (skill_set_revision_id, skill_key)
                where e.skill_set_revision_id = r.skills_revision_id and e.effect_type = 'SOURCE_SNAPSHOT'
                    and e.metadata #>> '{observedAttributes,method}' = 'MANUAL_VISUAL_TRANSCRIPTION'
                    and e.metadata #>> '{observedAttributes,scope}' = 'DISPLAYED_SNAPSHOT_NOT_LEVEL_ONE'
                    and jsonb_typeof(e.metadata #> '{observedAttributes,values}') = 'object'
                order by s.display_order, e.effect_order limit 1
            ) capture on true
            order by r.hero_id
            """, nativeQuery = true)
    List<String> samples(UUID variantId, UUID rulesetId);
}
