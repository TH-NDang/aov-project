package com.wikiaov.hero.internal.importing.infrastructure;

import com.wikiaov.hero.internal.application.HeroImportRequest;
import com.wikiaov.hero.internal.importing.persistence.HeroImportJobRepository;
import com.wikiaov.hero.internal.importing.persistence.HeroUploadSessionRepository;
import com.wikiaov.media.MediaUsage;
import com.wikiaov.media.MediaUsageProvider;
import com.wikiaov.media.MediaUsageScope;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Pattern;
import java.util.stream.Collectors;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.json.JsonMapper;

@Component
public class ImportMediaUsageProvider implements MediaUsageProvider {
    private static final Pattern QUOTED_ID = Pattern
            .compile("\"([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})\"");

    private final HeroImportJobRepository jobs;
    private final JsonMapper json;
    private final HeroUploadSessionRepository uploads;

    public ImportMediaUsageProvider(HeroImportJobRepository jobs, JsonMapper json,
            HeroUploadSessionRepository uploads) {
        this.jobs = jobs;
        this.json = json;
        this.uploads = uploads;
    }

    @Transactional(readOnly = true)
    public List<MediaUsage> findUsages(UUID assetId) {
        var usages = new ArrayList<MediaUsage>();
        for (var session : uploads.findByStateJsonContaining("\"" + assetId + "\"")) {
            usages.add(session(session.getId()));
        }
        for (var job : jobs.referencing("%" + assetId + "%")) {
            var rows = json.readValue(job.getRequestJson(), HeroImportRequest[].class);
            for (int i = job.getCompleted(); i < rows.length; i++) {
                if (json.writeValueAsString(rows[i].values()).contains("\"" + assetId + "\"")) {
                    usages.add(job(job.getId(), rows[i].code()));
                }
            }
        }
        return usages;
    }

    @Transactional(readOnly = true)
    public Map<UUID, List<MediaUsage>> findAllUsages() {
        Map<UUID, List<MediaUsage>> usages = new HashMap<>();
        for (var session : uploads.findAll()) {
            for (var assetId : assetIds(session.getStateJson())) {
                usages.computeIfAbsent(assetId, ignored -> new ArrayList<>()).add(session(session.getId()));
            }
        }
        for (var job : jobs.unfinished()) {
            var rows = json.readValue(job.getRequestJson(), HeroImportRequest[].class);
            for (int i = job.getCompleted(); i < rows.length; i++) {
                for (var assetId : assetIds(json.writeValueAsString(rows[i].values()))) {
                    usages.computeIfAbsent(assetId, ignored -> new ArrayList<>()).add(job(job.getId(), rows[i].code()));
                }
            }
        }
        return usages;
    }

    /** Every id written in the text; ids that are not images never match an asset, so they are simply never read. */
    private static Set<UUID> assetIds(String text) {
        return QUOTED_ID.matcher(text).results().map(match -> UUID.fromString(match.group(1)))
                .collect(Collectors.toSet());
    }

    /** Waiting to be imported, so it keeps the image from being deleted but nothing draws it yet. */
    private static MediaUsage session(UUID id) {
        return new MediaUsage("HERO", "HERO_UPLOAD_SESSION", id, null, "Pending import", MediaUsageScope.DRAFT)
                .storedOnly();
    }

    private static MediaUsage job(UUID id, String heroCode) {
        return new MediaUsage("HERO", "HERO_IMPORT", id, null, heroCode, MediaUsageScope.DRAFT).storedOnly();
    }
}
