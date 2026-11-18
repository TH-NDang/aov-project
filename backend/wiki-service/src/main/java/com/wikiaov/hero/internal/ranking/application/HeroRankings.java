package com.wikiaov.hero.internal.ranking.application;

import static com.wikiaov.hero.internal.ranking.application.RankingSnapshotRules.blankToNull;
import static com.wikiaov.hero.internal.ranking.application.RankingSnapshotRules.invalid;

import com.wikiaov.access.AuditEntry;
import com.wikiaov.access.AuditLog;
import com.wikiaov.access.CurrentActor;
import com.wikiaov.hero.internal.application.HeroErrorCode;
import com.wikiaov.hero.internal.application.HeroRankingCommands.ConfirmSnapshot;
import com.wikiaov.hero.internal.application.HeroRankingCommands.ImportSnapshot;
import com.wikiaov.hero.internal.application.HeroRankingCommands.ReviewValue;
import com.wikiaov.hero.internal.application.response.HeroRankingViews;
import com.wikiaov.hero.internal.application.response.HeroRankingViews.Detail;
import com.wikiaov.hero.internal.application.response.HeroRankingViews.Summary;
import com.wikiaov.hero.internal.authoring.persistence.HeroIdentityRepository;
import com.wikiaov.hero.internal.authoring.persistence.entity.HeroIdentity;
import com.wikiaov.hero.internal.ranking.domain.RankingMetric;
import com.wikiaov.hero.internal.ranking.persistence.RankingSnapshotHeroRepository;
import com.wikiaov.hero.internal.ranking.persistence.RankingSnapshotImageRepository;
import com.wikiaov.hero.internal.ranking.persistence.RankingSnapshotRepository;
import com.wikiaov.hero.internal.ranking.persistence.RankingSnapshotValueRepository;
import com.wikiaov.hero.internal.ranking.persistence.entity.RankingSnapshotRow;
import com.wikiaov.hero.internal.ranking.persistence.entity.RankingSnapshotValueRow;
import com.wikiaov.platform.ApiException;
import com.wikiaov.platform.PageSlice;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.TreeSet;
import java.util.UUID;
import java.util.stream.Collectors;
import org.jspecify.annotations.Nullable;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Snapshots of the game's hero ranking boards read from screenshots (ADR-025): import, review of single values, sign-off
 * of a whole snapshot and removal of one imported by mistake. Writes lock the snapshot row so the count of values
 * waiting for review cannot move under a confirmation. The checks live in {@link RankingSnapshotRules}, the rows in
 * {@link RankingSnapshotRows} and the editor views in {@link RankingSnapshotViews}; readers use
 * {@link PublishedHeroRankings}.
 */
@Service
public class HeroRankings {
    private static final Sort LIST_ORDER = Sort.by(Sort.Order.desc("capturedAt"), Sort.Order.asc("id"));
    private static final String AGGREGATE = "HERO_RANKING_SNAPSHOT";

    private final RankingSnapshotRepository snapshots;
    private final RankingSnapshotImageRepository images;
    private final RankingSnapshotHeroRepository entries;
    private final RankingSnapshotValueRepository values;
    private final HeroIdentityRepository heroes;
    private final RankingSnapshotViews views;
    private final CurrentActor actors;
    private final AuditLog audit;
    private final Clock clock;

    public HeroRankings(RankingSnapshotRepository snapshots, RankingSnapshotImageRepository images,
            RankingSnapshotHeroRepository entries, RankingSnapshotValueRepository values,
            HeroIdentityRepository heroes, RankingSnapshotViews views, CurrentActor actors, AuditLog audit,
            Clock clock) {
        this.snapshots = snapshots;
        this.images = images;
        this.entries = entries;
        this.values = values;
        this.heroes = heroes;
        this.views = views;
        this.actors = actors;
        this.audit = audit;
        this.clock = clock;
    }

    @PreAuthorize("hasAuthority('catalog:read')")
    @Transactional(readOnly = true)
    public PageSlice<Summary> list(String region, String mode, int page, int size) {
        var result = snapshots.findAll(RankingSnapshotRepository.matching(region, mode),
                PageRequest.of(page, size, LIST_ORDER));
        var counts = views.counts(result.getContent().stream().map(RankingSnapshotRow::getId).toList());

        return new PageSlice<>(result.getContent().stream()
                .map(row -> RankingSnapshotViews.summary(row, counts.get(row.getId()))).toList(),
                page, size, result.getTotalElements());
    }

