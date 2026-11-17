package com.wikiaov.hero.internal.catalog.application;

import com.wikiaov.hero.internal.application.response.HeroPublishReadinessView;
import com.wikiaov.hero.internal.application.response.HeroPublishReadinessView.Draft;
import com.wikiaov.hero.internal.application.response.HeroPublishReadinessView.DraftMedia;
import com.wikiaov.hero.internal.application.response.HeroPublishReadinessView.DraftProfile;
import com.wikiaov.hero.internal.application.response.HeroPublishReadinessView.DraftRatings;
import com.wikiaov.hero.internal.application.response.HeroPublishReadinessView.DraftSkill;
import com.wikiaov.hero.internal.application.response.HeroPublishReadinessView.DraftSkillText;
import com.wikiaov.hero.internal.application.response.HeroPublishReadinessView.DraftSkills;
import com.wikiaov.hero.internal.application.response.HeroPublishReadinessView.DraftStats;
import com.wikiaov.hero.internal.application.response.HeroPublishReadinessView.Name;
import com.wikiaov.hero.internal.application.response.HeroRevisionView;
import com.wikiaov.hero.internal.authoring.persistence.HeroStore;
import com.wikiaov.hero.internal.authoring.persistence.entity.HeroIdentity;
import com.wikiaov.hero.internal.domain.HeroContent.Bindings;
import com.wikiaov.hero.internal.domain.HeroContent.MediaRole;
import com.wikiaov.hero.internal.domain.HeroContent.Profile;
import com.wikiaov.hero.internal.domain.HeroContent.Ratings;
import com.wikiaov.hero.internal.domain.HeroContent.Skill;
import com.wikiaov.hero.internal.domain.HeroContent.Skills;
import com.wikiaov.hero.internal.domain.HeroContent.Stat;
import com.wikiaov.hero.internal.domain.HeroContent.Stats;
import com.wikiaov.hero.internal.domain.HeroSection;
import com.wikiaov.hero.internal.forms.application.HeroForms;
import com.wikiaov.hero.internal.forms.domain.HeroFormStructure;
import com.wikiaov.hero.internal.media.persistence.HeroMediaSnapshots;
import com.wikiaov.hero.internal.profile.persistence.HeroProfileSnapshots;
import com.wikiaov.hero.internal.ratings.persistence.HeroRatingSnapshots;
import com.wikiaov.hero.internal.skills.persistence.HeroSkillSnapshots;
import com.wikiaov.hero.internal.stats.domain.HeroStatObservations;
import com.wikiaov.hero.internal.stats.persistence.HeroStatSnapshots;
import com.wikiaov.media.MediaAssetReference;
import com.wikiaov.media.MediaAssets;
import com.wikiaov.patch.GameplayContexts;
import com.wikiaov.platform.RevisionState;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import java.util.stream.Collectors;
import java.util.stream.Stream;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Reads every hero's publication state in a bounded number of queries, whatever the number of heroes. */
@Service
@Transactional(readOnly = true)
@RequiredArgsConstructor
public class HeroPublishReadiness {
    private final HeroStore store;
    private final HeroProfileSnapshots profiles;
    private final HeroRatingSnapshots ratings;
    private final HeroStatSnapshots stats;
    private final HeroSkillSnapshots skills;
    private final HeroMediaSnapshots media;
    private final MediaAssets assets;
    private final GameplayContexts contexts;
    private final HeroForms forms;

