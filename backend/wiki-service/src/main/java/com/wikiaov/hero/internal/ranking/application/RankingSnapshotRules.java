package com.wikiaov.hero.internal.ranking.application;

import com.wikiaov.hero.internal.application.HeroErrorCode;
import com.wikiaov.hero.internal.application.HeroRankingCommands;
import com.wikiaov.hero.internal.application.HeroRankingCommands.ImportSnapshot;
import com.wikiaov.hero.internal.domain.HeroContent.Role;
import com.wikiaov.hero.internal.ranking.domain.RankingMetric;
import com.wikiaov.platform.ApiException;
import com.wikiaov.platform.CatalogCodes;
import com.wikiaov.platform.EnumNames;
import java.time.DateTimeException;
import java.time.ZoneId;
import java.util.EnumSet;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Pattern;
import org.jspecify.annotations.Nullable;

/**
 * The checks of an imported ranking snapshot that need no stored data (ADR-025): codes, market, mode, time zone,
 * images, heroes and the values of each hero. A broken rule is {@code HERO_RANKING_INVALID}.
 */
final class RankingSnapshotRules {
    private static final Set<String> BOARDS = Set.of("RATES", "FIGURES");
    private static final Pattern CODE = Pattern.compile(CatalogCodes.PATTERN);
    private static final Pattern REGION = Pattern.compile("[A-Z]{2,16}");
    private static final Pattern MODE = Pattern.compile("[A-Z][A-Z0-9_]*");
    private static final Pattern IMAGE_ID = Pattern.compile("[0-9a-f]{64}");

    private RankingSnapshotRules() {
    }

    /** Whether a reader's market and mode are upper-case codes. */
    static boolean marketAndMode(String region, String mode) {
        return REGION.matcher(region).matches() && MODE.matcher(mode).matches();
    }

    static void validateSnapshot(ImportSnapshot request) {
        if (!CODE.matcher(request.code()).matches()) {
            throw invalid("A snapshot code is a lowercase slug.");
        }
        if (!REGION.matcher(request.regionCode()).matches()) {
            throw invalid("Unknown market.");
        }
        if (!MODE.matcher(request.modeCode()).matches()) {
            throw invalid("A mode code uses capital letters, digits and underscores.");
        }
        try {
            ZoneId.of(request.sourceTimeZone());
        } catch (DateTimeException e) {
            throw invalid("The source time zone is not an IANA time zone.");
        }
    }

    /** Image sizes by id, after checking that no image or page is listed twice. */
    static Map<String, int[]> validateImages(List<HeroRankingCommands.Image> list) {
        Map<String, int[]> sizes = new HashMap<>();
        Set<String> pages = new HashSet<>();
        for (var image : list) {
            if (!IMAGE_ID.matcher(image.imageId()).matches()) {
                throw invalid("An image id is the SHA-256 of the file in lowercase hex.");
            }
            if (!BOARDS.contains(image.board())) {
                throw invalid("An image belongs to the RATES or FIGURES board.");
            }
            if (sizes.put(image.imageId(), new int[] {image.width(), image.height()}) != null) {
                throw invalid("Image " + image.imageId() + " is listed twice.");
            }
            if (!pages.add(image.board() + ":" + image.pageNo())) {
                throw invalid("Page " + image.pageNo() + " of " + image.board() + " is listed twice.");
            }
        }
        return sizes;
    }

    static void validateHeroes(ImportSnapshot request, Map<String, UUID> heroIds, Map<String, int[]> imageSizes) {
        Set<UUID> listed = new HashSet<>();
        Set<Integer> ratesPositions = new HashSet<>(), figuresPositions = new HashSet<>();
        for (var hero : request.heroes()) {
            if (!listed.add(heroIds.get(hero.heroCode()))) {
                throw invalid("Hero " + hero.heroCode() + " is listed twice.");
            }
            if (EnumNames.find(Role.class, hero.roleOnScreen()) == null) {
                throw invalid("Unknown role " + hero.roleOnScreen() + ".");
            }
            if ((hero.ratesPosition() != null && !ratesPositions.add(hero.ratesPosition()))
                    || (hero.figuresPosition() != null && !figuresPositions.add(hero.figuresPosition()))) {
                throw invalid("Two heroes share a place on one board.");
            }

            validateValues(hero, imageSizes);
        }
    }

    private static void validateValues(HeroRankingCommands.Hero hero, Map<String, int[]> imageSizes) {
        Set<RankingMetric> seen = EnumSet.noneOf(RankingMetric.class);
        for (var value : hero.values()) {
            var metric = RankingMetric.parse(value.metric())
                    .orElseThrow(() -> invalid("Unknown ranking metric " + value.metric() + "."));
            if (!seen.add(metric)) {
                throw invalid(hero.heroCode() + " lists " + metric + " twice.");
            }
            metric.problem(value.number(), blankToNull(value.tier()), blankToNull(value.heroCode()) != null,
                    value.needsReview()).ifPresent(problem -> {
                        throw invalid(hero.heroCode() + ": " + problem);
                    });
            if (value.source() != null) {
                validateSource(hero.heroCode(), metric, value.source(), imageSizes);
            }
        }
    }

    private static void validateSource(String heroCode, RankingMetric metric, HeroRankingCommands.Source source,
            Map<String, int[]> sizes) {
        int[] size = sizes.get(source.imageId());
        if (size == null) {
            throw invalid(heroCode + " " + metric + " points at an image that is not in the snapshot.");
        }
        if (source.x() + source.width() > size[0] || source.y() + source.height() > size[1]) {
            throw invalid(heroCode + " " + metric + " points outside its image.");
        }
    }

    static ApiException invalid(String detail) {
        return new ApiException(HeroErrorCode.HERO_RANKING_INVALID, detail);
    }

    static @Nullable String blankToNull(@Nullable String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }
}
