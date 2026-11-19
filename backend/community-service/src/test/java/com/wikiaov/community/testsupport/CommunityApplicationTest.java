package com.wikiaov.community.testsupport;

import java.lang.annotation.Documented;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;

/**
 * The whole service on the shared PostgreSQL, driven through MockMvc. Every {@code *IntegrationTest} that starts the
 * application uses this instead of its own container set-up.
 */
@Target(ElementType.TYPE)
@Retention(RetentionPolicy.RUNTIME)
@Documented
@DockerBacked
@SpringBootTest
@AutoConfigureMockMvc
@Import(PostgresTestConfiguration.class)
public @interface CommunityApplicationTest {
}
