package com.wikiaov.media.internal.source.application;

import com.wikiaov.access.Actor;
import com.wikiaov.access.AuditEntry;
import com.wikiaov.access.AuditLog;
import com.wikiaov.access.CurrentActor;
import com.wikiaov.media.internal.application.MediaErrorCode;
import com.wikiaov.media.internal.shared.application.MediaWritePolicy;
import com.wikiaov.media.internal.source.persistence.SourceFileRepository;
import com.wikiaov.media.internal.source.persistence.SourceObjectRepository;
import com.wikiaov.media.internal.source.persistence.entity.SourceObject;
import com.wikiaov.media.internal.storage.application.port.ObjectStorage;
import com.wikiaov.platform.ApiException;
import com.wikiaov.platform.PageSlice;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * Bytes that no collection places and no module uses (ADR-030 section 7), and their deliberate deletion:
 * mark DELETING under the row lock, delete the object without a transaction, then drop the row.
 */
@Service
public class SourceOrphans {

    private static final String AUDIT_AGGREGATE = "SOURCE_OBJECT";

    private final SourceObjectRepository objects;
    private final SourceFileRepository files;
    private final SourceUsages usages;
    private final ObjectStorage storage;
    private final CurrentActor actors;
    private final AuditLog audit;
    private final TransactionTemplate transaction;

    SourceOrphans(SourceObjectRepository objects, SourceFileRepository files, SourceUsages usages,
            ObjectStorage storage, CurrentActor actors, AuditLog audit, TransactionTemplate transaction) {
        this.objects = objects;
        this.files = files;
        this.usages = usages;
        this.storage = storage;
        this.actors = actors;
        this.audit = audit;
        this.transaction = transaction;
    }

    @Transactional(readOnly = true)
    public PageSlice<SourceFileViews.Orphan> list(int page, int size) {
        List<SourceObject> orphans = orphans();

        // Paged in memory: an orphan is an object that no source file and no usage names, read from several sources.
        return PageSlice.of(orphans, page, size).map(SourceOrphans::view);
    }

    /** Count and bytes of the orphans, for the storage summary. */
    public record Totals(
            long files,
            long bytes
    ) {
    }

    @Transactional(readOnly = true)
    public Totals totals() {
        List<SourceObject> orphans = orphans();
        return new Totals(orphans.size(), orphans.stream().mapToLong(SourceObject::getSizeBytes).sum());
    }

    @PreAuthorize(MediaWritePolicy.CAN_WRITE_MEDIA)
    public void delete(String sha256) {
        Actor actor = actors.require();
        SourceErrors.requireSha256(sha256, "sha256");

        SourceObject marked = transaction.execute(status -> {
            SourceObject object = objects.lockById(sha256).orElseThrow(() -> new ApiException(
                    MediaErrorCode.SOURCE_OBJECT_NOT_FOUND, "No stored bytes have this SHA-256."));
            if (object.isReady()) {
                long placed = files.countBySha256(sha256);
                var used = usages.find(sha256);
                if (placed > 0 || !used.isEmpty()) {
                    throw new ApiException(MediaErrorCode.SOURCE_OBJECT_IN_USE,
                            "Files or records still use these bytes.", Map.of("files", placed, "usages", used.size()));
                }
                object.startDeletion();
            }
            return object;
        });

        storage.delete(marked.getObjectKey());
        transaction.executeWithoutResult(status -> {
            if (objects.deleteDeleting(sha256) > 0) {
                audit.record(new AuditEntry(actor, "SOURCE_OBJECT_DELETED", AUDIT_AGGREGATE, aggregateId(sha256), null,
                        null, null, null, MediaWritePolicy.metadata("sha256", sha256, "sizeBytes",
                                marked.getSizeBytes(), "firstPath", marked.getFirstPath())));
            }
        });
    }

    private List<SourceObject> orphans() {
        List<SourceObject> unplaced = objects.findUnplaced();
        Set<String> used = usages.referenced(unplaced.stream().map(SourceObject::getSha256).toList());
        return unplaced.stream().filter(object -> !used.contains(object.getSha256())).toList();
    }

    /** Audit rows are keyed by UUID; the name-based UUID of the SHA-256 is stable and recoverable from metadata. */
    private static UUID aggregateId(String sha256) {
        return UUID.nameUUIDFromBytes(sha256.getBytes(StandardCharsets.US_ASCII));
    }

    private static SourceFileViews.Orphan view(SourceObject object) {
        return new SourceFileViews.Orphan(object.getSha256(), object.getSizeBytes(), object.getContentType(),
                object.getFirstPath(), object.getCreatedAt(), object.getState().name());
    }
}
