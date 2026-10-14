package com.wikiaov.patch.internal.web;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.wikiaov.SeaweedFsTestConfiguration;
import com.wikiaov.TestcontainersConfiguration;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.testcontainers.junit.jupiter.Testcontainers;

@SpringBootTest
@AutoConfigureMockMvc
@Import({TestcontainersConfiguration.class, SeaweedFsTestConfiguration.class})
@ActiveProfiles("test")
@Testcontainers(disabledWithoutDocker = true)
class RegionIntegrationTest {
    @Autowired
    MockMvc mvc;

    @Test
    void listsSeededMarketsIncludingLockedGlobalWithoutLogin() throws Exception {
        mvc.perform(get("/api/wiki/v1/regions")).andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(5))
                .andExpect(jsonPath("$[0].code").value("VN"))
                .andExpect(jsonPath("$[0].available").value(true))
                .andExpect(jsonPath("$[0].timeZone").value("Asia/Ho_Chi_Minh"))
                .andExpect(jsonPath("$[4].code").value("GLOBAL"))
                .andExpect(jsonPath("$[4].available").value(false))
                .andExpect(jsonPath("$[4].unavailableReason").isNotEmpty());
        mvc.perform(get("/api/wiki/v1/regions/VN")).andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value("VN"));
    }

    @Test
    void rejectsLockedUnknownAndUnexpectedParameters() throws Exception {
        for (String code : new String[] {"TH", "TW", "ID", "GLOBAL", "UNKNOWN"}) {
            mvc.perform(get("/api/wiki/v1/regions/" + code))
                    .andExpect(status().isUnprocessableEntity())
                    .andExpect(jsonPath("$.code").value("UNSUPPORTED_REGION"));
        }
        mvc.perform(get("/api/wiki/v1/regions?locale=vi-VN")).andExpect(status().isBadRequest());
        mvc.perform(get("/api/wiki/v1/regions/VN?timezone=UTC")).andExpect(status().isBadRequest());
    }
}
