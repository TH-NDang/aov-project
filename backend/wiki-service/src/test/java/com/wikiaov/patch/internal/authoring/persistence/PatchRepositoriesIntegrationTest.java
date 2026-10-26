package com.wikiaov.patch.internal.authoring.persistence;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.wikiaov.SeaweedFsTestConfiguration;
import com.wikiaov.TestcontainersConfiguration;
import com.wikiaov.patch.internal.authoring.persistence.entity.GamePatchTranslation;
import com.wikiaov.patch.internal.context.persistence.GameplayContextRepository;
import com.wikiaov.patch.internal.context.persistence.SeasonUpdatesRepository;
import com.wikiaov.patch.internal.release.persistence.PatchReleaseRepository;
import com.wikiaov.patch.internal.release.persistence.PatchReleaseStore;
import com.wikiaov.patch.internal.ruleset.persistence.RulesetAssignmentRepository;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;
import org.testcontainers.junit.jupiter.Testcontainers;

@SpringBootTest
@Import({TestcontainersConfiguration.class, SeaweedFsTestConfiguration.class})
@ActiveProfiles("test")
@Testcontainers(disabledWithoutDocker = true)
@Transactional
class PatchRepositoriesIntegrationTest {
    @Autowired
    JdbcClient jdbc;
    @Autowired
    GameplayContextRepository contexts;
    @Autowired
    RulesetAssignmentRepository assignments;
    @Autowired
    PatchReleaseRepository releases;
    @Autowired
    PatchVariantRepository variants;
    @Autowired
    GamePatchRepository patches;
    @Autowired
    GamePatchTranslationRepository translations;
    @Autowired
    PatchReleaseStore releaseStore;
    @Autowired
    SeasonUpdatesRepository seasonUpdates;

    private final UUID region = UUID.randomUUID();
    private final UUID ruleset = UUID.randomUUID();
    private final UUID season = UUID.randomUUID();
    private final UUID patch = UUID.randomUUID();
    private final UUID variant = UUID.randomUUID();
    private final UUID release = UUID.randomUUID();
    private final String suffix = UUID.randomUUID().toString().substring(0, 8);
    private final String regionCode = "P" + suffix.toUpperCase();
    private final Instant start = Instant.parse("2026-01-01T00:00:00Z");
    private final Instant effective = start.plusSeconds(86400);
    private final Instant end = start.plusSeconds(864000);

    @BeforeEach
    void createCalendar() {
        write("""
                insert into patch.region(id,code,display_name,product_name,default_locale,timezone,lifecycle_state,sort_order)
                values(?,?,'Fixture','AOV','vi-VN','Asia/Ho_Chi_Minh','ACTIVE',100)
                """, region, regionCode);
        write("insert into patch.gameplay_ruleset(id,code,description,lifecycle_state,created_at) values(?,?,'','ACTIVE',?)",
                ruleset, "rules-" + suffix, Timestamp.from(start));
        write("""
                insert into patch.ranked_season(id,code,display_name,ordinal)
                select ?,?,'Fixture season',coalesce(max(ordinal),0)+1 from patch.ranked_season
                """, season, "season-" + suffix);
        write("insert into patch.season_schedule(id,season_id,region_id,starts_at,ends_at) values(?,?,?,?,?)",
                UUID.randomUUID(), season, region, Timestamp.from(start), Timestamp.from(end));
        write("insert into patch.region_ruleset_assignment(id,region_id,ruleset_id,valid_from,valid_to) values(?,?,?,?,?)",
                UUID.randomUUID(), region, ruleset, Timestamp.from(start), Timestamp.from(end));
        createPatch(patch, variant, 2, season);
        write("""
                insert into patch.patch_release(id,patch_variant_id,region_id,effective_at,status,created_at,season_id)
                values(?,?,?,?,'SCHEDULED',?,?)
                """, release, variant, region, Timestamp.from(effective), Timestamp.from(start), season);
    }

