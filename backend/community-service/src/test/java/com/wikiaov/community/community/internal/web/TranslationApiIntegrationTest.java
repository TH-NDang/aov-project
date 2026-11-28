package com.wikiaov.community.community.internal.web;

import static com.wikiaov.community.testsupport.ApiCalls.ADMIN;
import static com.wikiaov.community.testsupport.ApiCalls.ROOT;
import static com.wikiaov.community.testsupport.ApiCalls.as;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.ArgumentMatchers.notNull;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

import com.wikiaov.community.community.internal.translation.application.port.GlossarySource;
import com.wikiaov.community.community.internal.translation.application.port.PostImages;
import com.wikiaov.community.community.internal.translation.application.port.PostTranslator;
import com.wikiaov.community.community.internal.translation.domain.Glossary;
import com.wikiaov.community.community.internal.translation.domain.TranslatedPost;
import com.wikiaov.community.testsupport.ApiCalls;
import com.wikiaov.community.testsupport.CommunityApplicationTest;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.json.JsonMapper;

/** Stream posts read in another language, with the Claude API, wiki-service and the image host stubbed (ADR-037). */
@CommunityApplicationTest
@TestPropertySource(properties = {"community.translation.api-key=test-key",
        "community.translation.hourly-per-requester=1000"})
class TranslationApiIntegrationTest {
    private static final String EDITOR = "editor";
    private static final String[] CAPABILITIES = {"tournament:read", "tournament:write", "tournament:publish"};

    @Autowired
    MockMvc mvc;
    @Autowired
    JsonMapper json;
    @MockitoBean
    JwtDecoder decoder;
    @MockitoBean
    PostTranslator translator;
    @MockitoBean
    GlossarySource glossary;
    @MockitoBean
    PostImages images;

    private ApiCalls api;

    @BeforeEach
    void stub() {
        api = new ApiCalls(mvc, json);
        when(glossary.glossary()).thenReturn(Glossary.of(List.of(new Glossary.Term("spell:1", "spell",
                Map.of("vi-VN", new Glossary.Names("Trừng trị", List.of()), "en-US",
                        new Glossary.Names("Punish", List.of())))),
                Set.of()));
        when(images.load(anyList())).thenAnswer(call -> ((List<?>) call.getArgument(0)).stream()
                .map(url -> Optional.of(new PostTranslator.Image(new byte[] {1}, "image/png"))).toList());
    }

    @Test
    void translationIsOnWithTheLanguagesOfStream() throws Exception {
        var status = api.send(get(ROOT + "/translation"), null, 200);

        assertThat(status.path("enabled").asBoolean()).isTrue();
        assertThat(status.path("locales").toString()).contains("vi-VN").contains("en-US");
    }

    @Test
    void aPostIsTranslatedOnceAndThenReadFromStore() throws Exception {
        String post = publishedPost("Nhớ mang Trừng trị khi đi rừng nha anh em", List.of());
        when(translator.translate(eq("en-US"), anyString(), anyString(), anyList(), isNull())).thenReturn(result(
                "Remember to bring Punish when you jungle, guys", List.of()));

        var first = api.send(get(ROOT + "/posts/" + post + "/translation").param("locale", "en-US"), null, 200);
        var second = api.send(get(ROOT + "/posts/" + post + "/translation").param("locale", "en-US"), null, 200);

        assertThat(first.path("body").asString()).isEqualTo("Remember to bring Punish when you jungle, guys");
        assertThat(first.path("sourceLanguage").asString()).isEqualTo("vi-VN");
        assertThat(first.path("sameLanguage").asBoolean()).isFalse();
        assertThat(first.path("model").asString()).isEqualTo("claude-haiku-5-5");
        assertThat(second.path("body").asString()).isEqualTo(first.path("body").asString());
        verify(translator, times(1)).translate(eq("en-US"), anyString(), anyString(), anyList(), any());
    }

