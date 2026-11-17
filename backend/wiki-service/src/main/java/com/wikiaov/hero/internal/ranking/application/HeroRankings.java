package com.wikiaov.hero.internal.ranking.application;

import com.wikiaov.access.AuditEntry;
import com.wikiaov.access.AuditLog;
import com.wikiaov.access.CurrentActor;
import com.wikiaov.hero.internal.application.HeroErrorCode;
import com.wikiaov.hero.internal.application.HeroRankingCommands;
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
import com.wikiaov.hero.internal.ranking.persistence.entity.RankingSnapshotHeroRow;
import com.wikiaov.hero.internal.ranking.persistence.entity.RankingSnapshotImageRow;
import com.wikiaov.hero.internal.ranking.persistence.entity.RankingSnapshotRow;
import com.wikiaov.hero.internal.ranking.persistence.entity.RankingSnapshotValueRow;
import com.wikiaov.platform.ApiException;
import com.wikiaov.platform.CatalogCodes;
import com.wikiaov.platform.PageSlice;
import com.wikiaov.platform.PlatformErrorCode;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.DateTimeException;
import java.time.Instant;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collection;
import java.util.Comparator;
import java.util.EnumSet;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.TreeSet;
import java.util.UUID;
import java.util.regex.Pattern;
import java.util.stream.Collectors;
import java.util.stream.Stream;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Snapshots of the game's hero ranking boards read from screenshots (ADR-025): import, review of single values, sign-off
 * of a whole snapshot and removal of one imported by mistake. Writes lock the snapshot row so the count of values
 * waiting for review cannot move under a confirmation.
 */
@Service
public class HeroRankings {
    private static final Set<String> BOARDS = Set.of("RATES", "FIGURES");
    private static final Set<String> ROLES = Set.of("TANK", "WARRIOR", "ASSASSIN", "MAGE", "MARKSMAN", "SUPPORT");
    private static final Pattern CODE = Pattern.compile(CatalogCodes.PATTERN);
    private static final Pattern REGION = Pattern.compile("[A-Z]{2,16}");
    private static final Pattern MODE = Pattern.compile("[A-Z][A-Z0-9_]*");
    private static final Pattern IMAGE_ID = Pattern.compile("[0-9a-f]{64}");
    private static final Sort LIST_ORDER = Sort.by(Sort.Order.desc("capturedAt"), Sort.Order.asc("id"));
    private static final String AGGREGATE = "HERO_RANKING_SNAPSHOT";

    private final RankingSnapshotRepository snapshots;
    private final RankingSnapshotImageRepository images;
    private final RankingSnapshotHeroRepository entries;
    private final RankingSnapshotValueRepository values;
    private final HeroIdentityRepository heroes;
    private final CurrentActor actors;
    private final AuditLog audit;
    private final Clock clock;

    public HeroRankings(RankingSnapshotRepository snapshots, RankingSnapshotImageRepository images,
            RankingSnapshotHeroRepository entries, RankingSnapshotValueRepository values,
            HeroIdentityRepository heroes, CurrentActor actors, AuditLog audit, Clock clock) {
        this.snapshots = snapshots;
        this.images = images;
        this.entries = entries;
        this.values = values;
        this.heroes = heroes;
        this.actors = actors;
        this.audit = audit;
        this.clock = clock;
    }

    @PreAuthorize("hasAuthority('catalog:read')")
    @Transactional(readOnly = true)
    public PageSlice<Summary> list(String region, String mode, int page, int size) {
        var result = snapshots.findAll(RankingSnapshotRepository.matching(region, mode),
                PageRequest.of(page, size, LIST_ORDER));
        var counts = counts(result.getContent().stream().map(RankingSnapshotRow::getId).toList());

        return new PageSlice<>(result.getContent().stream().map(row -> summary(row, counts.get(row.getId()))).toList(),
                page, size, result.getTotalElements());
    }