    @Test
    void preservesAssignmentAndReleaseTimelineBoundaries() {
        assertThat(assignments.appliesAt(region, ruleset, start)).isTrue();
        assertThat(assignments.appliesAt(region, ruleset, start.minusNanos(1000))).isFalse();
        assertThat(assignments.appliesAt(region, ruleset, end)).isFalse();
        assertThat(releases.contradictsTimeline(region, ruleset, effective, 2)).isTrue();
        assertThat(releases.contradictsTimeline(region, ruleset, effective.plusSeconds(1), 3)).isFalse();
        assertThat(releases.contradictsTimeline(region, ruleset, effective.plusSeconds(1), 1)).isTrue();
        assertThat(releases.contradictsTimeline(region, ruleset, effective.minusSeconds(1), 3)).isTrue();
        assertThat(releases.contradictsTimeline(region, ruleset, effective.minusSeconds(1), 1)).isFalse();
        write("update patch.patch_release set status='CANCELLED' where id=?", release);
        assertThat(releases.contradictsTimeline(region, ruleset, effective, 2)).isFalse();
    }

    @Test
    void projectsEffectivePublicAndLegacyAuthoringContextsWithoutRawRowConversions() {
        assertThat(contexts.effective(regionCode, effective.minusSeconds(1), PageRequest.of(0, 1))).isEmpty();
        var context = contexts.effective(regionCode, effective, PageRequest.of(0, 1)).getFirst();
        assertThat(context.regionId()).isEqualTo(region);
        assertThat(context.rulesetId()).isEqualTo(ruleset);
        assertThat(context.patchId()).isEqualTo(patch);
        assertThat(context.patchVariantId()).isEqualTo(variant);
        assertThat(context.rulesetOrdinal()).isEqualTo(2);
        assertThat(context.effectiveAt()).isEqualTo(effective);
        assertThat(contexts.effective(regionCode, end, PageRequest.of(0, 1))).isEmpty();
        assertThat(contexts.publishedReleases(regionCode)).singleElement().satisfies(value -> {
            assertThat(value.patchId()).isEqualTo(patch);
            assertThat(value.effectiveAt()).isEqualTo(effective);
        });
        assertThat(contexts.authoringByMarket(region, season)).singleElement().satisfies(value -> {
            assertThat(value.contextId()).isEqualTo(release);
            assertThat(value.seasonId()).isEqualTo(season);
            assertThat(value.effectiveAt()).isEqualTo(effective);
        });
        assertThat(contexts.legacyAuthoringContext(release)).isEqualTo(contexts.authoringByMarket(region, season));
        assertThat(contexts.authoringBySeason(season)).singleElement().satisfies(value -> {
            assertThat(value.contextId()).isEqualTo(variant);
            assertThat(value.regionId()).isNull();
            assertThat(value.effectiveAt()).isNull();
        });
        assertThat(contexts.sharedAuthoringContext(variant)).isEqualTo(contexts.authoringBySeason(season));
    }

    @Test
    void readsFreshDatabaseOrdinalsAfterLockingEvenWhenAnEntityIsAlreadyManaged() {
        var managed = variants.findById(variant).orElseThrow();
        assertThat(managed.getRulesetOrdinal()).isEqualTo(2);
        write("update patch.patch_variant set ruleset_ordinal=4 where id=?", variant);

        var snapshot = releaseStore.readVariantAfterLockingRuleset(variant);

        assertThat(snapshot.ordinal()).isEqualTo(4);
        assertThat(managed.getRulesetOrdinal()).isEqualTo(2);
        assertThat(releaseStore.lockAndReadVariant(variant).ordinal()).isEqualTo(4);
    }

