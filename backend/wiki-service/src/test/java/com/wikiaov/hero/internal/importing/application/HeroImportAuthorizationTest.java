package com.wikiaov.hero.internal.importing.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.*;

import com.wikiaov.access.AcceptedCommands;
import com.wikiaov.access.Actor;
import com.wikiaov.access.ActorType;
import com.wikiaov.access.AuditLog;
import com.wikiaov.access.CurrentActor;
import com.wikiaov.hero.internal.application.HeroImportJobRequest;
import com.wikiaov.hero.internal.importing.persistence.HeroImportJobRepository;
import com.wikiaov.hero.internal.importing.persistence.HeroUploadSessionRepository;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.function.Executable;
import org.springframework.context.annotation.AnnotationConfigApplicationContext;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.TestingAuthenticationToken;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.core.context.SecurityContextHolder;
import tools.jackson.databind.json.JsonMapper;

/** The import facades guard themselves, so a caller other than their controllers is checked the same way. */
class HeroImportAuthorizationTest {
    private static final Actor EDITOR = new Actor("issuer", "editor", ActorType.HUMAN, null, Set.of("hero:write"));

    @AfterEach
    void clearAuthentication() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void importJobsNeedHeroWriteForEveryUserStep() {
        try (var context = new AnnotationConfigApplicationContext(SecurityTestConfiguration.class)) {
            var jobs = context.getBean(HeroImportJobs.class);
            var repository = context.getBean(HeroImportJobRepository.class);
            UUID id = UUID.randomUUID();

            signInWith("catalog:read");
            assertDenied(() -> jobs.enqueue(new HeroImportJobRequest(id, List.of())));
            assertDenied(jobs::list);
            assertDenied(() -> jobs.get(id));
            assertDenied(() -> jobs.dismissNotification(id));
            verifyNoInteractions(repository);

            signInWith("hero:write");
            assertThat(jobs.list()).isEmpty();
            verify(repository).visible("issuer", "editor");
        }
    }

    @Test
    void theWorkerReadsPendingJobsWithoutASignedInUser() {
        try (var context = new AnnotationConfigApplicationContext(SecurityTestConfiguration.class)) {
            assertThat(context.getBean(HeroImportJobs.class).pending()).isEmpty();
        }
    }

    @Test
    void uploadSessionsNeedHeroWrite() {
        try (var context = new AnnotationConfigApplicationContext(SecurityTestConfiguration.class)) {
            var sessions = context.getBean(HeroUploadSessions.class);
            var repository = context.getBean(HeroUploadSessionRepository.class);
            UUID id = UUID.randomUUID();

            signInWith("catalog:read");
            assertDenied(sessions::list);
            assertDenied(() -> sessions.delete(id));
            verifyNoInteractions(repository);

            signInWith("hero:write");
            assertThat(sessions.list()).isEmpty();
            verify(repository).findByOwnerIssuerAndOwnerSubjectOrderByUpdatedAtDesc("issuer", "editor");
        }
    }

    private static void signInWith(String capability) {
        SecurityContextHolder.getContext()
                .setAuthentication(new TestingAuthenticationToken("editor", "unused", capability));
    }

    private static void assertDenied(Executable call) {
        assertThatThrownBy(call::execute).isInstanceOf(AccessDeniedException.class);
    }

    @Configuration
    @EnableMethodSecurity
    static class SecurityTestConfiguration {
        @Bean
        CurrentActor actors() {
            var actors = mock(CurrentActor.class);
            when(actors.require()).thenReturn(EDITOR);
            return actors;
        }

        @Bean
        HeroImportJobRepository jobRepository() {
            return mock(HeroImportJobRepository.class);
        }

        @Bean
        HeroUploadSessionRepository sessionRepository() {
            return mock(HeroUploadSessionRepository.class);
        }

        @Bean
        HeroImportJobs jobs(HeroImportJobRepository repository, CurrentActor actors) {
            return new HeroImportJobs(repository, actors, mock(AcceptedCommands.class), mock(HeroImports.class),
                    mock(AuditLog.class), JsonMapper.builder().build());
        }

        @Bean
        HeroUploadSessions sessions(HeroUploadSessionRepository repository, CurrentActor actors) {
            return new HeroUploadSessions(repository, actors, mock(AuditLog.class), JsonMapper.builder().build());
        }
    }
}
