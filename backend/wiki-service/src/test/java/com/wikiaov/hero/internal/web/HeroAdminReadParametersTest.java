package com.wikiaov.hero.internal.web;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;

import com.wikiaov.hero.internal.importing.application.HeroImportJobs;
import com.wikiaov.hero.internal.importing.application.HeroImports;
import com.wikiaov.hero.internal.importing.application.HeroUploadSessions;
import com.wikiaov.hero.internal.stats.application.HeroStatSamples;
import com.wikiaov.platform.ApiException;
import com.wikiaov.platform.PlatformErrorCode;
import jakarta.servlet.http.HttpServletRequest;
import java.util.UUID;
import java.util.function.Consumer;
import java.util.stream.Stream;
import org.junit.jupiter.api.Named;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;
import org.springframework.mock.web.MockHttpServletRequest;

class HeroAdminReadParametersTest {

    static Stream<Named<Consumer<HttpServletRequest>>> readsWithoutParameters() {
        var imports = new HeroImportController(mock(HeroImports.class));
        var jobs = new HeroImportJobController(mock(HeroImportJobs.class));
        var sessions = new HeroUploadSessionController(mock(HeroUploadSessions.class));
        var samples = new HeroStatSamplesController(mock(HeroStatSamples.class));
        return Stream.of(
                Named.of("import relation fields", imports::relationFields),
                Named.of("import jobs", jobs::list),
                Named.of("one import job", request -> jobs.get(UUID.randomUUID(), request)),
                Named.of("upload sessions", sessions::list),
                Named.of("hero stat samples", request -> samples.forPatch(UUID.randomUUID(), request)));
    }

    @ParameterizedTest
    @MethodSource("readsWithoutParameters")
    void anAdminReadWithoutQueryParametersRejectsAnUnknownOne(Consumer<HttpServletRequest> read) {
        var request = new MockHttpServletRequest();
        request.addParameter("page", "0");

        assertThatThrownBy(() -> read.accept(request)).isInstanceOfSatisfying(ApiException.class,
                error -> assertThat(error.getErrorCode()).isEqualTo(PlatformErrorCode.INVALID_QUERY_PARAMETER));
    }
}