    @Test
    void shiftsUniqueOrdinalsFromTheEndAndKeepsUnseasonedVariantsInThePlacementProjection() {
        var unseasoned = UUID.randomUUID();
        createPatch(UUID.randomUUID(), unseasoned, 3, null);

        variants.makeOrdinalSpace(ruleset, 2);

        assertThat(variants.orderedSeasonVariants(ruleset)).satisfiesExactly(first -> {
            assertThat(first.id()).isEqualTo(variant);
            assertThat(first.rulesetOrdinal()).isEqualTo(3);
            assertThat(first.seasonOrdinal()).isNotNull();
        }, second -> {
            assertThat(second.id()).isEqualTo(unseasoned);
            assertThat(second.rulesetOrdinal()).isEqualTo(4);
            assertThat(second.seasonOrdinal()).isNull();
        });
    }

    @Test
    void mapsTheDatabaseSequenceAndChoosesTheSameTranslationFallbackOrder() {
        assertThat(patches.findById(patch).orElseThrow().getSequence()).isPositive();
        translations.saveAndFlush(new GamePatchTranslation(patch, "en-US", "English", "", null));
        translations.saveAndFlush(new GamePatchTranslation(patch, "vi-VN", "Vietnamese", "", null));
        translations.saveAndFlush(new GamePatchTranslation(patch, "de-DE", "German", "", null));

        assertThat(translations.preferred(patch, "en-US", PageRequest.of(0, 1))).singleElement()
                .extracting(GamePatchTranslation::getLocale).isEqualTo("en-US");
        assertThat(translations.preferred(patch, "fr-FR", PageRequest.of(0, 1))).singleElement()
                .extracting(GamePatchTranslation::getLocale).isEqualTo("vi-VN");
    }

