package com.wikiaov.query.internal.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.*;

import com.wikiaov.patch.GameplayContexts;
import com.wikiaov.platform.CatalogChangeProvider;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.context.annotation.AnnotationConfigApplicationContext;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.TestingAuthenticationToken;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.core.context.SecurityContextHolder;

class CatalogChangeQueriesAuthorizationTest {
    @AfterEach
    void clearAuthentication() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void readingCatalogChangesNeedsCatalogReadBeforeAnyProviderIsAsked() {
        try (var context = new AnnotationConfigApplicationContext(SecurityTestConfiguration.class)) {
            var changes = context.getBean(CatalogChangeQueries.class);
            var provider = context.getBean(CatalogChangeProvider.class);
            UUID ruleset = UUID.randomUUID();

            signInWith("hero:write");
            assertThatThrownBy(() -> changes.list(ruleset, "vi-VN", "ITEM"))
                    .isInstanceOf(AccessDeniedException.class);
            verify(provider, never()).changes(any(), any(), any());

            signInWith("catalog:read");
            assertThat(changes.list(ruleset, "vi-VN", "ITEM")).isEmpty();
            verify(provider).changes(ruleset, null, "vi-VN");
        }
    }

    private static void signInWith(String capability) {
        SecurityContextHolder.getContext()
                .setAuthentication(new TestingAuthenticationToken("editor", "unused", capability));
    }

    @Configuration
    @EnableMethodSecurity
    static class SecurityTestConfiguration {
        @Bean
        CatalogChangeProvider items() {
            var provider = mock(CatalogChangeProvider.class);
            when(provider.domain()).thenReturn("ITEM");
            when(provider.changes(any(), any())).thenCallRealMethod();
            return provider;
        }

        @Bean
        CatalogChangeQueries changes(List<CatalogChangeProvider> providers) {
            return new CatalogChangeQueries(providers, mock(GameplayContexts.class));
        }
    }
}
