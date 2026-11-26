package com.wikiaov.patch.internal.watch.application;

import com.wikiaov.patch.internal.watch.application.PatchNoteInbox.Untitled;
import com.wikiaov.patch.internal.watch.application.port.PatchNoteFeed;
import com.wikiaov.patch.internal.watch.application.port.PatchNoteFeed.Answer;
import com.wikiaov.patch.internal.watch.application.port.PatchNoteFeed.Validators;
import com.wikiaov.patch.internal.watch.application.port.PatchNoteFeedException;
import com.wikiaov.patch.internal.watch.domain.PatchNoteSource;
import java.time.Clock;
import java.time.Instant;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

/**
 * Reads the publishers' lists one after the other and records what is new. Runs outside any transaction; only the
 * short writes of {@link PatchNoteInbox} touch the database.
 */
@Component
public class PatchNoteChecks {
    private static final Logger LOG = LoggerFactory.getLogger(PatchNoteChecks.class);
    /** Lists that carry links only cost one extra page per new post; a burst is named over later checks. */
    private static final int TITLES_PER_CHECK = 5;

    private final PatchNoteInbox inbox;
    private final PatchNoteFeed feed;
    private final PatchWatchProperties properties;
    private final Clock clock;

    public PatchNoteChecks(PatchNoteInbox inbox, PatchNoteFeed feed, PatchWatchProperties properties, Clock clock) {
        this.inbox = inbox;
        this.feed = feed;
        this.properties = properties;
        this.clock = clock;
    }

    /** Sources this server can read; one that needs the page reader waits for a server that has it. */
    public boolean readable(PatchNoteSource source) {
        return !source.needsPageReader() || properties.hasPageReader();
    }

    /** The schedule: reads the sources whose time has come. */
    public void runDue() {
        run(false);
    }

    /** An editor's "check now": reads every source not read in the last two minutes. */
    public void runNow() {
        run(true);
    }

    private void run(boolean manual) {
        for (PatchNoteSource source : PatchNoteSource.checked()) {
            if (!readable(source)) {
                continue;
            }
            Instant now = clock.instant();
            Validators validators = inbox.begin(source, now, manual);
            if (validators == null) {
                continue;
            }

            Answer answer;
            try {
                answer = feed.read(source, validators);
            } catch (PatchNoteFeedException failure) {
                LOG.warn("Patch watch could not read {}: {}", source, failure.getMessage());
                inbox.fail(source, failure.failure(), failure.status(), clock.instant());
                continue;
            }

            List<Untitled> untitled = inbox.record(source, answer, clock.instant());
            untitled.stream().limit(TITLES_PER_CHECK).forEach(post -> {
                String title = feed.title(post.url());
                if (title != null) {
                    inbox.name(post.id(), title);
                }
            });
        }
    }
}
