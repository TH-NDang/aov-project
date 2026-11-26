package com.wikiaov.patch.internal.web;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.wikiaov.DockerBacked;
import com.wikiaov.MutableClock;
import com.wikiaov.TestcontainersConfiguration;
import com.wikiaov.patch.internal.watch.application.port.PatchNoteFeed;
import com.wikiaov.patch.internal.watch.application.port.PatchNoteFeed.Answer;
import com.wikiaov.patch.internal.watch.application.port.PatchNoteFeedException;
import com.wikiaov.patch.internal.watch.domain.FoundPatchNote;
import com.wikiaov.patch.internal.watch.domain.PatchNoteChannel;
import com.wikiaov.patch.internal.watch.domain.PatchNoteFailure;
import com.wikiaov.patch.internal.watch.domain.PatchNoteSource;
import java.time.Duration;
import java.time.Instant;
import java.util.Arrays;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Primary;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.annotation.DirtiesContext.ClassMode;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/** ADR-035: the check stores each post once, the inbox moves at the version seen, and schedules are set per source. */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Import({TestcontainersConfiguration.class, PatchWatchIntegrationTest.Beans.class})
@DirtiesContext(classMode = ClassMode.AFTER_CLASS)
@DockerBacked
class PatchWatchIntegrationTest {
    private static final String ROOT = "/api/wiki/v1/admin/patch-watch";
    private static final Instant NOW = Instant.parse("2026-11-26T03:30:00Z");

    @TestConfiguration
    static class Beans {
        @Bean
        @Primary
        MutableClock patchWatchClock() {
            return new MutableClock(NOW);
        }
    }

    @Autowired
    MockMvc mvc;
    @Autowired
    JsonMapper json;
    @Autowired
    JdbcClient jdbc;
    @Autowired
    MutableClock clock;
    @MockitoBean
    PatchNoteFeed feed;

    @BeforeEach
    void reset() {
        clock.set(NOW);
        jdbc.sql("TRUNCATE patch.note_post, patch.note_source_check").update();
        when(feed.read(any(), any())).thenReturn(Answer.unchanged());
        when(feed.title(anyString())).thenReturn(null);
    }

    @Test
    void aCheckListsRecentPostsAsNewAndOldOnesAsHistoryOnlyOnce() throws Exception {
        when(feed.read(eq(PatchNoteSource.ROV_TH), any())).thenReturn(new Answer(false, List.of(
                found("expserver261117", "https://www.rov.in.th/patch-notes/expserver261117", null,
                        PatchNoteChannel.EXPERIMENTAL, NOW.minus(Duration.ofDays(9))),
                found("beta50", "https://www.rov.in.th/patch-notes/beta50", null, PatchNoteChannel.OFFICIAL,
                        NOW.minus(Duration.ofDays(400)))),
                "\"v1\"", null));
        when(feed.title("https://www.rov.in.th/patch-notes/expserver261117")).thenReturn("Máy chủ thử nghiệm 17/11");

        mvc.perform(post(ROOT + "/checks").with(editor())).andExpect(status().isOk())
                .andExpect(jsonPath("$.newCount").value(1))
                .andExpect(jsonPath("$.sources[?(@.code == 'ROV_TH')].lastSuccessAt").isNotEmpty())
                .andExpect(jsonPath("$.sources[?(@.code == 'GARENA_ID')].readable").value(false));
        mvc.perform(get(ROOT + "/posts").param("state", "NEW").with(reader())).andExpect(status().isOk())
                .andExpect(jsonPath("$.items.length()").value(1))
                .andExpect(jsonPath("$.items[0].title").value("Máy chủ thử nghiệm 17/11"))
                .andExpect(jsonPath("$.items[0].channel").value("EXPERIMENTAL"))
                .andExpect(jsonPath("$.items[0].region").value("TH"));
        mvc.perform(get(ROOT + "/posts").with(reader())).andExpect(jsonPath("$.totalElements").value(2));

        clock.advance(Duration.ofMinutes(3));
        mvc.perform(post(ROOT + "/checks").with(editor())).andExpect(status().isOk());

        assertThat(jdbc.sql("SELECT count(*) FROM patch.note_post").query(Long.class).single()).isEqualTo(2);
    }

    @Test
    void aFailedReadIsShownAndRetriedSoonerThanTheNextMorning() throws Exception {
        when(feed.read(eq(PatchNoteSource.MOBA_TW), any()))
                .thenThrow(new PatchNoteFeedException(PatchNoteFailure.HTTP_STATUS, 503));

        JsonNode overview = read(mvc.perform(post(ROOT + "/checks").with(editor())).andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString());

        JsonNode tw = source(overview, "MOBA_TW");
        assertThat(tw.get("failure").asText()).isEqualTo("HTTP_STATUS");
        assertThat(tw.get("failureStatus").asInt()).isEqualTo(503);
        assertThat(Instant.parse(tw.get("nextCheckAt").asText())).isEqualTo(NOW.plus(Duration.ofMinutes(30)));
        assertThat(Instant.parse(source(overview, "LIENQUAN_VN").get("nextCheckAt").asText()))
                .isEqualTo(Instant.parse("2026-11-27T01:00:00Z"));
    }

