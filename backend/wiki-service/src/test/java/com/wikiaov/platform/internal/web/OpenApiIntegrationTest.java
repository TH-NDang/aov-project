package com.wikiaov.platform.internal.web;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.wikiaov.TestcontainersConfiguration;
import com.wikiaov.platform.CatalogChangeProvider;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.context.ActiveProfiles;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Import(TestcontainersConfiguration.class)
class OpenApiIntegrationTest extends OpenApiContractChecks {
    @Autowired
    List<CatalogChangeProvider> changeProviders;

    @Test
    void documentedCatalogDomainsMatchEveryRegisteredProvider() throws Exception {
        var spec = json.readTree(mvc.perform(get("/api/wiki/v1/admin/openapi")
                .with(jwt().authorities(new SimpleGrantedAuthority("catalog:read"))))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
        assertThat(domainValues(spec, "/api/wiki/v1/admin/catalog-changes"))
                .containsExactlyInAnyOrderElementsOf(
                        changeProviders.stream().map(CatalogChangeProvider::domain).toList());
    }

    @Override
    int expectedHandlerCount() {
        return 175;
    }

    @Override
    boolean persistArtifact() {
        return true;
    }
}
