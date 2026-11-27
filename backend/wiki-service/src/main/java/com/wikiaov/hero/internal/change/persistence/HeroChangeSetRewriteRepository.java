package com.wikiaov.hero.internal.change.persistence;

import com.wikiaov.hero.internal.change.persistence.entity.HeroPatchChangeSet;
import java.util.Collection;
import java.util.UUID;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.Repository;
import org.springframework.data.repository.query.Param;

/**
 * The only writes that change recorded hero patch history. The tables refuse updates and deletes unless the transaction
 * first opens a rewrite (V078), so nothing else can change them by accident.
 */
public interface HeroChangeSetRewriteRepository extends Repository<HeroPatchChangeSet, UUID> {
    @Query(value = "select set_config('hero.change_history_rewrite', 'on', true)", nativeQuery = true)
    String openRewrite();

    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query(value = "update hero.hero_patch_change_set set source_url = :sourceUrl where id = :id", nativeQuery = true)
    int replaceSourceUrl(@Param("id") UUID id, @Param("sourceUrl") String sourceUrl);

    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query(value = "delete from hero.hero_patch_change_translation where change_set_id = :id and locale in (:locales)", nativeQuery = true)
    int deleteTranslations(@Param("id") UUID id, @Param("locales") Collection<String> locales);

    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query(value = """
            delete from hero.hero_mechanic_change_previous where mechanic_change_id in
                (select id from hero.hero_mechanic_change where change_set_id = :id)
            """, nativeQuery = true)
    int deletePrevious(@Param("id") UUID id);

    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query(value = """
            with stats as (delete from hero.hero_stat_change where change_set_id = :id),
                skills as (delete from hero.hero_skill_change where change_set_id = :id),
                roles as (delete from hero.hero_role_change where change_set_id = :id),
                visuals as (delete from hero.hero_visual_change where change_set_id = :id),
                mechanics as (delete from hero.hero_mechanic_change where change_set_id = :id)
            delete from hero.hero_other_change where change_set_id = :id
            """, nativeQuery = true)
    int deleteLines(@Param("id") UUID id);
}
