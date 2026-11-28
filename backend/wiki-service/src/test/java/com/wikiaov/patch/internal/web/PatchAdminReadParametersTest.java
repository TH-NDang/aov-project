package com.wikiaov.patch.internal.web;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;

import com.wikiaov.patch.internal.notes.application.PatchNotes;
import com.wikiaov.platform.ApiException;
import com.wikiaov.platform.PlatformErrorCode;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;

class PatchAdminReadParametersTest {

    @Test
    void readingPatchNotesRejectsAnUnknownQueryParameter() {
        var notes = new PatchNotesController(mock(PatchNotes.class));
        var request = new MockHttpServletRequest();
        request.addParameter("page", "0");

        assertThatThrownBy(() -> notes.read(UUID.randomUUID(), "vi-VN", request)).isInstanceOfSatisfying(
                ApiException.class,
                error -> assertThat(error.getErrorCode()).isEqualTo(PlatformErrorCode.INVALID_QUERY_PARAMETER));
    }
}
