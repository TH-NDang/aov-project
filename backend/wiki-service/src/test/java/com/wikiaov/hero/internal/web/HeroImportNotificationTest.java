package com.wikiaov.hero.internal.web;

import static org.assertj.core.api.Assertions.*;

import com.wikiaov.access.*;
import com.wikiaov.hero.internal.application.HeroErrorCode;
import com.wikiaov.hero.internal.application.service.HeroImportJobs;
import com.wikiaov.hero.internal.persistence.HeroImportJobRepository;
import com.wikiaov.hero.internal.persistence.entity.HeroImportJob;
import com.wikiaov.platform.ApiException;
import java.lang.reflect.Proxy;
import java.util.*;
import org.junit.jupiter.api.*;
import org.springframework.security.access.AccessDeniedException;
import tools.jackson.databind.json.JsonMapper;

class HeroImportNotificationTest {
    private Actor actor;
    private HeroImportJob job;
    private int reads;
    private int writes;
    private final HeroImportJobRepository repository = (HeroImportJobRepository) Proxy.newProxyInstance(
            HeroImportJobRepository.class.getClassLoader(), new Class<?>[] {HeroImportJobRepository.class},
            (proxy, method, args) -> switch (method.getName()) {
                case "findById" -> {
                    reads++;
                    yield job.getId().equals(args[0]) ? Optional.of(job) : Optional.empty();
                }
                case "dismissNotification" -> {
                    writes++;
                    assertThat(args).containsExactly(job.getId(), job.getOwnerIssuer(), job.getOwnerSubject());
                    job.setNotificationDismissed(true);
                    yield 1;
                }
                default -> throw new AssertionError("Unexpected repository operation: " + method.getName());
            });
    private final CurrentActor actors = new CurrentActor() {
        public Optional<Actor> find() {
            return Optional.of(actor);
        }
        public Actor require() {
            return actor;
        }
    };
    private final HeroImportJobs jobs = new HeroImportJobs(repository, actors, null, null, new JsonMapper());

    @BeforeEach
    void setup() {
        job = new HeroImportJob();
        job.setId(UUID.randomUUID());
        job.setOwnerIssuer("issuer");
        job.setOwnerSubject("editor");
        job.setTotal(1);
        job.setCompleted(1);
        job.setResultsJson("[{\"code\":\"airi\",\"succeeded\":true}]");
        actor = new Actor("issuer", "editor", ActorType.HUMAN, null, Set.of("hero:write"));
    }

    @Test
    void dismissalIsIdempotentAndHistoryRemainsReadable() {
        assertThat(jobs.dismissNotification(job.getId()).notificationDismissed()).isTrue();
        assertThat(jobs.dismissNotification(job.getId()).notificationDismissed()).isTrue();
        assertThat(jobs.get(job.getId()).results()).hasSize(1);
        assertThat(writes).isEqualTo(2);
    }

    @Test
    void runningJobsCannotBeDismissed() {
        job.setCompleted(0);
        assertThatThrownBy(() -> jobs.dismissNotification(job.getId()))
                .isInstanceOfSatisfying(ApiException.class,
                        error -> assertThat(error.getErrorCode()).isEqualTo(HeroErrorCode.HERO_IMPORT_JOB_CONFLICT));
        assertThat(job.isNotificationDismissed()).isFalse();
        assertThat(writes).isZero();
    }

    @Test
    void capabilityIsRequiredBeforeAccessingAJob() {
        actor = new Actor("issuer", "editor", ActorType.HUMAN, null, Set.of());
        assertThatThrownBy(() -> jobs.dismissNotification(job.getId())).isInstanceOf(AccessDeniedException.class);
        assertThat(reads).isZero();
        assertThat(writes).isZero();
    }

    @Test
    void issuerAndSubjectMustBothMatch() {
        for (var owner : List.of(new Actor("other", "editor", ActorType.HUMAN, null, Set.of("hero:write")),
                new Actor("issuer", "other", ActorType.HUMAN, null, Set.of("hero:write")))) {
            actor = owner;
            assertThatThrownBy(() -> jobs.dismissNotification(job.getId()))
                    .isInstanceOfSatisfying(ApiException.class,
                            error -> assertThat(error.getErrorCode())
                                    .isEqualTo(HeroErrorCode.HERO_IMPORT_JOB_NOT_FOUND));
        }
        assertThat(writes).isZero();
    }

    @Test
    void missingJobReturnsNotFoundWithoutWriting() {
        assertThatThrownBy(() -> jobs.dismissNotification(UUID.randomUUID()))
                .isInstanceOfSatisfying(ApiException.class,
                        error -> assertThat(error.getErrorCode()).isEqualTo(HeroErrorCode.HERO_IMPORT_JOB_NOT_FOUND));
        assertThat(writes).isZero();
    }
}
