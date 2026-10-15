package com.wikiaov.hero.internal.persistence;
import com.wikiaov.access.Actor;
import com.wikiaov.hero.internal.domain.HeroContent.*;
import com.wikiaov.hero.internal.domain.HeroSection;
import java.math.BigDecimal;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.*;
import org.springframework.stereotype.Repository;
import tools.jackson.databind.json.JsonMapper;
@Repository
public class HeroSections {
    private final HeroStore store;
    private final JsonMapper json;
    public HeroSections(HeroStore store, JsonMapper json) {
        this.store = store;
        this.json = json;
    }
    public UUID create(UUID heroId, HeroSection section, Object content, Actor actor, Instant at) {
        UUID id = UUID.randomUUID();
        store.write("INSERT INTO " + section.table()
                + "(id,hero_id,state,created_at,created_by_issuer,created_by_subject) VALUES(?,?,'DRAFT',?,?,?)", id,
                heroId, Timestamp.from(at), actor.issuer(), actor.subject());
        if (content != null)
            switch (section) {
                case PROFILE -> {
                    var p = (Profile) content;
                    for (var t : p.translations())
                        store.write("INSERT INTO hero.hero_profile_translation VALUES(?,?,?,?,?,?)", id, t.locale(),
                                t.name(), t.title(), t.summary(), t.lore());
                    for (var role : p.roles())
                        store.write("INSERT INTO hero.hero_profile_role VALUES(?,?)", id, role.name());
                    sources(section, id, p.sources());
                }
                case OVERVIEW_RATINGS -> {
                    var p = (Ratings) content;
                    store.write(
                            "UPDATE hero.hero_overview_rating_revision SET scale_code=?,survivability=?,attack_damage=?,skill_effects=?,difficulty=?,derived=? WHERE id=?",
                            p.scaleCode(), p.survivability(), p.attackDamage(), p.skillEffects(), p.difficulty(),
                            p.derived(), id);
                    sources(section, id, p.sources());
                }
                case COMBAT_STATS -> {
                    var p = (Stats) content;
                    for (var v : p.values())
                        store.write(
                                "INSERT INTO hero.hero_combat_stat_value(stats_revision_id,stat_key,base_value,growth_per_level,unit_code) VALUES(?,?,?,?,?)",
                                id, v.statKey(), v.baseValue(), v.growthPerLevel(), v.unit());
                    sources(section, id, p.sources());
                }
                case SKILLS -> {
                    var p = (Skills) content;
                    for (var v : p.skills()) {
                        store.write("INSERT INTO hero.hero_skill VALUES(?,?,?) ON CONFLICT DO NOTHING", heroId,
                                v.skillKey(), Timestamp.from(at));
                        store.write("INSERT INTO hero.hero_skill_snapshot VALUES(?,?,?,?,?,?,?)", id, heroId,
                                v.skillKey(), v.kind().name(), v.formKey(), v.displayOrder(), v.iconAssetId());
                        for (var t : v.translations())
                            store.write("INSERT INTO hero.hero_skill_translation VALUES(?,?,?,?,?)", id, v.skillKey(),
                                    t.locale(), t.name(), t.description());
                        for (int n = 0; n < v.effects().size(); n++) {
                            var e = v.effects().get(n);
                            store.write("INSERT INTO hero.hero_skill_effect VALUES(?,?,?,?,CAST(? AS jsonb))", id,
                                    v.skillKey(), n, e.effectType(), json.writeValueAsString(e.metadata()));
                        }
                    }
                    sources(section, id, p.sources());
                }
                case SKINS -> {
                    var p = (Skins) content;
                    for (var v : p.skins()) {
                        store.write("INSERT INTO hero.hero_skin VALUES(?,?,?) ON CONFLICT DO NOTHING", heroId,
                                v.skinKey(), Timestamp.from(at));
                        store.write("INSERT INTO hero.hero_skin_snapshot VALUES(?,?,?,?,?,?)", id, heroId, v.skinKey(),
                                v.displayOrder(), v.artAssetId(), v.rarityCode());
                        for (var t : v.translations())
                            store.write("INSERT INTO hero.hero_skin_translation VALUES(?,?,?,?,?,?)", id, v.skinKey(),
                                    t.locale(), t.name(), t.description(), t.acquisitionNote());
                    }
                    sources(section, id, p.sources());
                }
                case MEDIA_BINDINGS -> {
                    var p = (Bindings) content;
                    for (var e : p.bindings().entrySet())
                        store.write("INSERT INTO hero.hero_media_binding VALUES(?,?,?)", id, e.getKey().name(),
                                e.getValue());
                    sources(section, id, p.sources());
                }
            }
        return id;
    }
    private void sources(HeroSection section, UUID id, List<Source> sources) {
        for (int n = 0; n < sources.size(); n++) {
            var s = sources.get(n);
            store.write("INSERT INTO hero.hero_source_reference VALUES(?,?,?,?,?,?,?,?,?)", UUID.randomUUID(),
                    section.name(), id, n, s.label(), s.sourceUrl(),
                    s.observedAt() == null ? null : Timestamp.from(s.observedAt()), s.verificationState().name(),
                    s.note());
        }
    }
    public List<Source> sources(HeroSection section, UUID id) {
        return store.rows(
                "SELECT * FROM hero.hero_source_reference WHERE owner_type=? AND owner_revision_id=? ORDER BY position",
                section.name(), id).stream()
                .map(r -> new Source(str(r, "label"), str(r, "source_url"),
                        r.get("observed_at") == null ? null : ((Timestamp) r.get("observed_at")).toInstant(),
                        Verification.valueOf(str(r, "verification_state")), str(r, "note")))
                .toList();
    }
    public Object content(HeroSection section, UUID id) {
        var src = sources(section, id);
        return switch (section) {
            case PROFILE -> new Profile(store
                    .rows("SELECT * FROM hero.hero_profile_translation WHERE profile_revision_id=? ORDER BY locale", id)
                    .stream()
                    .map(r -> new ProfileTranslation(str(r, "locale"), str(r, "name"), str(r, "title"),
                            str(r, "summary"), str(r, "lore")))
                    .toList(),
                    new HashSet<>(store.rows(
                            "SELECT role_code FROM hero.hero_profile_role WHERE profile_revision_id=? ORDER BY role_code",
                            id).stream().map(r -> Role.valueOf(str(r, "role_code"))).toList()),
                    src);
            case OVERVIEW_RATINGS -> {
                var r = store.rows("SELECT * FROM hero.hero_overview_rating_revision WHERE id=?", id).getFirst();
                yield new Ratings(str(r, "scale_code"), num(r, "survivability"), num(r, "attack_damage"),
                        num(r, "skill_effects"), num(r, "difficulty"), (boolean) r.get("derived"), src);
            }
            case COMBAT_STATS -> new Stats(store
                    .rows("SELECT * FROM hero.hero_combat_stat_value WHERE stats_revision_id=? ORDER BY stat_key", id)
                    .stream().map(r -> new Stat(str(r, "stat_key"), num(r, "base_value"), num(r, "growth_per_level"),
                            str(r, "unit_code")))
                    .toList(), src);
            case SKILLS -> new Skills(store
                    .rows("SELECT * FROM hero.hero_skill_snapshot WHERE skill_set_revision_id=? ORDER BY display_order",
                            id)
                    .stream().map(r -> {
                        String key = str(r, "skill_key");
                        return new Skill(key, SkillKind.valueOf(str(r, "kind")), str(r, "form_key"),
                                ((Number) r.get("display_order")).intValue(), (UUID) r.get("icon_asset_id"),
                                store.rows(
                                        "SELECT * FROM hero.hero_skill_translation WHERE skill_set_revision_id=? AND skill_key=? ORDER BY locale",
                                        id, key).stream()
                                        .map(t -> new SkillTranslation(str(t, "locale"), str(t, "name"),
                                                str(t, "description")))
                                        .toList(),
                                store.rows(
                                        "SELECT * FROM hero.hero_skill_effect WHERE skill_set_revision_id=? AND skill_key=? ORDER BY effect_order",
                                        id, key).stream()
                                        .map(e -> new Effect(str(e, "effect_type"),
                                                json.readValue(e.get("metadata").toString(), Map.class)))
                                        .toList());
                    }).toList(), src);
            case SKINS -> new Skins(store
                    .rows("SELECT * FROM hero.hero_skin_snapshot WHERE skin_set_revision_id=? ORDER BY display_order",
                            id)
                    .stream().map(r -> {
                        String key = str(r, "skin_key");
                        return new Skin(key, ((Number) r.get("display_order")).intValue(), (UUID) r.get("art_asset_id"),
                                str(r, "rarity_code"),
                                store.rows(
                                        "SELECT * FROM hero.hero_skin_translation WHERE skin_set_revision_id=? AND skin_key=? ORDER BY locale",
                                        id, key).stream()
                                        .map(t -> new SkinTranslation(str(t, "locale"), str(t, "name"),
                                                str(t, "description"), str(t, "acquisition_note")))
                                        .toList());
                    }).toList(), src);
            case MEDIA_BINDINGS -> {
                Map<MediaRole, UUID> bindings = new EnumMap<>(MediaRole.class);
                store.rows("SELECT * FROM hero.hero_media_binding WHERE media_binding_revision_id=?", id)
                        .forEach(r -> bindings.put(MediaRole.valueOf(str(r, "media_role")), (UUID) r.get("asset_id")));
                yield new Bindings(bindings, src);
            }
        };
    }
    public void publish(HeroSection section, UUID id, UUID heroId) {
        var rows = store.rows("SELECT state FROM " + section.table() + " WHERE id=? AND hero_id=? FOR UPDATE", id,
                heroId);
        if (rows.isEmpty() || "DISCARDED".equals(rows.getFirst().get("state")))
            throw new IllegalStateException("Invalid section ownership or lifecycle.");
        store.write("UPDATE " + section.table() + " SET state='PUBLISHED' WHERE id=? AND state='DRAFT'", id);
    }
    private static String str(Map<String, Object> r, String key) {
        return (String) r.get(key);
    }
    private static BigDecimal num(Map<String, Object> r, String key) {
        return (BigDecimal) r.get(key);
    }
}
