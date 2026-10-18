package com.wikiaov.hero.internal.infrastructure;

import com.wikiaov.hero.internal.application.service.HeroImportJobs;
import com.wikiaov.platform.ApiException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.*;

@Configuration
@EnableScheduling
@ConditionalOnProperty(name = "wiki.hero-import.worker-enabled", havingValue = "true", matchIfMissing = true)
public class HeroImportWorker {
    private static final Logger LOG = LoggerFactory.getLogger(HeroImportWorker.class);
    private final HeroImportJobs jobs;
    public HeroImportWorker(HeroImportJobs jobs) {
        this.jobs = jobs;
    }
    @Scheduled(fixedDelayString = "${wiki.hero-import.poll-delay-ms:1000}")
    public void tick() {
        for (var pending : jobs.pending()) {
            try {
                jobs.execute(pending);
            } catch (ApiException failure) {
                jobs.failed(pending, failure.getErrorCode().name(), failure.getMessage());
            } catch (org.springframework.dao.TransientDataAccessException failure) {
                LOG.warn("Import transaction will retry for job {}", pending.id());
            } catch (RuntimeException failure) {
                LOG.error("Import failed for job {} row {}", pending.id(), pending.index(), failure);
                jobs.failed(pending, "HERO_IMPORT_FAILED",
                        "Import failed. Review this row before submitting a new import.");
            }
        }
    }
}
