package com.wikiaov.hero.internal.importing.application;

import com.wikiaov.access.AuditEntry;
import com.wikiaov.access.AuditLog;
import com.wikiaov.access.CurrentActor;
import com.wikiaov.hero.internal.application.HeroErrorCode;
import com.wikiaov.hero.internal.application.response.HeroUploadSessionView;
import com.wikiaov.hero.internal.importing.persistence.HeroUploadSessionRepository;
import com.wikiaov.hero.internal.importing.persistence.entity.HeroUploadSession;
import com.wikiaov.platform.ApiException;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.*;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

@Service
@PreAuthorize("hasAuthority('hero:write')")
public class HeroUploadSessions {
    private static final String AGGREGATE = "HERO_UPLOAD_SESSION";

    private final HeroUploadSessionRepository repository;
    private final CurrentActor actors;
    private final AuditLog audit;
    private final JsonMapper json;

    public HeroUploadSessions(HeroUploadSessionRepository repository, CurrentActor actors, AuditLog audit,
            JsonMapper json) {
        this.repository = repository;
        this.actors = actors;
        this.audit = audit;
        this.json = json;
    }

    @Transactional
    public HeroUploadSessionView save(UUID id, long version, JsonNode state) {
        String payload = json.writeValueAsString(state);
        if (!state.isObject() || payload.getBytes(StandardCharsets.UTF_8).length > 5 * 1024 * 1024)
            throw new ApiException(HeroErrorCode.HERO_INVALID_CONTENT, "Upload session must be an object within 5 MB.");
        if (state.path("schemaVersion").asInt() != 1 || !state.path("label").isString()
                || !state.path("entries").isArray() || state.path("entries").size() < 1
                || state.path("entries").size() > 200 || !state.path("images").isObject())
            throw new ApiException(HeroErrorCode.HERO_INVALID_CONTENT, "Invalid upload session manifest.");

        var actor = actors.require();
        if (version == -1 && repository.create(id, actor.issuer(), actor.subject(), payload) == 1)
            audit.record(new AuditEntry(actor, "HERO_UPLOAD_SESSION_CREATED", AGGREGATE, id, null, null, 0L, null,
                    Map.of()));

        var session = owned(id);
        if (json.readTree(session.getStateJson()).equals(state))
            return view(session);
        if (session.getVersion() != version)
            throw new ApiException(HeroErrorCode.HERO_IMPORT_JOB_CONFLICT,
                    "Upload session changed. Reload before resuming.");

        session.setStateJson(payload);
        session.setVersion(version + 1);
        session.setUpdatedAt(Instant.now());

        audit.record(new AuditEntry(actor, "HERO_UPLOAD_SESSION_SAVED", AGGREGATE, id, null, version, version + 1,
                null, Map.of()));
        return view(session);
    }

    @Transactional(readOnly = true)
    public List<HeroUploadSessionView> list() {
        var actor = actors.require();
        return repository.findByOwnerIssuerAndOwnerSubjectOrderByUpdatedAtDesc(actor.issuer(), actor.subject())
                .stream().map(this::view).toList();
    }

    @Transactional
    public void delete(UUID id) {
        var session = owned(id);

        repository.delete(session);
        audit.record(new AuditEntry(actors.require(), "HERO_UPLOAD_SESSION_DELETED", AGGREGATE, id, null,
                session.getVersion(), null, null, Map.of()));
    }

    private HeroUploadSession owned(UUID id) {
        var actor = actors.require();
        return repository.lock(id)
                .filter(s -> s.getOwnerIssuer().equals(actor.issuer()) && s.getOwnerSubject().equals(actor.subject()))
                .orElseThrow(
                        () -> new ApiException(HeroErrorCode.HERO_IMPORT_JOB_NOT_FOUND, "Upload session not found."));
    }

    private HeroUploadSessionView view(HeroUploadSession session) {
        return new HeroUploadSessionView(session.getId(), session.getVersion(), session.getUpdatedAt(),
                json.readTree(session.getStateJson()));
    }
}