    @PreAuthorize("hasAuthority('catalog:read')")
    @Transactional(readOnly = true)
    public Detail detail(UUID snapshotId) {
        return detailOf(snapshots.findById(snapshotId).orElseThrow(HeroRankings::snapshotNotFound));
    }

    /**
     * One hero as readers see it in the latest confirmed snapshot (ADR-029): no unconfirmed snapshot, no value waiting
     * for review, no reading text or source area.
     */
    @Transactional(readOnly = true)
    public HeroRankingViews.Published published(UUID heroId, String region, String mode) {
        if (!REGION.matcher(region).matches() || !MODE.matcher(mode).matches()) {
            throw new ApiException(PlatformErrorCode.INVALID_QUERY_PARAMETER,
                    "Use an upper-case market and mode code.");
        }

        var found = snapshots.findFirstByRegionCodeAndModeCodeAndConfirmedAtIsNotNullOrderByCapturedAtDescIdAsc(region,
                mode);
        if (found.isEmpty())
            return new HeroRankingViews.Published(null, null);
        var snapshot = found.get();
        var rows = values.findBySnapshotId(snapshot.getId()).stream().filter(row -> !row.isNeedsReview()).toList();
        int heroCount = entries.findBySnapshotId(snapshot.getId()).size();
        var view = new HeroRankingViews.PublishedSnapshot(snapshot.getCode(), snapshot.getRegionCode(),
                snapshot.getModeCode(), snapshot.getModeLabel(), snapshot.getPeriodLabel(), snapshot.getCapturedAt(),
                snapshot.getSourceTimeZone(), heroCount);

        var own = rows.stream().filter(row -> row.getHeroId().equals(heroId))
                .collect(Collectors.toMap(row -> RankingMetric.valueOf(row.getMetric()), row -> row, (a, b) -> a));
        if (own.isEmpty())
            return new HeroRankingViews.Published(view, null);

        return new HeroRankingViews.Published(view, entry(heroId, own, rows));
    }

    private HeroRankingViews.PublishedEntry entry(UUID heroId, Map<RankingMetric, RankingSnapshotValueRow> own,
            List<RankingSnapshotValueRow> all) {
        var figures = Arrays.stream(RankingMetric.values()).filter(metric -> metric.kind() == RankingMetric.Kind.AMOUNT)
                .map(metric -> {
                    var mine = own.get(metric);
                    var others = all.stream()
                            .filter(row -> row.getMetric().equals(metric.name()) && row.getNumberValue() != null)
                            .map(RankingSnapshotValueRow::getNumberValue).toList();
                    if (mine == null || mine.getNumberValue() == null)
                        return new HeroRankingViews.Figure(metric.name(), null, null, others.size());
                    int rank = 1 + (int) others.stream().filter(value -> value.compareTo(mine.getNumberValue()) > 0)
                            .count();
                    return new HeroRankingViews.Figure(metric.name(), mine.getNumberValue(), rank, others.size());
                }).toList();

        var counterIds = Stream.of(RankingMetric.COUNTER_1, RankingMetric.COUNTER_2, RankingMetric.COUNTER_3)
                .map(own::get).filter(Objects::nonNull)
                .map(RankingSnapshotValueRow::getHeroValue).filter(Objects::nonNull).toList();
        Set<UUID> ids = new HashSet<>(counterIds);
        ids.add(heroId);
        var codes = codes(ids);

        return new HeroRankingViews.PublishedEntry(heroId, codes.get(heroId), tier(own.get(RankingMetric.TIER)),
                number(own.get(RankingMetric.WIN_RATE)), number(own.get(RankingMetric.PICK_RATE)),
                number(own.get(RankingMetric.BAN_RATE)), figures,
                counterIds.stream().map(id -> new HeroRankingViews.Counter(id, codes.get(id))).toList());
    }

    private static String tier(RankingSnapshotValueRow row) {
        return row == null ? null : row.getTierValue();
    }