    @PreAuthorize("hasAuthority('catalog:read')")
    public List<HeroPublishReadinessView> list() {
        var heroes = store.heroes(false);
        if (heroes.isEmpty())
            return List.of();

        // The store orders each hero's revisions from newest to oldest; the newest one names the hero in the list.
        var revisions = store.revisions(heroes.stream().map(HeroIdentity::getId).toList()).stream()
                .filter(revision -> revision.state() != RevisionState.DISCARDED)
                .collect(Collectors.groupingBy(HeroRevisionView::heroId));
        var drafts = revisions.values().stream().flatMap(List::stream).filter(HeroPublishReadiness::isDraft).toList();
        var newest = revisions.values().stream().map(List::getFirst).toList();
        var identified = Stream.concat(drafts.stream(), newest.stream()).toList();

        var content = new Sections(profiles.contents(sectionIds(identified, HeroSection.PROFILE)),
                ratings.contents(sectionIds(drafts, HeroSection.OVERVIEW_RATINGS)),
                stats.contents(sectionIds(drafts, HeroSection.COMBAT_STATS)),
                skills.contents(sectionIds(drafts, HeroSection.SKILLS)),
                media.contents(sectionIds(identified, HeroSection.MEDIA_BINDINGS)));
        var heads = assets.findAll(newest.stream().map(revision -> headAsset(revision, content))
                .filter(Objects::nonNull).collect(Collectors.toSet()));
        Map<UUID, String> patchCodes = new HashMap<>();
        var structure = forms.structure();

        return heroes.stream().map(hero -> {
            var rows = revisions.getOrDefault(hero.getId(), List.of());
            var identity = rows.isEmpty() ? null : rows.getFirst();
            var form = structure.form(hero.getId());
            return new HeroPublishReadinessView(hero.getId(), hero.getCode(), names(identity, content),
                    headUrl(identity, content, heads), rows,
                    rows.stream().filter(HeroPublishReadiness::isDraft)
                            .map(draft -> draft(draft, content, patchCodes)).toList(),
                    form.map(HeroFormStructure.Form::holderId).orElse(null),
                    form.map(HeroFormStructure.Form::formKey).orElse(null),
                    structure.formsOf(hero.getId()).stream().map(HeroFormStructure.Form::heroId).toList());
        }).toList();
    }

    private Draft draft(HeroRevisionView draft, Sections content, Map<UUID, String> patchCodes) {
        var sections = draft.sections();
        var profile = content.profiles().get(sections.get(HeroSection.PROFILE));
        var rating = content.ratings().get(sections.get(HeroSection.OVERVIEW_RATINGS));
        var stat = content.stats().get(sections.get(HeroSection.COMBAT_STATS));
        var skill = content.skills().get(sections.get(HeroSection.SKILLS));
        var bindings = content.bindings().get(sections.get(HeroSection.MEDIA_BINDINGS));

        return new Draft(draft.id(), hasObservedStats(draft, skill, patchCodes),
                sections.containsKey(HeroSection.SKINS),
                profile == null ? null : new DraftProfile(names(profile), profile.roles()),
                rating == null
                        ? null
                        : new DraftRatings(rating.scaleCode(), rating.survivability(), rating.attackDamage(),
                                rating.skillEffects(), rating.difficulty()),
                stat == null ? null : new DraftStats(stat.values().stream().map(Stat::statKey).toList()),
                skill == null
                        ? null
                        : new DraftSkills(skill.skills().stream().map(HeroPublishReadiness::skill).toList()),
                bindings == null ? null : new DraftMedia(bindings.bindings()));
    }

    private boolean hasObservedStats(HeroRevisionView draft, Skills skill, Map<UUID, String> patchCodes) {
        var patch = draft.effectiveFromPatchVariantId();
        return patch != null
                && HeroStatObservations.hasReadings(skill, patchCodes.computeIfAbsent(patch, contexts::patchCode));
    }

    private static DraftSkill skill(Skill skill) {
        return new DraftSkill(skill.skillKey(), skill.translations().stream()
                .map(text -> new DraftSkillText(text.locale(), text.name(), text.description())).toList());
    }

    private static boolean isDraft(HeroRevisionView revision) {
        return revision.state() == RevisionState.DRAFT;
    }

    private static List<UUID> sectionIds(List<HeroRevisionView> revisions, HeroSection section) {
        return revisions.stream().map(revision -> revision.sections().get(section)).filter(Objects::nonNull).distinct()
                .toList();
    }

    private static List<Name> names(HeroRevisionView revision, Sections content) {
        return revision == null
                ? List.of()
                : names(content.profiles().get(revision.sections().get(HeroSection.PROFILE)));
    }

    private static List<Name> names(Profile profile) {
        return profile == null
                ? List.of()
                : profile.translations().stream().map(text -> new Name(text.locale(), text.name())).toList();
    }

    private static UUID headAsset(HeroRevisionView revision, Sections content) {
        var bindings = content.bindings().get(revision.sections().get(HeroSection.MEDIA_BINDINGS));
        return bindings == null ? null : bindings.bindings().get(MediaRole.HEAD);
    }

    private static String headUrl(HeroRevisionView revision, Sections content, Map<UUID, MediaAssetReference> heads) {
        var assetId = revision == null ? null : headAsset(revision, content);
        var head = assetId == null ? null : heads.get(assetId);
        return head != null && head.usable() ? head.currentVersion().url() : null;
    }

    private record Sections(
            Map<UUID, Profile> profiles,
            Map<UUID, Ratings> ratings,
            Map<UUID, Stats> stats,
            Map<UUID, Skills> skills,
            Map<UUID, Bindings> bindings
    ) {
    }
}
