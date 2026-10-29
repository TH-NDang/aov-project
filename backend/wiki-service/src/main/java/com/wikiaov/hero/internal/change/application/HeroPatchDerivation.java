package com.wikiaov.hero.internal.change.application;

import com.wikiaov.hero.internal.application.HeroErrorCode;
import com.wikiaov.hero.internal.application.response.HeroPatchView;
import com.wikiaov.hero.internal.application.response.HeroPatchView.*;
import com.wikiaov.hero.internal.application.response.HeroRevisionView;
import com.wikiaov.hero.internal.authoring.persistence.HeroStore;
import com.wikiaov.hero.internal.change.persistence.HeroPatchHistory;
import com.wikiaov.hero.internal.change.persistence.HeroPatchHistory.Entry;
import com.wikiaov.hero.internal.change.persistence.entity.HeroChangeClassification;
import com.wikiaov.hero.internal.change.persistence.entity.RoleChangeClassification;
import com.wikiaov.hero.internal.change.persistence.entity.SkillChangeClassification;
import com.wikiaov.hero.internal.change.persistence.entity.StatChangeClassification;
import com.wikiaov.hero.internal.domain.HeroContent.Profile;
import com.wikiaov.hero.internal.domain.HeroContent.Role;
import com.wikiaov.hero.internal.domain.HeroContent.Stats;
import com.wikiaov.hero.internal.domain.HeroSection;
import com.wikiaov.hero.internal.sections.persistence.HeroSections;
import com.wikiaov.patch.GameplayContexts;
import com.wikiaov.patch.PatchVariantReference;
import com.wikiaov.platform.ApiException;
import java.util.*;
import java.util.stream.Collectors;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Derives a hero's gameplay data at a patch from the nearest published revision and the change sets (ADR-016). */
@Service
@Transactional(readOnly = true)
public class HeroPatchDerivation {
    private final HeroStore store;
    private final HeroSections sections;
    private final HeroPatchHistory history;
    private final GameplayContexts contexts;

    public HeroPatchDerivation(HeroStore store, HeroSections sections, HeroPatchHistory history,
            GameplayContexts contexts) {
        this.store = store;
        this.sections = sections;
        this.history = history;
        this.contexts = contexts;
    }

    @PreAuthorize("hasAuthority('catalog:read')")
    public HeroPatchView at(UUID heroId, UUID variantId) {
        var variant = contexts.variant(variantId);
        var revisions = store.revisions(heroId);
        if (revisions.isEmpty())
            throw new ApiException(HeroErrorCode.HERO_NOT_FOUND, "The hero does not exist.");

        Map<UUID, Long> ordinals = contexts.rulesetVariants(variant.rulesetId()).stream()
                .collect(Collectors.toMap(PatchVariantReference::id, PatchVariantReference::rulesetOrdinal));
        var anchor = anchor(revisions, variant, ordinals);
        if (anchor == null)
            return new HeroPatchView(heroId, variantId, new Anchor(Direction.NONE, null, null), List.of(), List.of(),
                    List.of(), List.of());

        var derived = new Derived(anchor.direction());
        derived.start(stats(anchor.revision()), profile(anchor.revision()));
        changeSets(heroId, anchor, variant.rulesetOrdinal(), ordinals).forEach(derived::apply);

        return derived.view(heroId, variantId, new Anchor(anchor.direction(), anchor.revision().id(),
                anchor.revision().effectiveFromPatchVariantId()));
    }

    /** Prefers the latest revision at or before the patch; otherwise the earliest one after it. */
    private static Anchoring anchor(List<HeroRevisionView> revisions, PatchVariantReference variant,
            Map<UUID, Long> ordinals) {
        long target = variant.rulesetOrdinal();
        var published = revisions.stream().filter(revision -> revision.state().equals("PUBLISHED")
                && revision.rulesetId().equals(variant.rulesetId())).toList();

        var before = published.stream().filter(revision -> ordinal(revision, ordinals) <= target)
                .max(Comparator.comparingLong((HeroRevisionView revision) -> ordinal(revision, ordinals))
                        .thenComparing(HeroRevisionView::publicationSequence));
        if (before.isPresent()) {
            long ordinal = ordinal(before.get(), ordinals);
            return new Anchoring(before.get(), ordinal == target ? Direction.EXACT : Direction.FORWARD, ordinal);
        }
        return published.stream().filter(revision -> ordinal(revision, ordinals) > target)
                .min(Comparator.comparingLong((HeroRevisionView revision) -> ordinal(revision, ordinals))
                        .thenComparing(HeroRevisionView::publicationSequence, Comparator.reverseOrder()))
                .map(revision -> new Anchoring(revision, Direction.BACKWARD, ordinal(revision, ordinals)))
                .orElse(null);
    }

