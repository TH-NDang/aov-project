package com.wikiaov.media.internal.source.application;

import com.wikiaov.access.AuditEntry;
import com.wikiaov.access.AuditLog;
import com.wikiaov.access.CurrentActor;
import com.wikiaov.media.internal.application.MediaErrorCode;
import com.wikiaov.media.internal.shared.application.MediaWritePolicy;
import com.wikiaov.media.internal.source.domain.SourceCategory;
import com.wikiaov.media.internal.source.persistence.SourceCollectionRepository;
import com.wikiaov.media.internal.source.persistence.SourceCollectionRepository.CollectionRow;
import com.wikiaov.media.internal.source.persistence.entity.SourceCollection;
import com.wikiaov.platform.ApiException;
import com.wikiaov.platform.PageSlice;
import java.time.Clock;
import java.time.LocalDate;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import org.jspecify.annotations.Nullable;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Collections of private source files (ADR-030): one capture run or data set of one function each. */
@Service
public class SourceCollections {

    static final String AUDIT_AGGREGATE = "SOURCE_COLLECTION";

    /** Browsing order of ADR-030: category, newest capture first, then code. */
    private static final Comparator<CollectionRow> BROWSING_ORDER = Comparator
            .comparing(CollectionRow::getCategory)
            .thenComparing(CollectionRow::getCapturedOn, Comparator.nullsLast(Comparator.reverseOrder()))
            .thenComparing(CollectionRow::getCode);

    private final SourceCollectionRepository collections;
    private final CurrentActor actors;
    private final AuditLog audit;
    private final Clock clock;

    SourceCollections(SourceCollectionRepository collections, CurrentActor actors, AuditLog audit, Clock clock) {
        this.collections = collections;
        this.actors = actors;
        this.audit = audit;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public PageSlice<SourceFileViews.Collection> list(@Nullable SourceCategory category, @Nullable String query,
            int page, int size) {
        List<CollectionRow> rows = collections.search(category, containsPattern(query)).stream()
                .sorted(BROWSING_ORDER)
                .toList();

        int from = (int) Math.min((long) page * size, rows.size());
        int to = Math.min(from + size, rows.size());
        return new PageSlice<>(rows.subList(from, to).stream().map(SourceCollections::view).toList(), page, size,
                rows.size());
    }

    @Transactional(readOnly = true)
    public SourceFileViews.Collection get(UUID id) {
        return collections.findRow(id).map(SourceCollections::view)
                .orElseThrow(() -> SourceErrors.collectionNotFound(id));
    }

    @PreAuthorize(MediaWritePolicy.CAN_WRITE_MEDIA)
    @Transactional
    public SourceFileViews.Collection create(String code, SourceCategory category, String label,
            @Nullable String note, @Nullable LocalDate capturedOn) {
        var actor = actors.require();
        collections.findByCode(code).ifPresent(existing -> {
            throw codeTaken(code);
        });

        var collection = SourceCollection.create(UUID.randomUUID(), code, category, label.strip(), blankToNull(note),
                capturedOn, MediaWritePolicy.ref(actor), clock.instant());
        try {
            collection = collections.saveAndFlush(collection);
        } catch (DataIntegrityViolationException ex) {
            throw codeTaken(code);
        }
        audit.record(new AuditEntry(actor, "SOURCE_COLLECTION_CREATED", AUDIT_AGGREGATE, collection.getId(), null,
                null, collection.getLockVersion(), null,
                MediaWritePolicy.metadata("code", code, "category", category.name())));

        return get(collection.getId());
    }

    @PreAuthorize(MediaWritePolicy.CAN_WRITE_MEDIA)
    @Transactional
    public SourceFileViews.Collection update(UUID id, long expectedVersion, String label, @Nullable String note,
            @Nullable LocalDate capturedOn) {
        var actor = actors.require();
        SourceCollection collection = require(id);
        if (collection.getLockVersion() != expectedVersion) {
            throw SourceErrors.collectionVersionConflict(collection.getLockVersion());
        }

        collection.describe(label.strip(), blankToNull(note), capturedOn, clock.instant());
        try {
            collection = collections.saveAndFlush(collection);
        } catch (ObjectOptimisticLockingFailureException ex) {
            throw SourceErrors.collectionVersionConflict(require(id).getLockVersion());
        }
        audit.record(new AuditEntry(actor, "SOURCE_COLLECTION_UPDATED", AUDIT_AGGREGATE, id, null, expectedVersion,
                collection.getLockVersion(), null, Map.of()));

        return get(id);
    }

    /** Removes the collection and its files; the bytes stay stored and become orphans when nothing else uses them. */
    @PreAuthorize(MediaWritePolicy.CAN_WRITE_MEDIA)
    @Transactional
    public void delete(UUID id, long expectedVersion) {
        var actor = actors.require();
        SourceCollection collection = require(id);
        if (collection.getLockVersion() != expectedVersion) {
            throw SourceErrors.collectionVersionConflict(collection.getLockVersion());
        }

        long files = collections.findRow(id).map(CollectionRow::getFileCount).orElse(0L);
        collections.delete(collection);
        audit.record(new AuditEntry(actor, "SOURCE_COLLECTION_DELETED", AUDIT_AGGREGATE, id, null, expectedVersion,
                null, null, MediaWritePolicy.metadata("code", collection.getCode(), "files", files)));
    }

    SourceCollection require(UUID id) {
        return collections.findById(id).orElseThrow(() -> SourceErrors.collectionNotFound(id));
    }

    static String containsPattern(@Nullable String query) {
        if (query == null || query.isBlank()) {
            return "%";
        }
        return "%" + escapeLike(query.strip().toLowerCase(Locale.ROOT)) + "%";
    }

    static String escapeLike(String value) {
        return value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_");
    }

    private static SourceFileViews.Collection view(CollectionRow row) {
        return new SourceFileViews.Collection(row.getId(), row.getCode(), row.getCategory(), row.getLabel(),
                row.getNote(), row.getCapturedOn(), row.getFileCount(), row.getTotalBytes(), row.getUpdatedAt(),
                row.getVersion());
    }

    private static ApiException codeTaken(String code) {
        return new ApiException(MediaErrorCode.SOURCE_COLLECTION_CODE_TAKEN,
                "A source collection with code " + code + " already exists.");
    }

    private static @Nullable String blankToNull(@Nullable String value) {
        return value == null || value.isBlank() ? null : value.strip();
    }
}
