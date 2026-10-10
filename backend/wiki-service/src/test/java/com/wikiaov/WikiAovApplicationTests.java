package com.wikiaov;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.testcontainers.junit.jupiter.Testcontainers;

@Import(TestcontainersConfiguration.class)
@org.springframework.test.context.ActiveProfiles("test")
@SpringBootTest
@Testcontainers(disabledWithoutDocker = true)
class WikiAovApplicationTests {

    @Test
    void contextLoads() {
    }

}
