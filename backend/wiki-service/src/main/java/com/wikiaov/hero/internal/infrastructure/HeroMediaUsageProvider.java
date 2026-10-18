package com.wikiaov.hero.internal.infrastructure;

import com.wikiaov.hero.internal.application.service.HeroQueries;
import com.wikiaov.hero.internal.persistence.HeroStore;
import com.wikiaov.media.*;
import com.wikiaov.patch.GameplayContexts;
import java.time.Clock;
import java.util.*;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
public class HeroMediaUsageProvider implements MediaUsageProvider {
    private final HeroStore store;
    private final HeroQueries queries;
    private final GameplayContexts contexts;
    private final Clock clock;
    public HeroMediaUsageProvider(HeroStore store, HeroQueries queries, GameplayContexts contexts, Clock clock) {
        this.store = store;
        this.queries = queries;
        this.contexts = contexts;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public List<MediaUsage> findUsages(UUID assetId) {
        var rows = store.rows("""
   SELECT DISTINCT r.hero_id,r.id,r.state,b.media_role role FROM hero.hero_revision r
   JOIN hero.hero_media_binding b ON b.media_binding_revision_id=r.media_binding_revision_id WHERE b.asset_id=? AND r.state<>'DISCARDED'
   UNION SELECT DISTINCT r.hero_id,r.id,r.state,'SKILL_ICON:'||s.skill_key FROM hero.hero_revision r
   JOIN hero.hero_skill_snapshot s ON s.skill_set_revision_id=r.skills_revision_id WHERE s.icon_asset_id=? AND r.state<>'DISCARDED'
   UNION SELECT DISTINCT r.hero_id,r.id,r.state,'SKIN_ART:'||s.skin_key FROM hero.hero_revision r
   JOIN hero.hero_skin_snapshot s ON s.skin_set_revision_id=r.skins_revision_id WHERE s.art_asset_id=? AND r.state<>'DISCARDED'
   UNION SELECT DISTINCT r.hero_id,r.id,r.state,'SKIN_HEAD:'||s.skin_key FROM hero.hero_revision r
   JOIN hero.hero_skin_snapshot s ON s.skin_set_revision_id=r.skins_revision_id WHERE s.head_asset_id=? AND r.state<>'DISCARDED'
   UNION SELECT DISTINCT r.hero_id,r.id,r.state,'SKIN_PORTRAIT:'||s.skin_key FROM hero.hero_revision r
   JOIN hero.hero_skin_snapshot s ON s.skin_set_revision_id=r.skins_revision_id WHERE s.portrait_asset_id=? AND r.state<>'DISCARDED'
   UNION SELECT DISTINCT r.hero_id,r.id,r.state,b.media_role FROM hero.hero_revision r
   JOIN hero.hero_image_option b ON b.media_binding_revision_id=r.media_binding_revision_id WHERE b.asset_id=? AND r.state<>'DISCARDED'
   UNION SELECT DISTINCT r.hero_id,r.id,r.state,'SKIN_'||CASE WHEN b.media_role='SPLASH' THEN 'ART' ELSE b.media_role END||':'||b.skin_key FROM hero.hero_revision r
   JOIN hero.skin_image_option b ON b.skin_set_revision_id=r.skins_revision_id WHERE b.asset_id=? AND r.state<>'DISCARDED'
   """, assetId, assetId, assetId, assetId, assetId, assetId, assetId);
        var at = clock.instant();
        var active = contexts.active(at);
        Set<UUID> current = new HashSet<>();
        for (var row : rows) {
            UUID hero = (UUID) row.get("hero_id");
            for (var ctx : active)
                queries.current(hero, ctx, at).ifPresent(r -> current.add(r.id()));
        }
        return rows.stream().map(row -> {
            UUID id = (UUID) row.get("id");
            return new MediaUsage("HERO", "HERO", (UUID) row.get("hero_id"), id, (String) row.get("role"),
                    "DRAFT".equals(row.get("state"))
                            ? MediaUsageScope.DRAFT
                            : current.contains(id) ? MediaUsageScope.CURRENT : MediaUsageScope.HISTORICAL);
        }).toList();
    }
}
