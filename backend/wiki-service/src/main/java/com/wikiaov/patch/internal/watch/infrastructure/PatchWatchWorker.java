package com.wikiaov.patch.internal.watch.infrastructure;

import com.wikiaov.patch.internal.watch.application.PatchNoteChecks;
import jakarta.annotation.PreDestroy;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicBoolean;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.annotation.Scheduled;

/**
 * Looks for due sources every few minutes. A check downloads pages, so it runs on its own thread and never holds up
 * the shared scheduler (the hero import ticks every second); a tick that finds a check still running skips.
 */
@Configuration
@EnableScheduling
@ConditionalOnProperty(name = "wiki.patch-watch.enabled", havingValue = "true")
public class PatchWatchWorker {
    private static final Logger LOG = LoggerFactory.getLogger(PatchWatchWorker.class);

    private final PatchNoteChecks checks;
    private final ExecutorService executor = Executors
            .newSingleThreadExecutor(Thread.ofVirtual().name("patch-watch").factory());
    private final AtomicBoolean running = new AtomicBoolean();

    public PatchWatchWorker(PatchNoteChecks checks) {
        this.checks = checks;
    }

    @Scheduled(fixedDelayString = "${wiki.patch-watch.tick-ms:300000}", initialDelayString = "${wiki.patch-watch.initial-delay-ms:120000}")
    public void tick() {
        if (!running.compareAndSet(false, true)) {
            return;
        }
        executor.execute(() -> {
            try {
                checks.runDue();
            } catch (RuntimeException failure) {
                LOG.error("Patch watch check failed", failure);
            } finally {
                running.set(false);
            }
        });
    }

    @PreDestroy
    void stop() {
        executor.shutdownNow();
    }
}
