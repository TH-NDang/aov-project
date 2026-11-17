package com.wikiaov.media.internal.owner.application;

import com.wikiaov.access.AuditEntry;
import com.wikiaov.access.AuditLog;
import com.wikiaov.access.CurrentActor;
import com.wikiaov.media.internal.application.MediaErrorCode;
import com.wikiaov.media.internal.application.SourceInput;
import com.wikiaov.media.internal.application.response.MediaOwnerView;
import com.wikiaov.media.internal.owner.domain.MediaOwnerNames;
import com.wikiaov.media.internal.owner.persistence.MediaOwnerRepository;
import com.wikiaov.media.internal.owner.persistence.entity.MediaOwner;
import com.wikiaov.media.internal.provenance.persistence.MediaProvenanceRepository;
import com.wikiaov.media.internal.shared.application.MediaWritePolicy;
import com.wikiaov.platform.ApiException;
import com.wikiaov.platform.PageSlice;
import com.wikiaov.platform.PlatformErrorCode;
import java.time.Clock;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import org.jspecify.annotations.Nullable;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.PageRequest;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** The image owner catalog (ADR-017): one spelling per owner, renamed or merged for every image at once. */
@Service
public class MediaOwners {
    private static final String AUDIT_AGGREGATE = "MEDIA_OWNER";

    private final MediaOwnerRepository owners;
    private final MediaProvenanceRepository provenance;
    private final CurrentActor actors;
    private final AuditLog audit;
    private final Clock clock;

    public MediaOwners(MediaOwnerRepository owners, MediaProvenanceRepository provenance, CurrentActor actors,
            AuditLog audit, Clock clock) {
        this.owners = owners;
        this.provenance = provenance;
        this.actors = actors;
        this.audit = audit;
        this.clock = clock;
    }

    /**
     * Links a source's owner name to the catalog, creating the owner on first use. Runs in the caller's transaction;
     * the source keeps its own contact, otherwise it takes the owner's.
     */
    public SourceInput attach(SourceInput source) {
        String name = MediaOwnerNames.display(source.ownerName());
        if (name == null) {
            return source.withOwner(null, null, source.contactUrl());
        }

        String key = MediaOwnerNames.key(name);
        owners.insertIfAbsent(UUID.randomUUID(), name, key, clock.instant());
        MediaOwner owner = owners.findByNameKey(key)
                .orElseThrow(() -> new IllegalStateException("An owner was neither inserted nor found."));
        return source.withOwner(owner.getId(), owner.getName(),
                source.contactUrl() != null ? source.contactUrl() : owner.getContactUrl());
    }

    @Transactional(readOnly = true)
    public PageSlice<MediaOwnerView> list(@Nullable String query, int page, int size) {
        String name = MediaOwnerNames.display(query);
        String pattern = name == null ? "%" : "%" + escapeLike(MediaOwnerNames.key(name)) + "%";
        var result = owners.search(pattern, PageRequest.of(page, size));
        return new PageSlice<>(result.getContent().stream()
                .map(row -> new MediaOwnerView(row.getId(), row.getName(), row.getContactUrl(), row.getAssetCount(),
                        row.getLockVersion()))
                .toList(), page, size, result.getTotalElements());
    }

    @PreAuthorize(MediaWritePolicy.CAN_WRITE_MEDIA)
    @Transactional
    public MediaOwnerView update(UUID id, String name, @Nullable String contactUrl, long expectedVersion) {
        var actor = actors.require();
        String display = Objects.requireNonNull(MediaOwnerNames.display(name), "name");
        String key = MediaOwnerNames.key(display);
        MediaOwner owner = require(id);
        checkExpectedVersion(owner, expectedVersion);
        owners.findByNameKey(key).filter(other -> !other.getId().equals(id)).ifPresent(other -> {
            throw new ApiException(MediaErrorCode.MEDIA_OWNER_NAME_TAKEN,
                    "Another owner is already named " + other.getName() + ".", Map.of("ownerId", other.getId()));
        });

        String previousName = owner.getName();
        String previousContact = owner.getContactUrl();
        owner.update(display, key, contactUrl, clock.instant());
        MediaOwner saved = flush(owner);
        if (!previousName.equals(display)) {
            provenance.renameOwner(id, display);
        }
        if (!Objects.equals(previousContact, contactUrl)) {
            provenance.replaceOwnerContact(id, previousContact, contactUrl);
        }
        audit.record(new AuditEntry(actor, "MEDIA_OWNER_UPDATED", AUDIT_AGGREGATE, id, null, expectedVersion,
                saved.getLockVersion(), null,
                MediaWritePolicy.metadata("previousName", previousName, "name", display)));

        return view(saved);
    }

    @PreAuthorize(MediaWritePolicy.CAN_WRITE_MEDIA)
    @Transactional
    public MediaOwnerView merge(UUID id, UUID targetId, long expectedVersion) {
        var actor = actors.require();
        if (id.equals(targetId)) {
            throw new ApiException(PlatformErrorCode.INVALID_REQUEST, "An owner cannot be merged into itself.");
        }
        MediaOwner source = require(id);
        checkExpectedVersion(source, expectedVersion);
        MediaOwner target = require(targetId);

        int moved = provenance.moveOwner(id, targetId, target.getName());
        owners.delete(source);
        audit.record(new AuditEntry(actor, "MEDIA_OWNERS_MERGED", AUDIT_AGGREGATE, targetId, null, null, null, null,
                MediaWritePolicy.metadata("mergedOwnerId", id.toString(), "mergedName", source.getName(),
                        "movedSources", moved)));

        return view(target);
    }

    private MediaOwner require(UUID id) {
        return owners.findById(id).orElseThrow(
                () -> new ApiException(MediaErrorCode.MEDIA_OWNER_NOT_FOUND, "Media owner " + id + " does not exist."));
    }

    private static void checkExpectedVersion(MediaOwner owner, long expectedVersion) {
        if (owner.getLockVersion() != expectedVersion) {
            throw versionConflict(owner.getLockVersion());
        }
    }

    private static ApiException versionConflict(@Nullable Long currentVersion) {
        String detail = "The media owner was modified by another request.";
        return currentVersion == null
                ? new ApiException(MediaErrorCode.MEDIA_OWNER_VERSION_CONFLICT, detail)
                : new ApiException(MediaErrorCode.MEDIA_OWNER_VERSION_CONFLICT, detail,
                        Map.of("currentVersion", currentVersion));
    }

    private MediaOwner flush(MediaOwner owner) {
        try {
            return owners.saveAndFlush(owner);
        } catch (ObjectOptimisticLockingFailureException ex) {
            throw versionConflict(null);
        } catch (DataIntegrityViolationException ex) {
            throw new ApiException(MediaErrorCode.MEDIA_OWNER_NAME_TAKEN, "Another owner already has this name.");
        }
    }

    private MediaOwnerView view(MediaOwner owner) {
        return new MediaOwnerView(owner.getId(), owner.getName(), owner.getContactUrl(),
                owners.countAssets(owner.getId()), owner.getLockVersion());
    }

    private static String escapeLike(String value) {
        return value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_");
    }
}
