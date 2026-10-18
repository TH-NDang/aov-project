package com.wikiaov.hero.internal.application.service;

import com.wikiaov.access.*;
import com.wikiaov.hero.internal.application.*;
import com.wikiaov.hero.internal.application.response.HeroImportJobView;
import com.wikiaov.hero.internal.application.response.HeroImportJobView.Row;
import com.wikiaov.hero.internal.persistence.HeroImportJobRepository;
import com.wikiaov.hero.internal.persistence.entity.HeroImportJob;
import com.wikiaov.platform.ApiException;
import java.time.Instant;
import java.util.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.json.JsonMapper;

@Service
public class HeroImportJobs {
    private final HeroImportJobRepository repository;
    private final CurrentActor actors;
    private final AcceptedCommands accepted;
    private final HeroImports imports;
    private final JsonMapper json;
    public HeroImportJobs(HeroImportJobRepository repository, CurrentActor actors, AcceptedCommands accepted,
            HeroImports imports, JsonMapper json) {
        this.repository = repository;
        this.actors = actors;
        this.accepted = accepted;
        this.imports = imports;
        this.json = json;
    }
    @Transactional
    public HeroImportJobView enqueue(HeroImportJobRequest request) {
        var actor = actors.require();
        if (!actor.has("hero:write"))
            throw new org.springframework.security.access.AccessDeniedException("Hero write required");
        String payload = json.writeValueAsString(request.rows());
        if (payload.getBytes(java.nio.charset.StandardCharsets.UTF_8).length > 5 * 1024 * 1024
                || request.rows().stream().map(HeroImportRequest::code).distinct().count() != request.rows().size()) {
            throw new ApiException(HeroErrorCode.HERO_INVALID_CONTENT,
                    "Import must have unique codes and fit within 5 MB.");
        }
        repository.enqueue(request.id(), actor.issuer(), actor.subject(), actor.type().name(), payload,
                request.rows().size());
        var job = owned(request.id());
        if (!json.readTree(job.getRequestJson()).equals(json.readTree(payload))) {
            throw new ApiException(HeroErrorCode.HERO_IMPORT_JOB_CONFLICT,
                    "This import ID already has different data.");
        }
        return view(job);
    }
    @Transactional(readOnly = true)
    public List<HeroImportJobView> list() {
        var actor = actors.require();
        return repository.visible(actor.issuer(), actor.subject())
                .stream().map(this::view).toList();
    }
    @Transactional(readOnly = true)
    public HeroImportJobView get(UUID id) {
        return view(owned(id));
    }
    @Transactional
    public HeroImportJobView dismissNotification(UUID id) {
        var actor = actors.require();
        if (!actor.has("hero:write"))
            throw new org.springframework.security.access.AccessDeniedException("Hero write required");
        var job = owned(id);
        if (job.getCompleted() < job.getTotal()
                || repository.dismissNotification(id, actor.issuer(), actor.subject()) != 1) {
            throw new ApiException(HeroErrorCode.HERO_IMPORT_JOB_CONFLICT,
                    "A running import notification cannot be dismissed.");
        }
        return view(owned(id));
    }
    private HeroImportJob owned(UUID id) {
        var actor = actors.require();
        return repository.findById(id)
                .filter(j -> j.getOwnerIssuer().equals(actor.issuer()) && j.getOwnerSubject().equals(actor.subject()))
                .orElseThrow(() -> new ApiException(HeroErrorCode.HERO_IMPORT_JOB_NOT_FOUND, "Import job not found."));
    }
    public record Pending(
            UUID id,
            int index
    ) {
    }
    @Transactional(readOnly = true)
    public List<Pending> pending() {
        return repository.pending().stream().map(j -> new Pending(j.getId(), j.getCompleted())).toList();
    }
    /** Row changes and progress commit together; an interrupted transaction is safe to retry. */
    @Transactional
    public void execute(Pending pending) {
        var job = repository.lock(pending.id()).orElse(null);
        if (job == null || job.getCompleted() != pending.index() || job.getCompleted() == job.getTotal())
            return;
        var input = inputs(job)[pending.index()];
        var owner = new Actor(job.getOwnerIssuer(), job.getOwnerSubject(), ActorType.valueOf(job.getOwnerType()), null,
                Set.of());
        accepted.runHeroImport(owner, () -> imports.apply(input));
        finish(job, new Row(input.code(), true, null, null));
    }
    @Transactional
    public void failed(Pending pending, String code, String detail) {
        var job = repository.lock(pending.id()).orElse(null);
        if (job == null || job.getCompleted() != pending.index() || job.getCompleted() == job.getTotal())
            return;
        finish(job, new Row(inputs(job)[pending.index()].code(), false, code, detail));
    }
    private HeroImportRequest[] inputs(HeroImportJob job) {
        return json.readValue(job.getRequestJson(), HeroImportRequest[].class);
    }
    private List<Row> results(HeroImportJob job) {
        return new ArrayList<>(Arrays.asList(json.readValue(job.getResultsJson(), Row[].class)));
    }
    private void finish(HeroImportJob job, Row result) {
        var rows = results(job);
        rows.add(result);
        job.setResultsJson(json.writeValueAsString(rows));
        job.setCompleted(rows.size());
        job.setUpdatedAt(Instant.now());
    }
    private HeroImportJobView view(HeroImportJob job) {
        var rows = results(job);
        String status = job.getCompleted() < job.getTotal()
                ? "RUNNING"
                : rows.stream().allMatch(Row::succeeded) ? "COMPLETED" : "COMPLETED_WITH_ERRORS";
        return new HeroImportJobView(job.getId(), status, job.getCompleted(), job.getTotal(), job.getCreatedAt(),
                job.getUpdatedAt(), job.isNotificationDismissed(), rows);
    }
}