    private static BigDecimal number(RankingSnapshotValueRow row) {
        return row == null ? null : row.getNumberValue();
    }

    @PreAuthorize("hasAuthority('hero:write')")
    @Transactional
    public Detail importSnapshot(ImportSnapshot request) {
        validateSnapshot(request);
        var imageSizes = validateImages(request.images());
        var heroIds = resolveHeroes(request);
        validateHeroes(request, heroIds, imageSizes);
        if (snapshots.existsByCode(request.code()))
            throw snapshotExists(request.code());

        var actor = actors.require();
        var now = clock.instant();
        var snapshot = new RankingSnapshotRow();
        snapshot.setId(UUID.randomUUID());
        snapshot.setCode(request.code());
        snapshot.setRegionCode(request.regionCode());
        snapshot.setModeCode(request.modeCode());
        snapshot.setModeLabel(request.modeLabel().trim());
        snapshot.setPeriodLabel(blankToNull(request.periodLabel()));
        snapshot.setCapturedAt(request.capturedAt());
        snapshot.setSourceTimeZone(request.sourceTimeZone());
        snapshot.setSourceRun(request.sourceRun().trim());
        snapshot.setSourceNote(blankToNull(request.sourceNote()));
        snapshot.setVersion(1);
        snapshot.setCreatedAt(now);
        snapshot.setCreatedByIssuer(actor.issuer());
        snapshot.setCreatedBySubject(actor.subject());
        snapshot.setUpdatedAt(now);
        try {
            snapshots.saveAndFlush(snapshot);
        } catch (DataIntegrityViolationException e) {
            throw snapshotExists(request.code());
        }
        images.saveAll(request.images().stream().map(image -> imageRow(snapshot.getId(), image)).toList());
        entries.saveAll(request.heroes().stream()
                .map(hero -> entryRow(snapshot.getId(), heroIds.get(hero.heroCode()), hero)).toList());
        images.flush();
        entries.flush();
        values.saveAllAndFlush(request.heroes().stream().flatMap(hero -> hero.values().stream()
                .map(value -> valueRow(snapshot.getId(), heroIds.get(hero.heroCode()), value, heroIds, now)))
                .toList());

        var detail = detailOf(snapshot);
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
        if (request.heroId() != null && !heroes.existsById(request.heroId()))
            throw invalid("The counter hero does not exist.");

        var snapshot = snapshots.lockById(snapshotId).orElseThrow(HeroRankings::snapshotNotFound);
        var row = values.findById(new RankingSnapshotValueRow.Key(snapshotId, heroId, metric.name()))
                .orElseThrow(() -> new ApiException(HeroErrorCode.HERO_RANKING_VALUE_NOT_FOUND,
                        "This value is not in the snapshot."));
        if (row.getVersion() != request.expectedVersion())
            throw versionConflict(row.getVersion());

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
        if (needsReview && snapshot.getConfirmedAt() != null)
            reopen(snapshot, now);
        values.flush();

        audit.record(new AuditEntry(actor, "HERO_RANKING_VALUE_REVIEWED", AGGREGATE, snapshotId, null,
                row.getVersion() - 1, row.getVersion(), null,
                Map.of("heroId", heroId, "metric", metric.name(), "needsReview", needsReview, "changed", changed)));
        var codes = codes(row.getHeroValue() == null ? Set.of() : Set.of(row.getHeroValue()));
        return new HeroRankingViews.Reviewed(value(row, codes), summaryOf(snapshot));
    }

    @PreAuthorize("hasAuthority('hero:write')")
    @Transactional
    public Summary confirm(UUID snapshotId, ConfirmSnapshot request) {
        var snapshot = snapshots.lockById(snapshotId).orElseThrow(HeroRankings::snapshotNotFound);
        if (snapshot.getConfirmedAt() != null)
            return summaryOf(snapshot);
        if (snapshot.getVersion() != request.expectedVersion())
            throw versionConflict(snapshot.getVersion());
        long open = values.countBySnapshotIdAndNeedsReviewTrue(snapshotId);
        if (open > 0)
            throw new ApiException(HeroErrorCode.HERO_RANKING_REVIEW_OPEN,
                    open + " values still wait for review.", Map.of("needsReview", open));

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
        return summaryOf(snapshot);
    }

