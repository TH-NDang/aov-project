package com.wikiaov.hero.internal.persistence;

import com.wikiaov.hero.internal.application.HeroErrorCode;
import com.wikiaov.hero.internal.application.response.HeroRevisionView;
import com.wikiaov.hero.internal.domain.HeroContent.Cause;
import com.wikiaov.hero.internal.domain.HeroSection;
import com.wikiaov.platform.ApiException;
import java.sql.*;
import java.time.Instant;
import java.util.*;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

@Repository
public class HeroStore {
    private final JdbcClient jdbc;
    private final HeroIdentityRepository heroes;
    private final HeroRevisionRepository revisions;
    private final jakarta.persistence.EntityManager entities;

    public HeroStore(JdbcClient jdbc, HeroIdentityRepository heroes, HeroRevisionRepository revisions,
            jakarta.persistence.EntityManager entities) {
        this.jdbc = jdbc;
        this.heroes = heroes;
        this.revisions = revisions;
        this.entities = entities;
    }

    public List<Map<String, Object>> rows(String sql, Object... args) {
        entities.flush();
        return jdbc.sql(sql).params(args).query().listOfRows();
    }

    public int write(String sql, Object... args) {
        entities.flush();
        return jdbc.sql(sql).params(args).update();
    }

    public void lockHero(UUID heroId) {
        heroes.lockById(heroId).orElseThrow(() -> new ApiException(HeroErrorCode.HERO_NOT_FOUND,
                "The hero does not exist."));
    }

    public com.wikiaov.hero.internal.persistence.entity.HeroRevision editableEntity(UUID id) {
        return revisions.findById(id).orElseThrow(() -> new ApiException(HeroErrorCode.HERO_REVISION_NOT_FOUND,
                "The hero revision does not exist."));
    }

    public void insert(Object entity) {
        entities.persist(entity);
        entities.flush();
    }

    public HeroRevisionView revision(UUID heroId, UUID id) {
        return revisions.findByHeroIdAndId(heroId, id).map(this::view).orElseThrow(
                () -> new ApiException(HeroErrorCode.HERO_REVISION_NOT_FOUND, "The hero revision does not exist."));
    }

    public List<HeroRevisionView> revisions(UUID heroId) {
        return revisions.findByHeroIdOrderByRevisionNoDesc(heroId).stream().map(this::view).toList();
    }

    public List<HeroRevisionView> revisions(Collection<UUID> heroIds) {
        return revisions.findByHeroIdInOrderByRevisionNoDesc(heroIds).stream().map(this::view).toList();
    }

    private HeroRevisionView view(com.wikiaov.hero.internal.persistence.entity.HeroRevision r) {
        Map<HeroSection, UUID> sections = new EnumMap<>(HeroSection.class);
        put(sections, HeroSection.PROFILE, r.getProfileRevisionId());
        put(sections, HeroSection.OVERVIEW_RATINGS, r.getOverviewRatingRevisionId());
        put(sections, HeroSection.COMBAT_STATS, r.getCombatStatsRevisionId());
        put(sections, HeroSection.SKILLS, r.getSkillsRevisionId());
        put(sections, HeroSection.SKINS, r.getSkinsRevisionId());
        put(sections, HeroSection.MEDIA_BINDINGS, r.getMediaBindingRevisionId());
        return new HeroRevisionView(r.getId(), r.getHeroId(), r.getRulesetId(), r.getRevisionNo(), r.getState(),
                r.getVersion(), r.getPublicationSequence(), r.getPublishedAt(), Cause.valueOf(r.getCause()),
                r.getSourceRevisionId(), r.getEffectiveFromPatchVariantId(), sections);
    }

    private static void put(Map<HeroSection, UUID> target, HeroSection section, UUID value) {
        if (value != null)
            target.put(section, value);
    }

    public static Timestamp time(Instant instant) {
        return Timestamp.from(instant);
    }
}