    @Test
    void retainsInsertOnlyTranslationSemanticsInsteadOfSilentlyReplacingDuplicateLocales() {
        write("insert into patch.game_patch_translation(patch_id,locale,title,summary) values(?,'vi-VN','Original','')",
                patch);

        assertThatThrownBy(() -> translations.saveAndFlush(
                new GamePatchTranslation(patch, "vi-VN", "Replacement", "", null)))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void seasonUpdatesOnlyIncludeEffectivePublishedReleasesOfTheSelectedMarketRulesetAndSeason() {
        var now = effective.plusSeconds(60);
        var futureVariant = createRelease(3, season, effective.plusSeconds(100), "SCHEDULED");
        var draftVariant = createRelease(4, season, effective.plusSeconds(1), "SCHEDULED");
        write("update patch.patch_variant set status='DRAFT',published_at=null where id=?", draftVariant);
        var unpublishedPatchVariant = createRelease(5, season, effective.plusSeconds(2), "SCHEDULED");
        write("update patch.game_patch set status='DRAFT' where id=(select patch_id from patch.patch_variant where id=?)",
                unpublishedPatchVariant);
        createRelease(6, season, effective.plusSeconds(3), "CANCELLED");
        write("""
                insert into patch.patch_release(id,patch_variant_id,region_id,effective_at,status,created_at,season_id)
                select ?,?,id,?,'SCHEDULED',?,? from patch.region where code='VN'
                """, UUID.randomUUID(), variant, Timestamp.from(effective.plusSeconds(4)), Timestamp.from(start),
                season);
        var otherRuleset = UUID.randomUUID();
        write("insert into patch.gameplay_ruleset(id,code,description,lifecycle_state,created_at) values(?,?,'','ACTIVE',?)",
                otherRuleset, "other-rules-" + suffix, Timestamp.from(start));
        var otherRulesetVariant = createRelease(7, season, effective.plusSeconds(5), "SCHEDULED");
        write("update patch.patch_variant set ruleset_id=? where id=?", otherRuleset, otherRulesetVariant);
        var otherSeason = UUID.randomUUID();
        write("""
                insert into patch.ranked_season(id,code,display_name,ordinal)
                select ?,?,'Other season',coalesce(max(ordinal),0)+1 from patch.ranked_season
                """, otherSeason, "other-season-" + suffix);
        createRelease(8, otherSeason, effective.plusSeconds(6), "SCHEDULED");

        assertThat(seasonUpdates.publishedReleases(region, ruleset, season, now, PageRequest.of(0, 10)))
                .singleElement().satisfies(value -> assertThat(value.getId()).isEqualTo(patch));
        assertThat(seasonUpdates.currentSeason(region, variant, now, PageRequest.of(0, 1))).singleElement()
                .satisfies(value -> assertThat(value.getId()).isEqualTo(season));
        assertThat(seasonUpdates.currentSeason(region, futureVariant, now, PageRequest.of(0, 1))).isEmpty();

        write("update patch.patch_release set season_id=null where id=?", release);
        assertThat(seasonUpdates.currentSeason(region, variant, now, PageRequest.of(0, 1))).singleElement()
                .satisfies(value -> assertThat(value.getId()).isEqualTo(season));
        write("update patch.patch_variant set season_id=? where id=?", otherSeason, variant);
        write("update patch.patch_release set season_id=? where id=?", season, release);
        assertThat(seasonUpdates.currentSeason(region, variant, now, PageRequest.of(0, 1))).singleElement()
                .satisfies(value -> assertThat(value.getId()).isEqualTo(season));
    }

    @Test
    void seasonUpdatesReadTranslationCandidatesInOneDeterministicBatch() {
        write("insert into patch.game_patch_translation(patch_id,locale,title,summary) values(?,'vi-VN','Local','')",
                patch);
        write("insert into patch.game_patch_translation(patch_id,locale,title,summary) values(?,'en-US','English','')",
                patch);

        assertThat(seasonUpdates.preferredTexts(java.util.List.of(patch), "en-US"))
                .extracting(SeasonUpdatesRepository.Text::getLocale).containsExactly("en-US", "vi-VN");
        assertThat(seasonUpdates.preferredTexts(java.util.List.of(patch), "fr-FR"))
                .extracting(SeasonUpdatesRepository.Text::getLocale).containsExactly("vi-VN", "en-US");
    }

    @Test
    void catalogScopesOnlyOfferPublishedPastVariantsInTheVerifiedRulesetAndSeason() {
        var now = effective.plusSeconds(10);
        var oldSeason = UUID.randomUUID();
        write("""
                insert into patch.ranked_season(id,code,display_name,ordinal)
                select ?,?,'Observed season',coalesce(max(ordinal),0)+1 from patch.ranked_season
                """, oldSeason, "observed-" + suffix);
        var observedPatch = UUID.randomUUID();
        var observedVariant = UUID.randomUUID();
        createPatch(observedPatch, observedVariant, 1, oldSeason);
        var laterOrdinal = UUID.randomUUID();
        createPatch(UUID.randomUUID(), laterOrdinal, 3, season);
        var draft = UUID.randomUUID();
        createPatch(UUID.randomUUID(), draft, 4, season);
        write("update patch.patch_variant set status='DRAFT',published_at=null where id=?", draft);
        var futurePublication = UUID.randomUUID();
        createPatch(UUID.randomUUID(), futurePublication, 5, season);
        write("update patch.patch_variant set published_at=? where id=?", Timestamp.from(now.plusSeconds(60)),
                futurePublication);
        var draftPatch = UUID.randomUUID();
        createPatch(draftPatch, UUID.randomUUID(), 6, season);
        write("update patch.game_patch set status='DRAFT' where id=?", draftPatch);
        var otherRuleset = UUID.randomUUID();
        write("insert into patch.gameplay_ruleset(id,code,description,lifecycle_state,created_at) values(?,?,'','ACTIVE',?)",
                otherRuleset, "other-catalog-" + suffix, Timestamp.from(start));
        var foreignVariant = UUID.randomUUID();
        createPatch(UUID.randomUUID(), foreignVariant, 7, season);
        write("update patch.patch_variant set ruleset_id=? where id=?", otherRuleset, foreignVariant);

        assertThat(contexts.catalogPatches(ruleset, now, 2, null, null, Pageable.unpaged()))
                .extracting(GameplayContextRepository.CatalogPatch::getId).containsExactly(variant, observedVariant);
        assertThat(contexts.catalogPatches(ruleset, now, 7, null, null, Pageable.unpaged()))
                .extracting(GameplayContextRepository.CatalogPatch::getId)
                .containsExactly(laterOrdinal, variant, observedVariant);
        assertThat(contexts.catalogPatches(ruleset, now, 2, oldSeason, null, PageRequest.of(0, 1)))
                .singleElement().satisfies(value -> {
                    assertThat(value.getId()).isEqualTo(observedVariant);
                    assertThat(value.getSeasonCode()).isEqualTo("observed-" + suffix);
                    assertThat(value.getSeasonName()).isEqualTo("Observed season");
                });
        assertThat(contexts.catalogPatches(ruleset, now, 2, season, observedVariant, Pageable.unpaged())).isEmpty();
        assertThat(contexts.catalogPatches(ruleset, now, 2, oldSeason, observedVariant, Pageable.unpaged()))
                .singleElement().satisfies(value -> assertThat(value.getPatchId()).isEqualTo(observedPatch));
    }

    @Test
    void catalogDatesKeepOnlyVerifiedPastReleasesForTheRequestedMarket() {
        var now = effective.plusSeconds(10);
        var cancelled = createRelease(3, season, effective.plusSeconds(1), "CANCELLED");
        var future = createRelease(4, season, now.plusSeconds(60), "SCHEDULED");
        var undated = UUID.randomUUID();
        createPatch(UUID.randomUUID(), undated, 1, season);
        var day = java.time.LocalDate.of(2026, 1, 2);
        write("update patch.patch_release set effective_on=?,confirmed_at=effective_at where id=?", day, release);
        write("""
                insert into patch.patch_release(id,patch_variant_id,region_id,effective_at,status,created_at,season_id)
                select ?,?,id,?,'SCHEDULED',?,? from patch.region where code='VN'
                """, UUID.randomUUID(), variant, Timestamp.from(now), Timestamp.from(start), season);

        assertThat(contexts.catalogDates(region, java.util.List.of(variant, cancelled, future, undated), now))
                .singleElement().satisfies(value -> {
                    assertThat(value.getPatchVariantId()).isEqualTo(variant);
                    assertThat(value.getEffectiveOn()).isEqualTo(day);
                    assertThat(value.getEffectiveAt()).isEqualTo(effective);
                });
    }

    private UUID createRelease(long ordinal, UUID seasonId, Instant at, String status) {
        var patchId = UUID.randomUUID();
        var variantId = UUID.randomUUID();
        createPatch(patchId, variantId, ordinal, seasonId);
        write("""
                insert into patch.patch_release(id,patch_variant_id,region_id,effective_at,status,created_at,season_id)
                values(?,?,?,?,?,?,?)
                """, UUID.randomUUID(), variantId, region, Timestamp.from(at), status, Timestamp.from(start), seasonId);
        return variantId;
    }

    private void createPatch(UUID patchId, UUID variantId, long ordinal, UUID seasonId) {
        write("""
                insert into patch.game_patch(id,code,status,created_at,created_by_issuer,created_by_subject)
                values(?,?,'PUBLISHED',?,'fixture','editor')
                """, patchId, "patch-" + patchId, Timestamp.from(start));
        write("""
                insert into patch.patch_variant(id,patch_id,ruleset_id,variant_code,ruleset_ordinal,status,
                    published_at,created_at,season_id) values(?,?,?,? ,?,'PUBLISHED',?,?,?)
                """, variantId, patchId, ruleset, "variant-" + variantId, ordinal, Timestamp.from(start),
                Timestamp.from(start), seasonId);
    }

    private void write(String sql, Object... arguments) {
        jdbc.sql(sql).params(arguments).update();
    }
}