    @PreAuthorize("hasAuthority('hero:write')")
    @Transactional
    public void delete(UUID snapshotId, long expectedVersion) {
        var snapshot = snapshots.lockById(snapshotId).orElseThrow(HeroRankings::snapshotNotFound);
        if (snapshot.getVersion() != expectedVersion)
            throw versionConflict(snapshot.getVersion());

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

    private void validateSnapshot(ImportSnapshot request) {
        if (!CODE.matcher(request.code()).matches())
            throw invalid("A snapshot code is a lowercase slug.");
        if (!REGION.matcher(request.regionCode()).matches())
            throw invalid("Unknown market.");
        if (!MODE.matcher(request.modeCode()).matches())
            throw invalid("A mode code uses capital letters, digits and underscores.");
        try {
            ZoneId.of(request.sourceTimeZone());
        } catch (DateTimeException e) {
            throw invalid("The source time zone is not an IANA time zone.");
        }
    }

    /** Image sizes by id, after checking that no image or page is listed twice. */
    private Map<String, int[]> validateImages(List<HeroRankingCommands.Image> list) {
        Map<String, int[]> sizes = new HashMap<>();
        Set<String> pages = new HashSet<>();
        for (var image : list) {
            if (!IMAGE_ID.matcher(image.imageId()).matches())
                throw invalid("An image id is the SHA-256 of the file in lowercase hex.");
            if (!BOARDS.contains(image.board()))
                throw invalid("An image belongs to the RATES or FIGURES board.");
            if (sizes.put(image.imageId(), new int[] {image.width(), image.height()}) != null)
                throw invalid("Image " + image.imageId() + " is listed twice.");
            if (!pages.add(image.board() + ":" + image.pageNo()))
                throw invalid("Page " + image.pageNo() + " of " + image.board() + " is listed twice.");
        }
        return sizes;
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
            if (ids.containsKey(code))
                continue;
            heroes.findByCode(code).ifPresentOrElse(hero -> ids.put(code, hero.getId()), () -> unknown.add(code));
        }
        if (!unknown.isEmpty())
            throw new ApiException(HeroErrorCode.HERO_RANKING_INVALID, "Unknown hero codes: " + unknown + ".",
                    Map.of("unknownHeroCodes", unknown));
        return ids;
    }

    private void validateHeroes(ImportSnapshot request, Map<String, UUID> heroIds, Map<String, int[]> imageSizes) {
        Set<UUID> listed = new HashSet<>();
        Set<Integer> ratesPositions = new HashSet<>(), figuresPositions = new HashSet<>();
        for (var hero : request.heroes()) {
            if (!listed.add(heroIds.get(hero.heroCode())))
                throw invalid("Hero " + hero.heroCode() + " is listed twice.");
            if (!ROLES.contains(hero.roleOnScreen()))
                throw invalid("Unknown role " + hero.roleOnScreen() + ".");
            if ((hero.ratesPosition() != null && !ratesPositions.add(hero.ratesPosition()))
                    || (hero.figuresPosition() != null && !figuresPositions.add(hero.figuresPosition())))
                throw invalid("Two heroes share a place on one board.");

            Set<RankingMetric> seen = EnumSet.noneOf(RankingMetric.class);
            for (var value : hero.values()) {
                var metric = RankingMetric.parse(value.metric())
                        .orElseThrow(() -> invalid("Unknown ranking metric " + value.metric() + "."));
                if (!seen.add(metric))
                    throw invalid(hero.heroCode() + " lists " + metric + " twice.");
                metric.problem(value.number(), blankToNull(value.tier()), blankToNull(value.heroCode()) != null,
                        value.needsReview()).ifPresent(problem -> {
                            throw invalid(hero.heroCode() + ": " + problem);
                        });
                if (value.source() != null)
                    validateSource(hero.heroCode(), metric, value.source(), imageSizes);
            }
        }
    }