    @PreAuthorize("hasAuthority('catalog:read')")
    @Transactional(readOnly = true)
    public Detail detail(UUID snapshotId) {
        return views.detail(snapshots.findById(snapshotId).orElseThrow(HeroRankings::snapshotNotFound));
    }

    @PreAuthorize("hasAuthority('hero:write')")
    @Transactional
    public Detail importSnapshot(ImportSnapshot request) {
        RankingSnapshotRules.validateSnapshot(request);
        var imageSizes = RankingSnapshotRules.validateImages(request.images());
        var heroIds = resolveHeroes(request);
        RankingSnapshotRules.validateHeroes(request, heroIds, imageSizes);
        if (snapshots.existsByCode(request.code())) {
            throw snapshotExists(request.code());
        }

        var actor = actors.require();
        var now = clock.instant();
        var snapshot = RankingSnapshotRows.snapshotRow(request, actor, now);
        try {
            snapshots.saveAndFlush(snapshot);
        } catch (DataIntegrityViolationException e) {
            throw snapshotExists(request.code());
        }
        images.saveAll(request.images().stream()
                .map(image -> RankingSnapshotRows.imageRow(snapshot.getId(), image)).toList());
        entries.saveAll(request.heroes().stream()
                .map(hero -> RankingSnapshotRows.entryRow(snapshot.getId(), heroIds.get(hero.heroCode()), hero))
                .toList());
        images.flush();
        entries.flush();
        values.saveAllAndFlush(request.heroes().stream().flatMap(hero -> hero.values().stream()
                .map(value -> RankingSnapshotRows.valueRow(snapshot.getId(), heroIds.get(hero.heroCode()), value,
                        heroIds, now)))
                .toList());

        var detail = views.detail(snapshot);
        audit.record(new AuditEntry(actor, "HERO_RANKING_SNAPSHOT_IMPORTED", AGGREGATE, snapshot.getId(), null, null,
                1L, null, Map.of("code", snapshot.getCode(), "heroes", detail.heroCount(), "values",
                        detail.valueCount(), "needsReview", detail.needsReviewCount())));
        return detail;
    }

    @PreAuthorize("hasAuthority('hero:write')")
    @Transactional
    public HeroRankingViews.Reviewed review(UUID snapshotId, UUID heroId, String metricName, ReviewValue request) {
        var metric = RankingMetric.parse(metricName).orElseThrow(() -> invalid("Unknown ranking metric."));
        boolean needsReview = request.needsReview();
        metric.problem(request.number(), blankToNull(request.tier()), request.heroId() != null, needsReview)
                .ifPresent(problem -> {
                    throw invalid(problem);
                });
        if (request.heroId() != null && !heroes.existsById(request.heroId())) {
            throw invalid("The counter hero does not exist.");
        }

        var snapshot = snapshots.lockById(snapshotId).orElseThrow(HeroRankings::snapshotNotFound);
        var row = values.findById(new RankingSnapshotValueRow.Key(snapshotId, heroId, metric.name()))
                .orElseThrow(() -> new ApiException(HeroErrorCode.HERO_RANKING_VALUE_NOT_FOUND,
                        "This value is not in the snapshot."));
        if (row.getVersion() != request.expectedVersion()) {
            throw versionConflict(row.getVersion());
        }

        var actor = actors.require();
        var now = clock.instant();
        boolean changed = !Objects.equals(comparable(row.getNumberValue()), comparable(request.number()))
                || !Objects.equals(row.getTierValue(), blankToNull(request.tier()))
                || !Objects.equals(row.getHeroValue(), request.heroId());
        row.setNumberValue(request.number());
        row.setTierValue(blankToNull(request.tier()));
        row.setHeroValue(request.heroId());
        row.setNeedsReview(needsReview);
        row.setNote(blankToNull(request.note()));
        row.setReviewedAt(needsReview ? null : now);
        row.setReviewedByIssuer(needsReview ? null : actor.issuer());
        row.setReviewedBySubject(needsReview ? null : actor.subject());
        row.setVersion(row.getVersion() + 1);
        row.setUpdatedAt(now);
        if (needsReview && snapshot.getConfirmedAt() != null) {
            reopen(snapshot, now);
        }
        values.flush();

        audit.record(new AuditEntry(actor, "HERO_RANKING_VALUE_REVIEWED", AGGREGATE, snapshotId, null,
                row.getVersion() - 1, row.getVersion(), null,
                Map.of("heroId", heroId, "metric", metric.name(), "needsReview", needsReview, "changed", changed)));
        var codes = views.codes(row.getHeroValue() == null ? Set.of() : Set.of(row.getHeroValue()));
        return new HeroRankingViews.Reviewed(RankingSnapshotViews.value(row, codes), views.summary(snapshot));
    }

