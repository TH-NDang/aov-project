package com.wikiaov;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;

@Import(TestcontainersConfiguration.class)
@org.springframework.test.context.ActiveProfiles("test")
@SpringBootTest
class WikiAovApplicationTests {

	@Test
	void contextLoads() {
	}

}

