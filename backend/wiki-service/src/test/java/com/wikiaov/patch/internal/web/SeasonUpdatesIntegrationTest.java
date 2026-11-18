package com.wikiaov.patch.internal.web;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.wikiaov.SeaweedFsTestConfiguration;
import com.wikiaov.TestcontainersConfiguration;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.testcontainers.junit.jupiter.Testcontainers;

/**
 * Runs without a test transaction on purpose: the service must commit its own read-only transaction, which is where a
 * swallowed exception that crossed a transactional proxy turns into UnexpectedRollbackException.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import({TestcontainersConfiguration.class, SeaweedFsTestConfiguration.class})
@ActiveProfiles("test")
@Testcontainers(disabledWithoutDocker = true)
class SeasonUpdatesIntegrationTest {
    @Autowired
    MockMvc mvc;

    @Autowired
    JdbcClient jdbc;

    @Test
    void answersAnEmptySeasonWhenTheRegionHasNoVerifiedGameplayContext() throws Exception {
        long releases = jdbc.sql("""
                select count(*) from patch.patch_release rel join patch.region r on r.id = rel.region_id
                where r.code = 'VN'
                """).query(Long.class).single();
        assertThat(releases).as("VN has no release, as on a freshly deployed database").isZero();

        mvc.perform(get("/api/wiki/v1/seasons/current/updates?region=VN&locale=vi-VN&limit=4"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.region").value("VN"))
                .andExpect(jsonPath("$.requestedLocale").value("vi-VN"))
                .andExpect(jsonPath("$.season").isEmpty())
                .andExpect(jsonPath("$.currentPatchId").isEmpty())
                .andExpect(jsonPath("$.patches").isEmpty());
    }

    @Test
    void keepsRejectingARegionThatIsNotOpen() throws Exception {
        mvc.perform(get("/api/wiki/v1/seasons/current/updates?region=TH"))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value("UNSUPPORTED_REGION"));
    }
}
