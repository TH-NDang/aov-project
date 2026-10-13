package com.wikiaov.media.internal.application.service;

import com.wikiaov.access.Actor;
import com.wikiaov.access.CurrentActor;
import com.wikiaov.media.internal.application.SourceInput;
import com.wikiaov.media.internal.application.response.MediaVersionResult;
import com.wikiaov.media.internal.domain.image.InvalidMediaException;
import com.wikiaov.media.internal.domain.model.MediaObjectKeys;
import com.wikiaov.media.internal.persistence.MediaProvenanceRepository;
import com.wikiaov.platform.ApiException;
import com.wikiaov.platform.ApiFieldError;
import com.wikiaov.platform.PlatformErrorCode;
import java.time.Clock;
import java.util.List;
import java.util.UUID;
import org.jspecify.annotations.Nullable;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * Registers an object that import tooling already placed under {@code imports/} (03 section 34). The bytes are
 * validated exactly like an upload; the source object is left in place. Re-registering the same bytes returns
 * the existing version, so an import can be re-run safely.
 */
@Service
public class RegisterExistingObject {

    private final MediaIngestion ingestion;
    private final MediaProvenanceRepository provenance;
    private final MediaSupport support;
    private final CurrentActor currentActor;
    private final TransactionTemplate transaction;
    private final Clock clock;

    RegisterExistingObject(MediaIngestion ingestion, MediaProvenanceRepository provenance, MediaSupport support,
            CurrentActor currentActor, TransactionTemplate transaction, Clock clock) {
        this.ingestion = ingestion;
        this.provenance = provenance;
        this.support = support;
        this.currentActor = currentActor;
        this.transaction = transaction;
        this.clock = clock;
    }

    public record Command(
            UUID assetId,
            String objectKey,
            @Nullable SourceInput source
    ) {
    }

    @PreAuthorize(MediaSupport.CAN_WRITE_MEDIA)
    public MediaVersionResult execute(Command command) {
        if (!MediaObjectKeys.isAllowedImportKey(command.objectKey())) {
            throw new ApiException(PlatformErrorCode.INVALID_REQUEST, "The object key is not allowed.",
                    List.of(new ApiFieldError("objectKey", "NOT_ALLOWED",
                            "Must start with imports/ and contain only letters, digits, '.', '_', '-' and '/'.")));
        }
        Actor actor = currentActor.require();
        // Fail fast before reading any bytes.
        transaction.executeWithoutResult(status -> support.requireActiveAsset(command.assetId()));
        try {
            MediaIngestion.Outcome outcome = ingestion.ingest(command.assetId(), command.objectKey(), actor, "IMPORT",
                    (version, duplicate) -> {
                        if (!duplicate && command.source() != null) {
                            provenance.save(command.source().toProvenance(command.assetId(), version.getId(),
                                    clock.instant()));
                        }
                    });
            return support.result(outcome.asset(), outcome.version(), outcome.duplicate());
        } catch (InvalidMediaException ex) {
            throw MediaSupport.invalidMedia(ex);
        }
    }
}
