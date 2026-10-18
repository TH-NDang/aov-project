package com.wikiaov.hero.internal.application.service;

import com.wikiaov.access.*;
import com.wikiaov.hero.HeroChangeQueries;
import com.wikiaov.hero.internal.application.HeroErrorCode;
import com.wikiaov.hero.internal.domain.HeroChanges.*;
import com.wikiaov.hero.internal.domain.HeroContent.*;
import com.wikiaov.hero.internal.domain.HeroContent.Cause;
import com.wikiaov.hero.internal.domain.HeroSection;
import com.wikiaov.hero.internal.persistence.HeroSections;
import com.wikiaov.hero.internal.persistence.HeroStore;
import com.wikiaov.patch.GameplayContexts;
import com.wikiaov.patch.PatchCatalog;
import com.wikiaov.platform.ApiException;
import com.wikiaov.platform.PageSlice;
import java.time.Clock;
import java.util.*;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class HeroPatchChanges implements HeroChangeQueries {
    private final HeroStore store;
    private final PatchCatalog patches;
    private final HeroSections sections;
    private final GameplayContexts contexts;
    private final AuditLog audit;
    private final CurrentActor actors;
    private final Clock clock;
    public HeroPatchChanges(HeroStore store, GameplayContexts contexts, AuditLog audit, CurrentActor actors,
            Clock clock, PatchCatalog patches, HeroSections sections) {
        this.patches = patches;
        this.sections = sections;
        this.store = store;
        this.contexts = contexts;
        this.audit = audit;
        this.actors = actors;
        this.clock = clock;
    }

    @Transactional
    @PreAuthorize("hasAuthority('patch:write')")
    public UUID record(UUID variantId, com.wikiaov.hero.internal.domain.HeroChanges.Record input) {
        store.lockHero(input.heroId());
        var variant = contexts.variant(variantId);
        var to = store.revision(input.heroId(), input.toHeroRevisionId());
        if (!to.state().equals("PUBLISHED") || to.cause() != Cause.GAME_PATCH
                || !to.rulesetId().equals(variant.rulesetId()) || !variantId.equals(to.effectiveFromPatchVariantId()))
            throw HeroValidation
                    .invalid("The target must be a published GAME_PATCH revision for this variant and ruleset.");
        if (input.fromHeroRevisionId() != null) {
            var from = store.revision(input.heroId(), input.fromHeroRevisionId());
            if (!from.state().equals("PUBLISHED") || !from.rulesetId().equals(to.rulesetId())
                    || from.publicationSequence() >= to.publicationSequence())
                throw HeroValidation.invalid("The source revision must precede the target in the same ruleset.");
            if (from.effectiveFromPatchVariantId() != null && contexts.variant(from.effectiveFromPatchVariantId())
                    .rulesetOrdinal() >= variant.rulesetOrdinal())
                throw HeroValidation.invalid("The source must precede this gameplay patch.");
        }
        Set<String> locales = new HashSet<>();
        for (var t : input.summaryTranslations()) {
            HeroValidation.locale(t.locale());
            if (!locales.add(t.locale()))
                throw HeroValidation.invalid("Summary locales must be unique.");
        }
        UUID id = UUID.randomUUID();
        var actor = actors.require();
        try {
            store.write("INSERT INTO hero.hero_patch_change_set VALUES(?,?,?,?,?,?,?,?)", id, variantId, input.heroId(),
                    input.fromHeroRevisionId(), input.toHeroRevisionId(), HeroStore.time(clock.instant()),
                    actor.issuer(), actor.subject());
        } catch (DataIntegrityViolationException e) {
            throw new ApiException(HeroErrorCode.HERO_PATCH_CHANGE_CONFLICT,
                    "A change set already exists for this hero and variant.");
        }
        for (var t : input.summaryTranslations())
            store.write("INSERT INTO hero.hero_patch_change_translation VALUES(?,?,?)", id, t.locale(), t.summary());
        int order = 0;
        for (var change : input.changes()) {
            UUID item = UUID.randomUUID();
            String kind = change.changeKind().name();
            int n = order++;
            validateChange(change, input);
            switch (change) {
                case StatChange v -> {
                    if (Objects.equals(v.oldValue(), v.newValue()))
                        throw HeroValidation.invalid("A stat change must change the value.");
                    store.write("INSERT INTO hero.hero_stat_change VALUES(?,?,?,?,?,?,?,?)", item, id, kind, n,
                            v.statKey(), v.oldValue(), v.newValue(), v.unit());
                }
                case SkillChange v -> store.write("INSERT INTO hero.hero_skill_change VALUES(?,?,?,?,?,?,?,?)", item,
                        id, kind, n, v.skillKey(), v.fieldKey(), v.oldValue(), v.newValue());
                case RoleChange v -> store.write("INSERT INTO hero.hero_role_change VALUES(?,?,?,?,?,?)", item, id,
                        kind, n, v.roleCode().name(), v.added());
                case VisualChange v -> store.write("INSERT INTO hero.hero_visual_change VALUES(?,?,?,?,?,?,?)", item,
                        id, kind, n, v.mediaRole().name(), v.oldAssetId(), v.newAssetId());
                case MechanicChange v -> store.write("INSERT INTO hero.hero_mechanic_change VALUES(?,?,?,?,?,?)", item,
                        id, kind, n, v.mechanicKey(), v.description());
                case OtherChange v -> store.write("INSERT INTO hero.hero_other_change VALUES(?,?,?,?,?)", item, id,
                        kind, n, v.description());
            }
        }
        audit.record(new AuditEntry(actor, "HERO_PATCH_CHANGE_RECORDED", "HERO", input.heroId(), to.id(), null, null,
                null, Map.of("changeSetId", id)));
        return id;
    }

    @PreAuthorize("hasAuthority('catalog:read')")
    public List<Map<String, Object>> forAuthoringVariant(UUID variantId, String locale) {
        HeroValidation.locale(locale);
        contexts.variant(variantId);
        return load("patch_variant_id", variantId, locale);
    }

    public List<Map<String, Object>> forVariant(UUID variantId, String locale) {
        HeroValidation.locale(locale);
        if (!contexts.variant(variantId).published())
            return List.of();
        return load("patch_variant_id", variantId, locale);
    }

    public PageSlice<Map<String, Object>> forHero(UUID heroId, String region, String locale, int page, int size) {
        HeroValidation.locale(locale);
        if (page < 0 || size < 1 || size > 100)
            throw HeroValidation.invalid("Invalid page bounds.");
        var variants = patches.releases(region).stream().filter(r -> !r.effectiveAt().isAfter(clock.instant()))
                .collect(java.util.stream.Collectors.toMap(com.wikiaov.patch.PatchReleaseReference::variantId, r -> r,
                        (a, b) -> a));
        var all = load("hero_id", heroId, locale).stream()
                .filter(row -> variants.containsKey((UUID) row.get("patchVariantId"))).peek(row -> {
                    var release = variants.get((UUID) row.get("patchVariantId"));
                    row.put("patch", patches.published(release.patchId(), region, locale));
                }).toList();
        return new PageSlice<>(all.stream().skip((long) page * size).limit(size).toList(), page, size, all.size());
    }

    private void validateChange(Change change, com.wikiaov.hero.internal.domain.HeroChanges.Record input) {
        var to = store.revision(input.heroId(), input.toHeroRevisionId());
        var from = input.fromHeroRevisionId() == null
                ? null
                : store.revision(input.heroId(), input.fromHeroRevisionId());
        if (change instanceof StatChange v) {
            var newStats = (Stats) sections.content(HeroSection.COMBAT_STATS,
                    to.sections().get(HeroSection.COMBAT_STATS));
            var oldStats = from == null
                    ? new Stats(List.of(), List.of())
                    : (Stats) sections.content(HeroSection.COMBAT_STATS, from.sections().get(HeroSection.COMBAT_STATS));
            var newer = newStats.values().stream().filter(stat -> stat.statKey().equals(v.statKey())).findFirst();
            var older = oldStats.values().stream().filter(stat -> stat.statKey().equals(v.statKey())).findFirst();
            java.math.BigDecimal newValue = newer.map(Stat::baseValue).orElse(null),
                    oldValue = older.map(Stat::baseValue).orElse(null);
            if (!sameNumber(newValue, v.newValue()) || !sameNumber(oldValue, v.oldValue())
                    || newer.isPresent() && !newer.get().unit().equals(v.unit()))
                throw HeroValidation.invalid("Stat changes must match the source and target snapshots.");
        }
        if (change instanceof SkillChange v) {
            var skills = (Skills) sections.content(HeroSection.SKILLS, to.sections().get(HeroSection.SKILLS));
            if (skills.skills().stream().noneMatch(skill -> skill.skillKey().equals(v.skillKey())))
                throw HeroValidation.invalid("The skill key does not belong to the target snapshot.");
            if (Objects.equals(v.oldValue(), v.newValue()))
                throw HeroValidation.invalid("A skill change must change a value.");
        }
        if (change instanceof RoleChange v) {
            var newer = (Profile) sections.content(HeroSection.PROFILE, to.sections().get(HeroSection.PROFILE));
            var older = from == null
                    ? new Profile(List.of(), Set.of(), List.of())
                    : (Profile) sections.content(HeroSection.PROFILE, from.sections().get(HeroSection.PROFILE));
            if (newer.roles().contains(v.roleCode()) != v.added() || older.roles().contains(v.roleCode()) == v.added())
                throw HeroValidation.invalid("Role changes must match the snapshots.");
        }
        if (change instanceof VisualChange v) {
            var newer = (Bindings) sections.content(HeroSection.MEDIA_BINDINGS,
                    to.sections().get(HeroSection.MEDIA_BINDINGS));
            var older = from == null
                    ? new Bindings(Map.of(), List.of())
                    : (Bindings) sections.content(HeroSection.MEDIA_BINDINGS,
                            from.sections().get(HeroSection.MEDIA_BINDINGS));
            if (!Objects.equals(newer.bindings().get(v.mediaRole()), v.newAssetId())
                    || !Objects.equals(older.bindings().get(v.mediaRole()), v.oldAssetId())
                    || Objects.equals(v.oldAssetId(), v.newAssetId()))
                throw HeroValidation.invalid("Visual changes must match the snapshots.");
        }
    }

    private static boolean sameNumber(java.math.BigDecimal a, java.math.BigDecimal b) {
        return a == null ? b == null : b != null && a.compareTo(b) == 0;
    }

    private List<Map<String, Object>> load(String column, UUID id, String locale) {
        return store
                .rows("SELECT * FROM hero.hero_patch_change_set WHERE " + column + "=? ORDER BY created_at DESC,id", id)
                .stream().map(row -> {
                    Map<String, Object> result = new LinkedHashMap<>();
                    result.put("id", row.get("id"));
                    result.put("heroId", row.get("hero_id"));
                    result.put("heroCode", store.rows("SELECT code FROM hero.hero WHERE id=?", row.get("hero_id"))
                            .getFirst().get("code"));

                    result.put("patchVariantId", row.get("patch_variant_id"));
                    result.put("fromHeroRevisionId", row.get("from_hero_revision_id"));
                    result.put("toHeroRevisionId", row.get("to_hero_revision_id"));
                    var translations = store.rows(
                            "SELECT locale,summary FROM hero.hero_patch_change_translation WHERE change_set_id=? ORDER BY (locale=?) DESC,(locale='vi-VN') DESC,locale LIMIT 1",
                            row.get("id"), locale);
                    if (!translations.isEmpty()) {
                        result.put("actualLocale", translations.getFirst().get("locale"));
                        result.put("summary", translations.getFirst().get("summary"));
                    }
                    List<Map<String, Object>> items = new ArrayList<>();
                    for (String type : List.of("stat", "skill", "role", "visual", "mechanic", "other"))
                        for (var item : store.rows(
                                "SELECT * FROM hero.hero_" + type + "_change WHERE change_set_id=? ORDER BY sort_order",
                                row.get("id"))) {
                            Map<String, Object> value = new LinkedHashMap<>();
                            value.put("type", "HERO_" + type.toUpperCase(Locale.ROOT) + "_CHANGE");
                            item.forEach((key, v) -> {
                                if (!key.equals("change_set_id"))
                                    value.put(camel(key), v);
                            });
                            items.add(value);
                        }
                    items.sort(Comparator.comparingInt(v -> ((Number) v.get("sortOrder")).intValue()));
                    result.put("changes", items);
                    return result;
                }).toList();
    }

    private static String camel(String key) {
        var words = key.split("_");
        StringBuilder s = new StringBuilder(words[0]);
        for (int n = 1; n < words.length; n++)
            s.append(Character.toUpperCase(words[n].charAt(0))).append(words[n].substring(1));
        return s.toString();
    }
}
