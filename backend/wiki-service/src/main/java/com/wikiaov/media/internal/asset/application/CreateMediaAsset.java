package com.wikiaov.media.internal.asset.application;

import com.wikiaov.access.Actor;
import com.wikiaov.access.AuditEntry;
import com.wikiaov.access.AuditLog;
import com.wikiaov.access.CurrentActor;
import com.wikiaov.media.MediaSemanticType;
import com.wikiaov.media.internal.application.SourceInput;
import com.wikiaov.media.internal.application.response.MediaAssetDetails;
import com.wikiaov.media.internal.asset.persistence.MediaAssetRepository;
import com.wikiaov.media.internal.asset.persistence.entity.MediaAsset;
import com.wikiaov.media.internal.provenance.persistence.MediaProvenanceRepository;
import com.wikiaov.media.internal.query.application.MediaAssetViews;
import com.wikiaov.media.internal.shared.application.MediaWritePolicy;
import java.time.Clock;
import java.time.Instant;
import java.util.UUID;
import org.jspecify.annotations.Nullable;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Creates a logical asset without bytes (03 section 30); versions are added by upload or import. */
@Service
public class CreateMediaAsset {

    private final MediaAssetRepository assets;
    private final MediaProvenanceRepository provenance;
    private final MediaAssetViews assetViews;
    private final CurrentActor currentActor;
    private final AuditLog auditLog;
    private final Clock clock;

    CreateMediaAsset(MediaAssetRepository assets, MediaProvenanceRepository provenance, MediaAssetViews assetViews,
            CurrentActor currentActor, AuditLog auditLog, Clock clock) {
        this.assets = assets;
        this.provenance = provenance;
        this.assetViews = assetViews;
        this.currentActor = currentActor;
        this.auditLog = auditLog;
        this.clock = clock;
    }

    public record Command(
            MediaSemanticType semanticType,
            @Nullable SourceInput source
    ) {
    }

    @PreAuthorize(MediaWritePolicy.CAN_WRITE_MEDIA)
    @Transactional
    public MediaAssetDetails execute(Command command) {
        Actor actor = currentActor.require();
        Instant now = clock.instant();

        MediaAsset asset = assets.save(
                MediaAsset.create(UUID.randomUUID(), command.semanticType(), MediaWritePolicy.ref(actor), now));
        if (command.source() != null) {
            provenance.save(command.source().toProvenance(asset.getId(), null, now));
        }
        auditLog.record(new AuditEntry(actor, "MEDIA_ASSET_CREATED", MediaWritePolicy.AUDIT_AGGREGATE, asset.getId(),
                null, null, null, null, MediaWritePolicy.metadata("semanticType", command.semanticType().name())));

        return assetViews.details(asset);
    }
}
