package com.wikiaov;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.ActiveProfiles;

@Import(TestcontainersConfiguration.class)
@ActiveProfiles("test")
@SpringBootTest
@DockerBacked
class WikiAovApplicationIntegrationTest {

    @Test
    void contextLoads() {
    }

}
