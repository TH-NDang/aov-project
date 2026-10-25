package com.wikiaov.access.internal.infrastructure;

import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.wikiaov.patch.internal.application.response.SeasonUpdatesView;
import com.wikiaov.patch.internal.context.application.SeasonUpdates;
import com.wikiaov.patch.internal.web.SeasonUpdatesController;
import com.wikiaov.platform.ApiException;
import com.wikiaov.platform.PlatformErrorCode;
import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(controllers = SeasonUpdatesController.class)
@Import({SeasonUpdatesController.class, SecurityConfiguration.class, ProblemAuthenticationEntryPoint.class,
        ProblemAccessDeniedHandler.class, ProblemResponseWriter.class})
@ActiveProfiles("test")
class SeasonUpdatesControllerTest {
    @Autowired
    MockMvc mvc;

    @MockitoBean
    SeasonUpdates updates;

    @MockitoBean
    JwtDecoder jwtDecoder;

    @Test
    void servesTheCurrentSeasonPubliclyWithRevalidationAndExplicitDefaults() throws Exception {
        when(updates.read("VN", "vi-VN", 4)).thenReturn(new SeasonUpdatesView("VN", "vi-VN",
                Instant.parse("2026-10-24T09:00:00Z"), null, null, List.of()));

        mvc.perform(get("/api/wiki/v1/seasons/current/updates")).andExpect(status().isOk())
                .andExpect(header().string("Cache-Control", "no-cache, public"))
                .andExpect(jsonPath("$.region").value("VN"))
                .andExpect(jsonPath("$.requestedLocale").value("vi-VN"))
                .andExpect(jsonPath("$.season").isEmpty())
                .andExpect(jsonPath("$.patches").isEmpty());
    }

    @Test
    void rejectsUnrecognizedParametersBeforeTheUseCase() throws Exception {
        mvc.perform(get("/api/wiki/v1/seasons/current/updates?includeDrafts=true"))
                .andExpect(status().isBadRequest());

        verifyNoInteractions(updates);
    }

    @Test
    void preservesValidationFailuresAndRejectsUnsupportedVersions() throws Exception {
        when(updates.read("VN", "vi-VN", 11)).thenThrow(new ApiException(
                PlatformErrorCode.INVALID_QUERY_PARAMETER, "Limit must be between 1 and 10."));

        mvc.perform(get("/api/wiki/v1/seasons/current/updates?limit=11"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_QUERY_PARAMETER"));
        mvc.perform(get("/api/wiki/v2/seasons/current/updates"))
                .andExpect(status().isBadRequest());
    }
}
