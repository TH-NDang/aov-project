package com.wikiaov.build.internal.application;

import com.wikiaov.build.internal.application.BuildCommands.ImportCapture;
import com.wikiaov.build.internal.domain.BuildContent;
import com.wikiaov.build.internal.domain.BuildSource;
import com.wikiaov.platform.ApiException;
import com.wikiaov.platform.CatalogCodes;
import com.wikiaov.platform.EnumNames;
import java.time.DateTimeException;
import java.time.ZoneId;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;

/**
 * The checks of an imported build capture that need no stored data (ADR-026): codes, market, tab, time zone, images,
 * heroes and the content of each build. A broken rule is {@code BUILD_INVALID}.
 */
final class BuildCaptureRules {
    private static final Set<String> RESULTS = Set.of("COLLECTED", "NO_BUILDS", "FAILED");
    private static final Set<String> LAYOUTS = Set.of("PREPARE");
    private static final Pattern CODE = Pattern.compile(CatalogCodes.PATTERN);
    private static final Pattern REGION = Pattern.compile("[A-Z]{2,16}");
    private static final Pattern IMAGE_ID = Pattern.compile("[0-9a-f]{64}");

    private BuildCaptureRules() {
    }

    static void validateCapture(ImportCapture request) {
        if (!CODE.matcher(request.code()).matches()) {
            throw invalid("A capture code is a lowercase slug.");
        }
        if (!REGION.matcher(request.regionCode()).matches()) {
            throw invalid("Unknown market.");
        }
        if (EnumNames.find(BuildSource.class, request.sourceKind()) == null) {
            throw invalid("A capture comes from the PRO, HOT or SYSTEM tab.");
        }
        try {
            ZoneId.of(request.sourceTimeZone());
        } catch (DateTimeException e) {
            throw invalid("The source time zone is not an IANA time zone.");
        }
    }

    static Set<String> validateImages(List<BuildCommands.Image> list) {
        Set<String> ids = new HashSet<>();
        for (var image : list) {
            if (!IMAGE_ID.matcher(image.imageId()).matches()) {
                throw invalid("An image id is the SHA-256 of the file in lowercase hex.");
            }
            if (!LAYOUTS.contains(image.layout())) {
                throw invalid("Unknown screen layout " + image.layout() + ".");
            }
            if (!ids.add(image.imageId())) {
                throw invalid("Image " + image.imageId() + " is listed twice.");
            }
        }
        return ids;
    }

    static void validateHeroes(ImportCapture request, Set<String> imageIds) {
        Set<String> codes = new HashSet<>();
        Set<Integer> orders = new HashSet<>();
        for (var hero : request.heroes()) {
            if (!codes.add(hero.heroCode())) {
                throw invalid("Hero " + hero.heroCode() + " is listed twice.");
            }
            if (!orders.add(hero.captureOrder())) {
                throw invalid("Two heroes share capture order " + hero.captureOrder() + ".");
            }
            if (!RESULTS.contains(hero.result())) {
                throw invalid("Unknown capture result " + hero.result() + ".");
            }
            if (!hero.result().equals("COLLECTED") && !hero.builds().isEmpty()) {
                throw invalid(hero.heroCode() + " has builds although it was not collected.");
            }
            Set<Integer> positions = new HashSet<>();
            for (var build : hero.builds()) {
                if (!positions.add(build.position())) {
                    throw invalid(hero.heroCode() + " lists position " + build.position() + " twice.");
                }
                String image = blankToNull(build.imageId());
                if (image != null && !imageIds.contains(image)) {
                    throw invalid(hero.heroCode() + " build " + build.position() + " points at an unknown image.");
                }
            }
        }
    }

    static void checkContent(String label, BuildContent content, boolean needsReview) {
        var problems = content.problems();
        if (!problems.isEmpty()) {
            throw new ApiException(BuildErrorCode.BUILD_INVALID, label + ": " + String.join(" ", problems),
                    Map.of("problems", problems));
        }
        if (!needsReview && !content.complete()) {
            throw invalid(label + " lacks a part, so it must stay in review.");
        }
    }

    static ApiException invalid(String detail) {
        return new ApiException(BuildErrorCode.BUILD_INVALID, detail);
    }

    static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }
}
