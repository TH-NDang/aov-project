package com.wikiaov.hero.internal.infrastructure;

import com.wikiaov.hero.internal.application.HeroImportRequest;
import com.wikiaov.hero.internal.persistence.HeroImportJobRepository;
import com.wikiaov.hero.internal.persistence.HeroUploadSessionRepository;
import com.wikiaov.media.*;
import java.util.*;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.json.JsonMapper;

@Component
public class ImportMediaUsageProvider implements MediaUsageProvider {
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
            usages.add(new MediaUsage("HERO", "HERO_UPLOAD_SESSION", session.getId(), null, "Pending import",
                    MediaUsageScope.DRAFT));
        }
        for (var job : jobs.referencing("%" + assetId + "%")) {
            var rows = json.readValue(job.getRequestJson(), HeroImportRequest[].class);
            for (int i = job.getCompleted(); i < rows.length; i++) {
                if (json.writeValueAsString(rows[i].values()).contains("\"" + assetId + "\"")) {
                    usages.add(new MediaUsage("HERO", "HERO_IMPORT", job.getId(), null, rows[i].code(),
                            MediaUsageScope.DRAFT));
                }
            }
        }
        return usages;
    }
}
