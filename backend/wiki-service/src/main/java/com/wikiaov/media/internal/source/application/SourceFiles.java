package com.wikiaov.media.internal.source.application;

import com.wikiaov.access.AuditEntry;
import com.wikiaov.access.AuditLog;
import com.wikiaov.access.CurrentActor;
import com.wikiaov.media.internal.shared.application.MediaWritePolicy;
import com.wikiaov.media.internal.source.domain.SourcePaths;
import com.wikiaov.media.internal.source.persistence.SourceFileRepository;
import com.wikiaov.media.internal.source.persistence.SourceFileRepository.FileRow;
import com.wikiaov.media.internal.source.persistence.SourceObjectRepository;
import com.wikiaov.media.internal.source.persistence.entity.SourceFile;
import com.wikiaov.media.internal.source.persistence.entity.SourceObject;
import com.wikiaov.platform.PageSlice;
import java.util.UUID;
import org.jspecify.annotations.Nullable;
import org.springframework.data.domain.PageRequest;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Files of a source collection: browse, inspect, remove (ADR-030 section 7). */
@Service
public class SourceFiles {

    static final String AUDIT_AGGREGATE = "SOURCE_FILE";
    private static final int OTHER_PLACES = 20;

    private final SourceCollections collections;
    private final SourceFileRepository files;
    private final SourceObjectRepository objects;
    private final SourceUsages usages;
    private final CurrentActor actors;
    private final AuditLog audit;

    SourceFiles(SourceCollections collections, SourceFileRepository files, SourceObjectRepository objects,
            SourceUsages usages, CurrentActor actors, AuditLog audit) {
        this.collections = collections;
        this.files = files;
        this.objects = objects;
        this.usages = usages;
        this.actors = actors;
        this.audit = audit;
    }

    /** @param folder optional folder; every file below it is listed */
    @Transactional(readOnly = true)
    public PageSlice<SourceFileViews.File> list(UUID collectionId, @Nullable String folder, @Nullable String query,
            int page, int size) {
        collections.require(collectionId);
        String folderPattern = folder == null || folder.isBlank()
                ? "%"
                : SourcePaths.normalizeFolder(folder).map(value -> SourceCollections.escapeLike(value) + "/%")
                        .orElseThrow(() -> SourceErrors.invalidPath("prefix"));

        var result = files.search(collectionId, folderPattern, SourceCollections.containsPattern(query),
                PageRequest.of(page, size));
        return new PageSlice<>(result.getContent().stream().map(SourceFiles::view).toList(), page, size,
                result.getTotalElements());
    }

    @Transactional(readOnly = true)
    public SourceFileViews.FileDetails details(UUID fileId) {
        SourceFile file = require(fileId);
        SourceObject object = objects.findById(file.getSha256())
                .orElseThrow(() -> new IllegalStateException("A source file names an object that does not exist."));
        var collection = collections.require(file.getCollectionId());

        var otherPlaces = files.findOtherPlaces(file.getSha256(), file.getId(), PageRequest.of(0, OTHER_PLACES))
                .stream()
                .map(place -> new SourceFileViews.Place(place.getFileId(), place.getCollectionCode(), place.getPath()))
                .toList();
        return new SourceFileViews.FileDetails(file.getId(), file.getPath(), file.getSha256(), object.getSizeBytes(),
                object.getContentType(), file.getCreatedAt(), file.getUpdatedAt(), file.getLockVersion(),
                new SourceFileViews.CollectionRef(collection.getId(), collection.getCode(), collection.getCategory(),
                        collection.getLabel()),
                otherPlaces, usages.find(file.getSha256()));
    }

    /** Removes the file from its collection only; the bytes stay stored until they are purged as orphans. */
    @PreAuthorize(MediaWritePolicy.CAN_WRITE_MEDIA)
    @Transactional
    public void delete(UUID fileId, long expectedVersion) {
        var actor = actors.require();
        SourceFile file = require(fileId);
        if (file.getLockVersion() != expectedVersion) {
            throw SourceErrors.fileVersionConflict(file.getLockVersion());
        }

        files.delete(file);
        audit.record(new AuditEntry(actor, "SOURCE_FILE_REMOVED", AUDIT_AGGREGATE, fileId, null, expectedVersion,
                null, null, MediaWritePolicy.metadata("collectionId", file.getCollectionId().toString(), "path",
                        file.getPath(), "sha256", file.getSha256())));
    }

    SourceFile require(UUID fileId) {
        return files.findById(fileId).orElseThrow(() -> SourceErrors.fileNotFound(fileId));
    }

    static SourceFileViews.File view(SourceFile file, SourceObject object) {
        return new SourceFileViews.File(file.getId(), file.getPath(), file.getSha256(), object.getSizeBytes(),
                object.getContentType(), file.getCreatedAt(), file.getUpdatedAt(), file.getLockVersion());
    }

    private static SourceFileViews.File view(FileRow row) {
        return new SourceFileViews.File(row.getId(), row.getPath(), row.getSha256(), row.getSizeBytes(),
                row.getContentType(), row.getCreatedAt(), row.getUpdatedAt(), row.getVersion());
    }
}