    private static void validateSource(String heroCode, RankingMetric metric,
            HeroRankingCommands.Source source, Map<String, int[]> sizes) {
        int[] size = sizes.get(source.imageId());
        if (size == null)
            throw invalid(heroCode + " " + metric + " points at an image that is not in the snapshot.");
        if (source.x() + source.width() > size[0] || source.y() + source.height() > size[1])
            throw invalid(heroCode + " " + metric + " points outside its image.");
    }

    private static RankingSnapshotImageRow imageRow(UUID snapshotId,
            HeroRankingCommands.Image image) {
        var row = new RankingSnapshotImageRow();
        row.setSnapshotId(snapshotId);
        row.setImageId(image.imageId());
        row.setBoard(image.board());
        row.setPageNo(image.pageNo());
        row.setFileName(image.fileName().trim());
        row.setWidth(image.width());
        row.setHeight(image.height());
        return row;
    }

    private static RankingSnapshotHeroRow entryRow(UUID snapshotId, UUID heroId,
            HeroRankingCommands.Hero hero) {
        var row = new RankingSnapshotHeroRow();
        row.setSnapshotId(snapshotId);
        row.setHeroId(heroId);
        row.setNameOnScreen(hero.nameOnScreen().trim());
        row.setRoleOnScreen(hero.roleOnScreen());
        row.setRatesPosition(hero.ratesPosition());
        row.setFiguresPosition(hero.figuresPosition());
        return row;
    }

    private static RankingSnapshotValueRow valueRow(UUID snapshotId, UUID heroId,
            HeroRankingCommands.Value value, Map<String, UUID> heroIds,
            Instant now) {
        var row = new RankingSnapshotValueRow();
        row.setSnapshotId(snapshotId);
        row.setHeroId(heroId);
        row.setMetric(value.metric());
        row.setNumberValue(value.number());
        row.setTierValue(blankToNull(value.tier()));
        String counter = blankToNull(value.heroCode());
        row.setHeroValue(counter == null ? null : heroIds.get(counter));
        row.setReadText(blankToNull(value.readText()));
        row.setNeedsReview(value.needsReview());
        row.setNote(blankToNull(value.note()));
        if (value.source() != null) {
            row.setImageId(value.source().imageId());
            row.setBoxX(value.source().x());
            row.setBoxY(value.source().y());
            row.setBoxWidth(value.source().width());
            row.setBoxHeight(value.source().height());
        }
        row.setVersion(1);
        row.setUpdatedAt(now);
        return row;
    }