    @Test
    void theGlossaryGoesIntoThePromptAndAFailedCheckIsRetriedOnce() throws Exception {
        String post = publishedPost("Nhớ mang Trừng trị nha", List.of());
        when(translator.translate(eq("en-US"), anyString(), anyString(), anyList(), isNull()))
                .thenReturn(result("Remember to bring Retribution", List.of()));
        when(translator.translate(eq("en-US"), anyString(), anyString(), anyList(), notNull()))
                .thenReturn(result("Remember to bring Punish", List.of()));

        var answer = api.send(get(ROOT + "/posts/" + post + "/translation").param("locale", "en-US"), null, 200);

        assertThat(answer.path("body").asString()).isEqualTo("Remember to bring Punish");
        verify(translator).translate(eq("en-US"), org.mockito.ArgumentMatchers.contains("Trừng trị -> Punish"),
                anyString(), anyList(), isNull());
        verify(translator).translate(eq("en-US"), anyString(), anyString(), anyList(), notNull());
    }

    @Test
    void imageTextsComeBackInThePostOrder() throws Exception {
        String post = publishedPost("Shop mới nè", List.of("https://img.athahub.com/assets/a.png"));
        when(translator.translate(eq("en-US"), anyString(), anyString(), anyList(), isNull())).thenReturn(result(
                "New shop", List.of(new TranslatedPost.ImageText(0, true, "vi-VN", "The shop sells a skin."))));

        var answer = api.send(get(ROOT + "/posts/" + post + "/translation").param("locale", "en-US"), null, 200);

        assertThat(answer.path("images").get(0).path("text").asString()).isEqualTo("The shop sells a skin.");
        assertThat(answer.path("images").get(0).path("hasText").asBoolean()).isTrue();
    }

    @Test
    void aPostAlreadyInTheLanguageIsAnsweredWithoutTheModel() throws Exception {
        String post = publishedPost("Nhớ mang Trừng trị khi đi rừng nha anh em", List.of());

        var answer = api.send(get(ROOT + "/posts/" + post + "/translation").param("locale", "vi-VN"), null, 200);

        assertThat(answer.path("sameLanguage").asBoolean()).isTrue();
        assertThat(answer.path("body").asString()).isEqualTo("Nhớ mang Trừng trị khi đi rừng nha anh em");
        verify(translator, never()).translate(anyString(), anyString(), anyString(), anyList(), any());
    }

    @Test
    void otherLanguagesAndUnknownPostsAreRefused() throws Exception {
        String post = publishedPost("Xin chào mọi người", List.of());

        var refused = api.send(get(ROOT + "/posts/" + post + "/translation").param("locale", "th-TH"), null, 400);
        assertThat(refused.path("code").asString()).isEqualTo("TRANSLATION_UNSUPPORTED_LOCALE");
        api.send(get(ROOT + "/posts/" + UUID.randomUUID() + "/translation").param("locale", "en-US"), null, 404);
        api.send(get(ROOT + "/posts/" + post + "/translation").param("locale", "en-US").param("x", "1"), null,
                400);
    }

    @Test
    void aFailingModelIsABadGateway() throws Exception {
        String post = publishedPost("Hôm nay leo rank mệt quá anh em ơi", List.of());
        when(translator.translate(anyString(), anyString(), anyString(), anyList(), any()))
                .thenThrow(new PostTranslator.Failed("overloaded", null));

        var failed = api.send(get(ROOT + "/posts/" + post + "/translation").param("locale", "en-US"), null, 502);

        assertThat(failed.path("code").asString()).isEqualTo("TRANSLATION_FAILED");
    }

    private static PostTranslator.Result result(String body, List<TranslatedPost.ImageText> imageTexts) {
        return new PostTranslator.Result(new TranslatedPost("vi-VN", null, body, imageTexts), "{}",
                "claude-haiku-5-5", 900, 120);
    }

    private String publishedPost(String body, List<String> imageUrls) throws Exception {
        var created = api.send(as(post(ADMIN + "/pages"), EDITOR, CAPABILITIES), Map.of("kind", "ORGANIZATION",
                "code", "org-" + UUID.randomUUID(), "content", Map.of("name", "Test organization", "sources",
                        List.of(Map.of("label", "Official", "url", "https://example.com")))),
                200);
        var page = created.path("id").asString();
        api.send(as(post(ADMIN + "/pages/" + page + "/publish"), EDITOR, CAPABILITIES),
                Map.of("version", created.path("version").asLong()), 200);
        var posted = api.send(as(post(ROOT + "/me/pages/" + page + "/posts"), "author"),
                Map.of("body", body, "asPage", false, "publish", true, "imageUrls", imageUrls), 200);
        return posted.path("id").asString();
    }
}
