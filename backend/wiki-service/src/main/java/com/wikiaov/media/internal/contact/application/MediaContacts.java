package com.wikiaov.media.internal.contact.application;

import com.wikiaov.access.AuditEntry;
import com.wikiaov.access.AuditLog;
import com.wikiaov.access.CurrentActor;
import com.wikiaov.media.internal.application.MediaErrorCode;
import com.wikiaov.media.internal.application.response.MediaContactView;
import com.wikiaov.media.internal.asset.application.MediaAssetAccess;
import com.wikiaov.media.internal.asset.persistence.MediaAssetVersionRepository;
import com.wikiaov.media.internal.contact.persistence.MediaContactRepository;
import com.wikiaov.media.internal.contact.persistence.entity.MediaContactRequest;
import com.wikiaov.media.internal.shared.application.MediaWritePolicy;
import com.wikiaov.platform.ApiException;
import com.wikiaov.platform.PageSlice;
import com.wikiaov.platform.PlatformErrorCode;
import java.time.Clock;
import java.util.UUID;
import org.jspecify.annotations.Nullable;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class MediaContacts {
    private final MediaContactRepository contacts;
    private final MediaAssetAccess assets;
    private final MediaAssetVersionRepository versions;
    private final Clock clock;
    private final CurrentActor actors;
    private final AuditLog audit;

    public MediaContacts(MediaContactRepository contacts, MediaAssetAccess assets, MediaAssetVersionRepository versions,
            Clock clock, CurrentActor actors, AuditLog audit) {
        this.contacts = contacts;
        this.assets = assets;
        this.versions = versions;
        this.clock = clock;
        this.actors = actors;
        this.audit = audit;
    }

    @Transactional
    public UUID submit(@Nullable UUID assetId, @Nullable UUID versionId, String name, String email, String topic,
            String message) {
        if ((assetId == null) != (versionId == null)) {
            throw new ApiException(PlatformErrorCode.INVALID_REQUEST, "Asset and version must be supplied together.");
        }
        if (assetId != null) {
            assets.requireActiveAsset(assetId);
            versions.findById(versionId).filter(version -> assetId.equals(version.getAssetId()))
                    .orElseThrow(() -> new ApiException(MediaErrorCode.MEDIA_VERSION_NOT_FOUND,
                            "Media version does not exist."));
        }
        return contacts.save(MediaContactRequest.create(assetId, versionId, name.strip(), email.strip(), topic,
                message.strip(), clock.instant())).getId();
    }

    @PreAuthorize(MediaWritePolicy.CAN_WRITE_MEDIA)
    @Transactional(readOnly = true)
    public PageSlice<MediaContactView> list(int page, int size) {
        var result = contacts
                .findAll(PageRequest.of(page, size, Sort.by(Sort.Order.desc("createdAt"), Sort.Order.desc("id"))));
        return new PageSlice<>(result.getContent().stream().map(MediaContacts::view).toList(), page, size,
                result.getTotalElements());
    }

    @PreAuthorize(MediaWritePolicy.CAN_WRITE_MEDIA)
    @Transactional
    public MediaContactView resolve(UUID id) {
        var entry = contacts.findById(id).orElseThrow(() -> new ApiException(MediaErrorCode.MEDIA_CONTACT_NOT_FOUND,
                "Contact request does not exist."));
        if (entry.getResolvedAt() == null) {
            entry.resolve(clock.instant());
            audit.record(new AuditEntry(actors.require(), "MEDIA_CONTACT_RESOLVED", "MEDIA_CONTACT", id,
                    null, null, null, null, java.util.Map.of()));
        }
        return view(entry);
    }

    private static MediaContactView view(MediaContactRequest entry) {
        return new MediaContactView(entry.getId(), entry.getAssetId(), entry.getVersionId(), entry.getName(),
                entry.getEmail(),
                entry.getTopic(), entry.getMessage(), entry.getStatus(), entry.getCreatedAt(), entry.getResolvedAt());
    }
}