    private Detail detailOf(RankingSnapshotRow snapshot) {
        var imageRows = images.findBySnapshotIdOrderByBoardDescPageNoAsc(snapshot.getId());
        var heroRows = entries.findBySnapshotId(snapshot.getId());
        var valueRows = values.findBySnapshotId(snapshot.getId());

        Set<UUID> ids = new HashSet<>();
        heroRows.forEach(row -> ids.add(row.getHeroId()));
        valueRows.stream().map(RankingSnapshotValueRow::getHeroValue).filter(Objects::nonNull).forEach(ids::add);
        var codes = codes(ids);
        Map<UUID, List<RankingSnapshotValueRow>> byHero = valueRows.stream()
                .collect(Collectors.groupingBy(RankingSnapshotValueRow::getHeroId));
        var heroViews = heroRows.stream()
                .sorted(Comparator.comparing(RankingSnapshotHeroRow::getRatesPosition,
                        Comparator.nullsLast(Comparator.naturalOrder()))
                        .thenComparing(RankingSnapshotHeroRow::getFiguresPosition,
                                Comparator.nullsLast(Comparator.naturalOrder())))
                .map(row -> new HeroRankingViews.HeroEntry(row.getHeroId(), codes.get(row.getHeroId()),
                        row.getNameOnScreen(), row.getRoleOnScreen(), row.getRatesPosition(),
                        row.getFiguresPosition(),
                        byHero.getOrDefault(row.getHeroId(), List.of()).stream()
                                .sorted(Comparator.comparing(value -> RankingMetric.valueOf(value.getMetric())))
                                .map(value -> value(value, codes)).toList()))
                .toList();
        int open = (int) valueRows.stream().filter(RankingSnapshotValueRow::isNeedsReview).count();

        return new Detail(snapshot.getId(), snapshot.getCode(), snapshot.getRegionCode(), snapshot.getModeCode(),
                snapshot.getModeLabel(), snapshot.getPeriodLabel(), snapshot.getCapturedAt(),
                snapshot.getSourceTimeZone(), snapshot.getConfirmedAt(), heroRows.size(), valueRows.size(), open,
                snapshot.getVersion(), snapshot.getSourceRun(), snapshot.getSourceNote(), snapshot.getCreatedAt(),
                imageRows.stream().map(row -> new HeroRankingViews.Image(row.getImageId(), row.getBoard(),
                        row.getPageNo(), row.getFileName(), row.getWidth(), row.getHeight())).toList(),
                heroViews);
    }

    private Summary summaryOf(RankingSnapshotRow snapshot) {
        return summary(snapshot, counts(List.of(snapshot.getId())).get(snapshot.getId()));
    }

    private static Summary summary(RankingSnapshotRow row, int[] count) {
        int[] safe = count == null ? new int[3] : count;
        return new Summary(row.getId(), row.getCode(), row.getRegionCode(), row.getModeCode(), row.getModeLabel(),
                row.getPeriodLabel(), row.getCapturedAt(), row.getSourceTimeZone(), row.getConfirmedAt(), safe[0],
                safe[1], safe[2], row.getVersion());
    }

    /** Heroes, values and values waiting for review, per snapshot. */
    private Map<UUID, int[]> counts(Collection<UUID> snapshotIds) {
        Map<UUID, int[]> counts = new HashMap<>();
        if (snapshotIds.isEmpty())
            return counts;
        entries.countBySnapshot(snapshotIds).forEach(row -> counts
                .computeIfAbsent(row.getSnapshotId(), id -> new int[3])[0] = (int) row.getTotal());
        values.countBySnapshot(snapshotIds).forEach(row -> {
            var count = counts.computeIfAbsent(row.getSnapshotId(), id -> new int[3]);
            count[1] = (int) row.getTotal();
            count[2] = (int) row.getNeedsReview();
        });
        return counts;
    }

    private Map<UUID, String> codes(Collection<UUID> ids) {
        return ids.isEmpty()
                ? Map.of()
                : heroes.findAllById(ids).stream()
                        .collect(Collectors.toMap(HeroIdentity::getId, HeroIdentity::getCode, (a, b) -> a));
    }

    private static HeroRankingViews.Value value(RankingSnapshotValueRow row, Map<UUID, String> codes) {
        var source = row.getImageId() == null
                ? null
                : new HeroRankingViews.Source(row.getImageId(), row.getBoxX(), row.getBoxY(), row.getBoxWidth(),
                        row.getBoxHeight());
        return new HeroRankingViews.Value(row.getMetric(), row.getNumberValue(), row.getTierValue(),
                row.getHeroValue(), row.getHeroValue() == null ? null : codes.get(row.getHeroValue()),
                row.getReadText(), row.isNeedsReview(), row.getNote(), source, row.getReviewedAt(), row.getVersion());
    }

    private static BigDecimal comparable(BigDecimal value) {
        return value == null ? null : value.stripTrailingZeros();
    }

    private static ApiException invalid(String detail) {
        return new ApiException(HeroErrorCode.HERO_RANKING_INVALID, detail);
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

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }
}
