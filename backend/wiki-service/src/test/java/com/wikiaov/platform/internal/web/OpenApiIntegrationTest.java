package com.wikiaov.platform.internal.web;

import com.wikiaov.TestcontainersConfiguration;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.ActiveProfiles;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Import(TestcontainersConfiguration.class)
class OpenApiIntegrationTest extends OpenApiContractChecks {
    @Override
    boolean persistArtifact() {
        return true;
    }
}