    @PreAuthorize("hasAuthority('hero:write')")
    @Transactional
    public Summary confirm(UUID snapshotId, ConfirmSnapshot request) {
        var snapshot = snapshots.lockById(snapshotId).orElseThrow(HeroRankings::snapshotNotFound);
        if (snapshot.getConfirmedAt() != null) {
            return views.summary(snapshot);
        }
        if (snapshot.getVersion() != request.expectedVersion()) {
            throw versionConflict(snapshot.getVersion());
        }
        long open = values.countBySnapshotIdAndNeedsReviewTrue(snapshotId);
        if (open > 0) {
            throw new ApiException(HeroErrorCode.HERO_RANKING_REVIEW_OPEN,
                    open + " values still wait for review.", Map.of("needsReview", open));
        }

        var actor = actors.require();
        var now = clock.instant();
        snapshot.setConfirmedAt(now);
        snapshot.setConfirmedByIssuer(actor.issuer());
        snapshot.setConfirmedBySubject(actor.subject());
        snapshot.setVersion(snapshot.getVersion() + 1);
        snapshot.setUpdatedAt(now);
        snapshots.flush();

        audit.record(new AuditEntry(actor, "HERO_RANKING_SNAPSHOT_CONFIRMED", AGGREGATE, snapshotId, null,
                snapshot.getVersion() - 1, snapshot.getVersion(), null, Map.of("code", snapshot.getCode())));
        return views.summary(snapshot);
    }

    @PreAuthorize("hasAuthority('hero:write')")
    @Transactional
    public void delete(UUID snapshotId, long expectedVersion) {
        var snapshot = snapshots.lockById(snapshotId).orElseThrow(HeroRankings::snapshotNotFound);
        if (snapshot.getVersion() != expectedVersion) {
            throw versionConflict(snapshot.getVersion());
        }

        var actor = actors.require();
        snapshots.delete(snapshot);
        snapshots.flush();

        audit.record(new AuditEntry(actor, "HERO_RANKING_SNAPSHOT_DELETED", AGGREGATE, snapshotId, null,
                snapshot.getVersion(), null, null, Map.of("code", snapshot.getCode())));
    }

    private void reopen(RankingSnapshotRow snapshot, Instant now) {
        snapshot.setConfirmedAt(null);
        snapshot.setConfirmedByIssuer(null);
        snapshot.setConfirmedBySubject(null);
        snapshot.setVersion(snapshot.getVersion() + 1);
        snapshot.setUpdatedAt(now);
    }

    /** Hero ids by every code the request uses, including counters; legacy codes resolve through their alias. */
    private Map<String, UUID> resolveHeroes(ImportSnapshot request) {
        Set<String> codes = new TreeSet<>();
        for (var hero : request.heroes()) {
            codes.add(hero.heroCode());
            hero.values().stream().map(value -> blankToNull(value.heroCode())).filter(Objects::nonNull)
                    .forEach(codes::add);
        }

        Map<String, UUID> ids = heroes.findByCodeIn(codes).stream()
                .collect(Collectors.toMap(HeroIdentity::getCode, HeroIdentity::getId));
        List<String> unknown = new ArrayList<>();
        for (String code : codes) {
            if (ids.containsKey(code)) {
                continue;
            }
            heroes.findByCode(code).ifPresentOrElse(hero -> ids.put(code, hero.getId()), () -> unknown.add(code));
        }
        if (!unknown.isEmpty()) {
            throw new ApiException(HeroErrorCode.HERO_RANKING_INVALID, "Unknown hero codes: " + unknown + ".",
                    Map.of("unknownHeroCodes", unknown));
        }
        return ids;
    }

    private static @Nullable BigDecimal comparable(@Nullable BigDecimal value) {
        return value == null ? null : value.stripTrailingZeros();
    }

    private static ApiException snapshotNotFound() {
        return new ApiException(HeroErrorCode.HERO_RANKING_SNAPSHOT_NOT_FOUND, "Ranking snapshot was not found.");
    }

    private static ApiException snapshotExists(String code) {
        return new ApiException(HeroErrorCode.HERO_RANKING_SNAPSHOT_EXISTS,
                "A ranking snapshot with code " + code + " already exists.");
    }

    private static ApiException versionConflict(long current) {
        return new ApiException(HeroErrorCode.HERO_RANKING_VERSION_CONFLICT, "Someone else changed this first.",
                Map.of("currentVersion", current));
    }
}
