package com.wikiaov.build.internal.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.wikiaov.build.internal.application.BuildCommands.Hero;
import com.wikiaov.build.internal.application.BuildCommands.Image;
import com.wikiaov.build.internal.application.BuildCommands.ImportCapture;
import com.wikiaov.build.internal.application.BuildCommands.ImportedBuild;
import com.wikiaov.platform.ApiException;
import java.time.Instant;
import java.util.List;
import java.util.Set;
import org.assertj.core.api.ThrowableAssert.ThrowingCallable;
import org.junit.jupiter.api.Test;

class BuildCaptureRulesTest {
    private static final String IMAGE = "a".repeat(64);

    @Test
    void aWellFormedCapturePassesTheCaptureChecks() {
        assertThatCode(() -> BuildCaptureRules.validateCapture(capture("pro-2026-11-11", "VN", "PRO",
                "Asia/Ho_Chi_Minh", List.of()))).doesNotThrowAnyException();
    }

    @Test
    void aCaptureCodeMustBeALowerCaseSlug() {
        assertInvalid(() -> BuildCaptureRules.validateCapture(capture("Pro 2026", "VN", "PRO", "UTC", List.of())));
    }

    @Test
    void aCaptureComesFromAKnownTab() {
        assertInvalid(() -> BuildCaptureRules.validateCapture(capture("pro", "VN", "FRIENDS", "UTC", List.of())));
    }

    @Test
    void theSourceTimeZoneMustBeAnIanaZone() {
        assertInvalid(() -> BuildCaptureRules.validateCapture(capture("pro", "VN", "PRO", "Saigon", List.of())));
    }

    @Test
    void imagesAreReturnedByTheirIdAndMayNotRepeat() {
        assertThat(BuildCaptureRules.validateImages(List.of(image(IMAGE)))).isEqualTo(Set.of(IMAGE));
        assertInvalid(() -> BuildCaptureRules.validateImages(List.of(image(IMAGE), image(IMAGE))));
    }

    @Test
    void aHeroThatWasNotCollectedHasNoBuilds() {
        var hero = new Hero("airi", "Airi", 1, "NO_BUILDS", List.of(build(1, null)));

        assertInvalid(() -> BuildCaptureRules.validateHeroes(capture("pro", "VN", "PRO", "UTC", List.of(hero)),
                Set.of()));
    }

    @Test
    void aBuildPointsAtAnImageOfTheCapture() {
        var hero = new Hero("airi", "Airi", 1, "COLLECTED", List.of(build(1, "b".repeat(64))));

        assertInvalid(() -> BuildCaptureRules.validateHeroes(capture("pro", "VN", "PRO", "UTC", List.of(hero)),
                Set.of(IMAGE)));
    }

    @Test
    void twoHeroesMayNotShareACaptureOrder() {
        var first = new Hero("airi", "Airi", 1, "COLLECTED", List.of());
        var second = new Hero("butterfly", "Butterfly", 1, "COLLECTED", List.of());

        assertInvalid(() -> BuildCaptureRules.validateHeroes(
                capture("pro", "VN", "PRO", "UTC", List.of(first, second)), Set.of()));
    }

    @Test
    void blankTextIsStoredAsNothing() {
        assertThat(BuildCaptureRules.blankToNull("  ")).isNull();
        assertThat(BuildCaptureRules.blankToNull(" Airi ")).isEqualTo("Airi");
    }

    private static void assertInvalid(ThrowingCallable call) {
        assertThatThrownBy(call).isInstanceOfSatisfying(ApiException.class,
                error -> assertThat(error.getErrorCode()).isEqualTo(BuildErrorCode.BUILD_INVALID));
    }

    private static ImportCapture capture(String code, String region, String source, String zone, List<Hero> heroes) {
        return new ImportCapture(code, region, source, "Pro builds", Instant.parse("2026-11-11T03:00:00Z"), zone,
                "run-1", null, List.of(), heroes);
    }

    private static Image image(String id) {
        return new Image(id, "capture.png", 1920, 1080, "PREPARE");
    }

    private static ImportedBuild build(int position, String imageId) {
        return new ImportedBuild(position, imageId, List.of(), List.of(), List.of(), null, null, null, null, true,
                null);
    }
}