    /** Change sets between the anchor and the patch, in the order their values are applied. */
    private List<Entry> changeSets(UUID heroId, Anchoring anchor, long target, Map<UUID, Long> ordinals) {
        boolean backward = anchor.direction() == Direction.BACKWARD;
        Comparator<Entry> byPatch = Comparator
                .comparingLong(entry -> ordinals.get(entry.header().getPatchVariantId()));

        return history.forHero(heroId, "vi-VN").stream().filter(entry -> {
            Long ordinal = ordinals.get(entry.header().getPatchVariantId());
            return ordinal != null && (backward
                    ? ordinal > target && ordinal <= anchor.ordinal()
                    : ordinal > anchor.ordinal() && ordinal <= target);
        }).sorted(backward ? byPatch.reversed() : byPatch).toList();
    }

    private Stats stats(HeroRevisionView revision) {
        return (Stats) sections.content(HeroSection.COMBAT_STATS, revision.sections().get(HeroSection.COMBAT_STATS));
    }

    private Profile profile(HeroRevisionView revision) {
        return (Profile) sections.content(HeroSection.PROFILE, revision.sections().get(HeroSection.PROFILE));
    }

    /** A revision without an effective patch is the baseline before every patch of the ruleset. */
    private static long ordinal(HeroRevisionView revision, Map<UUID, Long> ordinals) {
        var variant = revision.effectiveFromPatchVariantId();
        return variant == null ? 0L : ordinals.getOrDefault(variant, 0L);
    }

    private record Anchoring(
            HeroRevisionView revision,
            Direction direction,
            long ordinal
    ) {
    }

    /** Accumulates the anchor values and overwrites them with each applied change set. */
    private static final class Derived {
        private final boolean forward;
        private final Provenance carried;
        private final Map<String, StatValue> stats = new LinkedHashMap<>();
        private final Map<Role, RoleValue> roles = new EnumMap<>(Role.class);
        private final Map<String, SkillFieldValue> skillFields = new LinkedHashMap<>();
        private final List<UUID> applied = new ArrayList<>();

        Derived(Direction direction) {
            this.forward = direction != Direction.BACKWARD;
            this.carried = direction == Direction.EXACT ? Provenance.OBSERVED : Provenance.CARRIED;
        }

        void start(Stats anchorStats, Profile anchorProfile) {
            anchorStats.values().forEach(stat -> stats.put(stat.statKey(), new StatValue(stat.statKey(), stat.unit(),
                    stat.baseValue(), stat.growthPerLevel(), carried, null, null)));
            anchorProfile.roles().forEach(role -> roles.put(role, new RoleValue(role, carried, null, null)));
        }

        void apply(Entry entry) {
            UUID changeSetId = entry.header().getId();
            UUID patchVariantId = entry.header().getPatchVariantId();
            var changes = entry.changes().stream()
                    .sorted(Comparator.comparingInt(HeroChangeClassification::getSortOrder)).toList();
            for (var change : changes) {
                switch (change) {
                    case StatChangeClassification stat -> stat(stat, changeSetId, patchVariantId);
                    case RoleChangeClassification role -> role(role, changeSetId, patchVariantId);
                    case SkillChangeClassification skill -> skillFields.put(
                            skill.getSkillKey() + "\u0000" + skill.getFieldKey(),
                            new SkillFieldValue(skill.getSkillKey(), skill.getFieldKey(),
                                    forward ? skill.getNewValue() : skill.getOldValue(), Provenance.DERIVED,
                                    changeSetId, patchVariantId));
                    default -> {
                        // Visual, mechanic and other lines describe the patch but carry no gameplay value to apply.
                    }
                }
            }
            applied.add(changeSetId);
        }

        private void stat(StatChangeClassification stat, UUID changeSetId, UUID patchVariantId) {
            var value = forward ? stat.getNewValue() : stat.getOldValue();
            var previous = stats.get(stat.getStatKey());
            if (value == null)
                stats.remove(stat.getStatKey());
            else
                stats.put(stat.getStatKey(), new StatValue(stat.getStatKey(), stat.getUnitCode(), value,
                        previous == null ? null : previous.growthPerLevel(), Provenance.DERIVED, changeSetId,
                        patchVariantId));
        }

        private void role(RoleChangeClassification role, UUID changeSetId, UUID patchVariantId) {
            var code = Role.valueOf(role.getRoleCode());
            if (role.isAdded() == forward)
                roles.put(code, new RoleValue(code, Provenance.DERIVED, changeSetId, patchVariantId));
            else
                roles.remove(code);
        }

        HeroPatchView view(UUID heroId, UUID variantId, Anchor anchor) {
            return new HeroPatchView(heroId, variantId, anchor, List.copyOf(stats.values()),
                    List.copyOf(roles.values()), List.copyOf(skillFields.values()), List.copyOf(applied));
        }
    }
}
