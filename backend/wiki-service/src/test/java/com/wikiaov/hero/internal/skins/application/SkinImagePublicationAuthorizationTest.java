package com.wikiaov.hero.internal.skins.application;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.*;

import com.wikiaov.access.AuditLog;
import com.wikiaov.access.CurrentActor;
import com.wikiaov.hero.internal.application.SkinImagePublicationRequest;
import com.wikiaov.hero.internal.authoring.application.HeroValidation;
import com.wikiaov.hero.internal.authoring.persistence.HeroStore;
import com.wikiaov.hero.internal.catalog.application.HeroQueries;
import com.wikiaov.hero.internal.sections.persistence.HeroSections;
import com.wikiaov.patch.GameplayContexts;
import java.time.Clock;
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

class SkinImagePublicationAuthorizationTest {
    @AfterEach
    void clearAuthentication() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void requiresBothEditingAndPublicationCapabilitiesBeforeTouchingHeroData() {
        try (var context = new AnnotationConfigApplicationContext(SecurityTestConfiguration.class)) {
            var publications = context.getBean(SkinImagePublications.class);
            var store = context.getBean(HeroStore.class);
            var request = new SkinImagePublicationRequest(UUID.randomUUID(), UUID.randomUUID(), 1, "VN", null);
            UUID heroId = UUID.randomUUID();

            for (var capability : new String[] {"hero:write", "hero:publish"}) {
                SecurityContextHolder.getContext().setAuthentication(
                        new TestingAuthenticationToken("editor", "unused", capability));
                assertThatThrownBy(() -> publications.publish(heroId, request))
                        .isInstanceOf(AccessDeniedException.class);
            }

            verifyNoInteractions(store);
        }
    }

    @Configuration
    @EnableMethodSecurity
    static class SecurityTestConfiguration {
        @Bean
        HeroStore store() {
            return mock(HeroStore.class);
        }

        @Bean
        SkinImagePublications publications(HeroStore store) {
            return new SkinImagePublications(store, mock(HeroSections.class), mock(HeroQueries.class),
                    mock(GameplayContexts.class), mock(HeroValidation.class), mock(CurrentActor.class),
                    mock(AuditLog.class), Clock.systemUTC());
        }
    }
}
