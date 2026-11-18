package com.wikiaov.media.internal.capacity.application;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.PositiveOrZero;
import java.util.List;
import org.jspecify.annotations.Nullable;

/**
 * Request bodies of the storage estimate (03, ADR-030 section). The schema names stay those of the former
 * {@code web.request.SourceRequests} records, so the published OpenAPI document does not change.
 */
public final class CapacityCommands {

    private CapacityCommands() {
    }

    @Schema(name = "com.wikiaov.media.internal.web.request.SourceRequests.EstimateFile")
    public record EstimateFileCommand(
            @Nullable @Pattern(regexp = "[0-9a-f]{64}", message = "must be 64 lower-case hex digits") String sha256,
            @NotNull @PositiveOrZero Long sizeBytes
    ) {

        public StorageCapacityViews.EstimateFile toFile() {
            return new StorageCapacityViews.EstimateFile(sha256, sizeBytes);
        }
    }

    @Schema(name = "com.wikiaov.media.internal.web.request.SourceRequests.Estimate")
    public record EstimateCommand(
            @NotNull StorageCapacityViews.Target target,
            @NotEmpty List<@NotNull @Valid EstimateFileCommand> files
    ) {
    }
}
