package com.wikiaov.patch.internal.web;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;

import com.wikiaov.patch.internal.notes.application.PatchNotes;
import com.wikiaov.patch.internal.stats.application.PatchStatDefaults;
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

class PatchAdminReadParametersTest {

    static Stream<Named<Consumer<HttpServletRequest>>> readsWithoutParameters() {
        var notes = new PatchNotesController(mock(PatchNotes.class));
        var defaults = new PatchStatDefaultsController(mock(PatchStatDefaults.class));
        return Stream.of(
                Named.of("patch notes", request -> notes.read(UUID.randomUUID(), "vi-VN", request)),
                Named.of("stat defaults", request -> defaults.effective(UUID.randomUUID(), request)));
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
