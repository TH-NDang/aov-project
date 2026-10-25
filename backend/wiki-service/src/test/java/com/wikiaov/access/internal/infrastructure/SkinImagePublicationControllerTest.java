package com.wikiaov.access.internal.infrastructure;

import static org.mockito.Mockito.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.wikiaov.hero.internal.application.SkinImagePublicationRequest;
import com.wikiaov.hero.internal.skins.application.SkinImagePublications;
import com.wikiaov.hero.internal.web.SkinImagePublicationController;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(controllers = SkinImagePublicationController.class)
@Import({SkinImagePublicationController.class, SecurityConfiguration.class, ProblemAuthenticationEntryPoint.class,
        ProblemAccessDeniedHandler.class, ProblemResponseWriter.class})
@ActiveProfiles("test")
class SkinImagePublicationControllerTest {
    @Autowired
    MockMvc mvc;

    @MockitoBean
    SkinImagePublications publications;

    @MockitoBean
    JwtDecoder jwtDecoder;

    private final UUID heroId = UUID.randomUUID();
    private final UUID sourceId = UUID.randomUUID();
    private final UUID draftId = UUID.randomUUID();

    @Test
    void bindsTheExplicitSourceAndVersionWithoutAcceptingUnknownQueryParameters() throws Exception {
        mvc.perform(post(path()).with(jwt().authorities(new SimpleGrantedAuthority("catalog:read")))
                .contentType(MediaType.APPLICATION_JSON).content(body()))
                .andExpect(status().isOk());

        verify(publications).publish(heroId, new SkinImagePublicationRequest(sourceId, draftId, 3, "VN", null));
        clearInvocations(publications);

        mvc.perform(post(path() + "?includeDrafts=true")
                .with(jwt().authorities(new SimpleGrantedAuthority("catalog:read")))
                .contentType(MediaType.APPLICATION_JSON).content(body()))
                .andExpect(status().isBadRequest());
        verifyNoInteractions(publications);
    }

    @Test
    void requiresAuthenticationAndCatalogAccessBeforeTheUseCase() throws Exception {
        mvc.perform(post(path()).contentType(MediaType.APPLICATION_JSON).content(body()))
                .andExpect(status().isUnauthorized());
        mvc.perform(post(path()).with(jwt().authorities(new SimpleGrantedAuthority("unrelated")))
                .contentType(MediaType.APPLICATION_JSON).content(body()))
                .andExpect(status().isForbidden());

        verifyNoInteractions(publications);
    }

    @Test
    void rejectsMissingSourceAndInvalidVersions() throws Exception {
        mvc.perform(post(path()).with(jwt().authorities(new SimpleGrantedAuthority("catalog:read")))
                .contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isBadRequest());

        verifyNoInteractions(publications);
    }

    private String path() {
        return "/api/wiki/v1/admin/heroes/" + heroId + "/skin-images/publish";
    }

    private String body() {
        return """
                {"sourceRevisionId":"%s","imageSourceRevisionId":"%s","expectedImageSourceVersion":3,"region":"VN"}
                """.formatted(sourceId, draftId);
    }
}
