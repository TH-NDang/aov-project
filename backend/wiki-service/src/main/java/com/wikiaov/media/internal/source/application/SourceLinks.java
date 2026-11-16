package com.wikiaov.media.internal.source.application;

import com.wikiaov.media.internal.application.MediaErrorCode;
import com.wikiaov.media.internal.source.domain.SourcePaths;
import com.wikiaov.media.internal.source.persistence.SourceFileRepository;
import com.wikiaov.media.internal.source.persistence.SourceObjectRepository;
import com.wikiaov.media.internal.source.persistence.entity.SourceFile;
import com.wikiaov.media.internal.source.persistence.entity.SourceObject;
import com.wikiaov.media.internal.storage.application.port.ObjectStorage;
import com.wikiaov.media.internal.storage.application.port.PresignedRequest;
import com.wikiaov.platform.ApiException;
import com.wikiaov.platform.ApiFieldError;
import com.wikiaov.platform.PlatformErrorCode;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.jspecify.annotations.Nullable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Short-lived presigned GET URLs for source files (ADR-030 section 6). The bytes go straight from storage to the
 * browser; only admin callers with {@code catalog:read} reach this service, and the URLs are never logged.
 */
@Service
public class SourceLinks {

    /** Most links one request may ask for, so a screen of captures needs one call, not one per image. */
    public static final int MAX_LINKS = 200;

    private final SourceCollections collections;
    private final SourceFiles sourceFiles;
    private final SourceFileRepository files;
    private final SourceObjectRepository objects;
    private final ObjectStorage storage;
    private final SourceProperties properties;

    SourceLinks(SourceCollections collections, SourceFiles sourceFiles, SourceFileRepository files,
            SourceObjectRepository objects, ObjectStorage storage, SourceProperties properties) {
        this.collections = collections;
        this.sourceFiles = sourceFiles;
        this.files = files;
        this.objects = objects;
        this.storage = storage;
        this.properties = properties;
    }

    @Transactional(readOnly = true)
    public SourceFileViews.Links bySha256(@Nullable List<String> requested) {
        Set<String> sha256s = unique(requested, "sha256");
        sha256s.forEach(sha256 -> SourceErrors.requireSha256(sha256, "sha256"));

        Map<String, SourceObject> stored = objects.findBySha256In(sha256s).stream()
                .filter(SourceObject::isReady)
                .collect(Collectors.toMap(SourceObject::getSha256, Function.identity()));
        List<SourceFileViews.Link> items = new ArrayList<>();
        List<String> missing = new ArrayList<>();
        for (String sha256 : sha256s) {
            SourceObject object = stored.get(sha256);
            if (object == null) {
                missing.add(sha256);
                continue;
            }
            PresignedRequest get = storage.presignGet(object.getObjectKey(), properties.linkValidity());
            items.add(new SourceFileViews.Link(sha256, get.url().toString(), get.expiresAt(), object.getContentType(),
                    object.getSizeBytes()));
        }

        return new SourceFileViews.Links(items, missing);
    }

    @Transactional(readOnly = true)
    public SourceFileViews.PathLinks byPaths(UUID collectionId, @Nullable List<String> requested) {
        collections.require(collectionId);
        Set<String> paths = new LinkedHashSet<>();
        for (String path : unique(requested, "paths")) {
            paths.add(SourceErrors.requirePath(path, "paths"));
        }

        Map<String, SourceFile> placed = files.findByCollectionIdAndPathIn(collectionId, paths).stream()
                .collect(Collectors.toMap(SourceFile::getPath, Function.identity()));
        Map<String, SourceObject> stored = objects
                .findBySha256In(placed.values().stream().map(SourceFile::getSha256).collect(Collectors.toSet()))
                .stream()
                .collect(Collectors.toMap(SourceObject::getSha256, Function.identity()));
        List<SourceFileViews.PathLink> items = new ArrayList<>();
        List<String> missing = new ArrayList<>();
        for (String path : paths) {
            SourceFile file = placed.get(path);
            SourceObject object = file == null ? null : stored.get(file.getSha256());
            if (object == null || !object.isReady()) {
                missing.add(path);
                continue;
            }
            PresignedRequest get = storage.presignGet(object.getObjectKey(), properties.linkValidity());
            items.add(new SourceFileViews.PathLink(path, object.getSha256(), get.url().toString(), get.expiresAt(),
                    object.getContentType(), object.getSizeBytes()));
        }

        return new SourceFileViews.PathLinks(items, missing);
    }

    /** A URL that makes the browser save the file under its own name instead of showing it. */
    @Transactional(readOnly = true)
    public SourceFileViews.Download download(UUID fileId) {
        SourceFile file = sourceFiles.require(fileId);
        SourceObject object = objects.findById(file.getSha256()).filter(SourceObject::isReady)
                .orElseThrow(() -> new ApiException(MediaErrorCode.SOURCE_OBJECT_NOT_FOUND,
                        "The bytes of this file are not stored."));

        PresignedRequest get = storage.presignGet(object.getObjectKey(), properties.linkValidity(),
                SourcePaths.fileName(file.getPath()));
        return new SourceFileViews.Download(get.url().toString(), get.expiresAt());
    }

    private static Set<String> unique(@Nullable List<String> values, String field) {
        if (values == null || values.isEmpty()) {
            throw new ApiException(PlatformErrorCode.INVALID_REQUEST, "Ask for at least one file.",
                    List.of(new ApiFieldError(field, "SIZE", "must contain at least one value")));
        }
        Set<String> unique = new LinkedHashSet<>(values);
        if (unique.size() > MAX_LINKS) {
            throw new ApiException(MediaErrorCode.SOURCE_LINK_LIMIT_EXCEEDED,
                    "Ask for at most " + MAX_LINKS + " files at once.", Map.of("max", MAX_LINKS));
        }
        return unique;
    }
}
