package com.wikiaov.hero.internal.importing.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.wikiaov.access.Actor;
import com.wikiaov.access.ActorType;
import com.wikiaov.access.AuditEntry;
import com.wikiaov.access.CurrentActor;
import com.wikiaov.hero.internal.importing.persistence.HeroUploadSessionRepository;
import com.wikiaov.hero.internal.importing.persistence.entity.HeroUploadSession;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.json.JsonMapper;

class HeroUploadSessionsTest {
    private static final Actor EDITOR = new Actor("issuer", "editor", ActorType.HUMAN, null, Set.of("hero:write"));
    private static final String MANIFEST = """
            {"schemaVersion": 1, "label": "%s", "entries": [{"code": "airi"}], "images": {}}
            """;

    private final JsonMapper json = JsonMapper.builder().build();
    private final HeroUploadSessionRepository repository = mock(HeroUploadSessionRepository.class);
    private final CurrentActor actors = mock(CurrentActor.class);
    private final List<AuditEntry> audited = new ArrayList<>();
    private final HeroUploadSessions sessions = new HeroUploadSessions(repository, actors, audited::add, json);
    private final HeroUploadSession session = new HeroUploadSession();

    HeroUploadSessionsTest() {
        when(actors.require()).thenReturn(EDITOR);
        session.setId(UUID.randomUUID());
        session.setOwnerIssuer("issuer");
        session.setOwnerSubject("editor");
        session.setVersion(3);
        session.setStateJson(MANIFEST.formatted("before"));
        when(repository.lock(session.getId())).thenReturn(Optional.of(session));
    }

    @Test
    void savingAChangedSessionIsAuditedWithItsVersions() {
        sessions.save(session.getId(), 3, json.readTree(MANIFEST.formatted("after")));

        assertThat(audited).singleElement().satisfies(entry -> {
            assertThat(entry.action()).isEqualTo("HERO_UPLOAD_SESSION_SAVED");
            assertThat(entry.beforeVersion()).isEqualTo(3);
            assertThat(entry.afterVersion()).isEqualTo(4);
        });
    }

    @Test
    void savingAnUnchangedSessionRecordsNothing() {
        sessions.save(session.getId(), 3, json.readTree(MANIFEST.formatted("before")));

        assertThat(audited).isEmpty();
    }

    @Test
    void deletingASessionIsAudited() {
        sessions.delete(session.getId());

        assertThat(audited).extracting(AuditEntry::action).containsExactly("HERO_UPLOAD_SESSION_DELETED");
    }
}