    @Test
    void anEditorMovesAPostAtTheVersionTheySaw() throws Exception {
        JsonNode added = read(mvc.perform(post(ROOT + "/posts").with(editor()).contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {"url":"https://main.aov.garena.co.id/post/patch-notes26nov26-en",
                         "title":"Patch Notes 26 November 2026 [EN]","region":"ID","channel":"OFFICIAL"}
                        """)).andExpect(status().isCreated()).andReturn().getResponse().getContentAsString());
        String id = added.get("id").asText();

        mvc.perform(put(ROOT + "/posts/" + id + "/state").with(editor()).contentType(MediaType.APPLICATION_JSON)
                .content("{\"state\":\"DONE\",\"expectedVersion\":0}")).andExpect(status().isOk())
                .andExpect(jsonPath("$.state").value("DONE")).andExpect(jsonPath("$.version").value(1));
        mvc.perform(put(ROOT + "/posts/" + id + "/state").with(editor()).contentType(MediaType.APPLICATION_JSON)
                .content("{\"state\":\"NEW\",\"expectedVersion\":0}")).andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("PATCH_NOTE_POST_CONFLICT"));
        mvc.perform(put(ROOT + "/posts/" + id + "/state").with(editor()).contentType(MediaType.APPLICATION_JSON)
                .content("{\"state\":\"EARLIER\",\"expectedVersion\":1}")).andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value("PATCH_NOTE_POST_INVALID"));
        mvc.perform(put(ROOT + "/posts/" + id + "/state").with(reader()).contentType(MediaType.APPLICATION_JSON)
                .content("{\"state\":\"DISMISSED\",\"expectedVersion\":1}")).andExpect(status().isForbidden());
    }

    @Test
    void theSameLinkCannotBeAddedTwice() throws Exception {
        String body = """
                {"url":"https://main.aov.garena.co.id/post/patch-notes17nov26-en","title":"17/11",
                 "region":"ID","channel":"OFFICIAL"}
                """;
        mvc.perform(post(ROOT + "/posts").with(editor()).contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isCreated());

        mvc.perform(post(ROOT + "/posts").with(editor()).contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("PATCH_NOTE_POST_DUPLICATE"));
        mvc.perform(post(ROOT + "/posts").with(editor()).contentType(MediaType.APPLICATION_JSON).content("""
                {"url":"javascript:alert(1)","title":"x","region":"ID","channel":"OFFICIAL"}
                """)).andExpect(status().isUnprocessableEntity());
    }

    @Test
    void aScheduleTakesEffectFromNow() throws Exception {
        JsonNode overview = read(mvc.perform(get(ROOT).with(reader())).andExpect(status().isOk()).andReturn()
                .getResponse().getContentAsString());
        assertThat(source(overview, "LIENQUAN_VN").get("mode").asText()).isEqualTo("DAILY");
        assertThat(source(overview, "LIENQUAN_VN").get("dailyAt").asText()).startsWith("08:00");
        assertThat(overview.get("zone").asText()).isEqualTo("Asia/Ho_Chi_Minh");

        mvc.perform(put(ROOT + "/sources/LIENQUAN_VN/schedule").with(editor()).contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {"mode":"EVERY_HOURS","dailyAt":"08:00","everyHours":3,"paused":false,"expectedVersion":0}
                        """)).andExpect(status().isOk()).andExpect(jsonPath("$.mode").value("EVERY_HOURS"))
                .andExpect(jsonPath("$.nextCheckAt").value("2026-11-26T06:30:00Z"));
        mvc.perform(put(ROOT + "/sources/MOBA_TW/schedule").with(editor()).contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {"mode":"DAILY","dailyAt":"21:30","everyHours":6,"paused":true,"expectedVersion":0}
                        """)).andExpect(status().isOk()).andExpect(jsonPath("$.paused").value(true))
                .andExpect(jsonPath("$.nextCheckAt").doesNotExist());
        mvc.perform(put(ROOT + "/sources/MOBA_TW_EXP/schedule").with(editor()).contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {"mode":"EVERY_HOURS","dailyAt":"08:00","everyHours":0,"paused":false,"expectedVersion":0}
                        """)).andExpect(status().isBadRequest());
        mvc.perform(put(ROOT + "/sources/MANUAL/schedule").with(editor()).contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {"mode":"DAILY","dailyAt":"08:00","everyHours":6,"paused":false,"expectedVersion":0}
                        """)).andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value("PATCH_NOTE_SCHEDULE_INVALID"));
    }

    private static FoundPatchNote found(String id, String url, String title, PatchNoteChannel channel,
            Instant publishedAt) {
        return new FoundPatchNote(id, url, title, channel, publishedAt);
    }

    private JsonNode read(String body) {
        return json.readTree(body);
    }

    private static JsonNode source(JsonNode overview, String code) {
        for (JsonNode source : overview.get("sources")) {
            if (source.get("code").asText().equals(code)) {
                return source;
            }
        }
        throw new AssertionError("No source " + code);
    }

    private RequestPostProcessor reader() {
        return actor("catalog:read");
    }

    private RequestPostProcessor editor() {
        return actor("catalog:read", "patch:write");
    }

    private RequestPostProcessor actor(String... capabilities) {
        return jwt().authorities(Arrays.stream(capabilities).map(SimpleGrantedAuthority::new)
                .toArray(GrantedAuthority[]::new));
    }
}
