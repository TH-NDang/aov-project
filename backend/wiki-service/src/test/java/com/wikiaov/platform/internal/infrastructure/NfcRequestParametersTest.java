package com.wikiaov.platform.internal.infrastructure;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;

import java.nio.charset.StandardCharsets;
import java.text.Normalizer;
import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

class NfcRequestParametersTest {
    private static final String NAME = "Thủy thủ hồ ly";
    private static final String DECOMPOSED = Normalizer.normalize(NAME, Normalizer.Form.NFD);

    private final MockMvc mvc = MockMvcBuilders.standaloneSetup(new Echo())
            .setControllerAdvice(new NfcRequestParameters()).build();

    @RestController
    static class Echo {
        @GetMapping(path = "/search", produces = "text/plain;charset=UTF-8")
        String search(@RequestParam String q) {
            return q;
        }

        @GetMapping(path = "/folders/{prefix}", produces = "text/plain;charset=UTF-8")
        String folder(@PathVariable String prefix) {
            return prefix;
        }
    }

    @Test
    void aDecomposedSearchTextReachesTheControllerPrecomposed() throws Exception {
        String body = mvc.perform(get("/search").param("q", DECOMPOSED)).andReturn().getResponse()
                .getContentAsString(StandardCharsets.UTF_8);

        assertThat(body).isEqualTo(NAME);
    }

    @Test
    void aDecomposedPathSegmentReachesTheControllerPrecomposed() throws Exception {
        String body = mvc.perform(get("/folders/{prefix}", DECOMPOSED)).andReturn().getResponse()
                .getContentAsString(StandardCharsets.UTF_8);

        assertThat(body).isEqualTo(NAME);
    }
}
