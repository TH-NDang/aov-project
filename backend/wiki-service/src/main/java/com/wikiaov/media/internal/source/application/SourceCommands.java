package com.wikiaov.media.internal.source.application;

import com.wikiaov.media.internal.source.domain.SourceCategory;
import com.wikiaov.platform.CatalogCodes;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.jspecify.annotations.Nullable;

/**
 * Request bodies of the source file API (03, ADR-030 section). The schema names stay those of the former
 * {@code web.request.SourceRequests} records, so the published OpenAPI document does not change.
 */
public final class SourceCommands {

    private SourceCommands() {
    }

    @Schema(name = "com.wikiaov.media.internal.web.request.SourceRequests.CreateCollection")
    public record CreateCollectionCommand(
            @NotBlank @Size(max = 120) @Pattern(regexp = CatalogCodes.PATTERN, message = "must be a lower-case slug") String code,
            @NotNull SourceCategory category,
            @NotBlank @Size(max = 200) String label,
            @Nullable @Size(max = 2000) String note,
            @Nullable LocalDate capturedOn
    ) {
    }

    @Schema(name = "com.wikiaov.media.internal.web.request.SourceRequests.UpdateCollection")
    public record UpdateCollectionCommand(
            @NotNull @PositiveOrZero Long expectedVersion,
            @NotBlank @Size(max = 200) String label,
            @Nullable @Size(max = 2000) String note,
            @Nullable LocalDate capturedOn
    ) {
    }

    @Schema(name = "com.wikiaov.media.internal.web.request.SourceRequests.Replace")
    public record ReplaceCommand(
            @NotNull UUID fileId,
            @NotNull @PositiveOrZero Long expectedVersion
    ) {
    }

    @Schema(name = "com.wikiaov.media.internal.web.request.SourceRequests.Upload")
    public record UploadCommand(
            @NotBlank @Size(max = 512) String path,
            @NotBlank @Pattern(regexp = "[0-9a-f]{64}", message = "must be 64 lower-case hex digits") String sha256,
            @NotNull @PositiveOrZero Long sizeBytes,
            @NotBlank @Size(max = 128) String contentType,
            @Nullable @Valid ReplaceCommand replace
    ) {
    }

    @Schema(name = "com.wikiaov.media.internal.web.request.SourceRequests.LinksBySha256")
    public record LinksBySha256Command(
            @NotEmpty List<@NotBlank String> sha256
    ) {
    }

    @Schema(name = "com.wikiaov.media.internal.web.request.SourceRequests.LinksByPath")
    public record LinksByPathCommand(
            @NotEmpty List<@NotBlank String> paths
    ) {
    }
}
