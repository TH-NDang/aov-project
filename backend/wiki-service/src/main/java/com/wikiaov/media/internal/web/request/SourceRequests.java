package com.wikiaov.media.internal.web.request;

import com.wikiaov.media.internal.capacity.application.StorageCapacityViews;
import com.wikiaov.media.internal.source.domain.SourceCategory;
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

/** Request bodies of the source file and storage API (03, ADR-030 section). */
public final class SourceRequests {

    private SourceRequests() {
    }

    public record CreateCollection(
            @NotBlank @Size(max = 120) @Pattern(regexp = "[a-z0-9]+(-[a-z0-9]+)*", message = "must be a lower-case slug") String code,
            @NotNull SourceCategory category,
            @NotBlank @Size(max = 200) String label,
            @Nullable @Size(max = 2000) String note,
            @Nullable LocalDate capturedOn
    ) {
    }

    public record UpdateCollection(
            @NotNull @PositiveOrZero Long expectedVersion,
            @NotBlank @Size(max = 200) String label,
            @Nullable @Size(max = 2000) String note,
            @Nullable LocalDate capturedOn
    ) {
    }

    public record Replace(
            @NotNull UUID fileId,
            @NotNull @PositiveOrZero Long expectedVersion
    ) {
    }

    public record Upload(
            @NotBlank @Size(max = 512) String path,
            @NotBlank @Pattern(regexp = "[0-9a-f]{64}", message = "must be 64 lower-case hex digits") String sha256,
            @NotNull @PositiveOrZero Long sizeBytes,
            @NotBlank @Size(max = 128) String contentType,
            @Nullable @Valid Replace replace
    ) {
    }

    public record LinksBySha256(
            @NotEmpty List<@NotBlank String> sha256
    ) {
    }

    public record LinksByPath(
            @NotEmpty List<@NotBlank String> paths
    ) {
    }

    public record EstimateFile(
            @Nullable @Pattern(regexp = "[0-9a-f]{64}", message = "must be 64 lower-case hex digits") String sha256,
            @NotNull @PositiveOrZero Long sizeBytes
    ) {

        public StorageCapacityViews.EstimateFile toFile() {
            return new StorageCapacityViews.EstimateFile(sha256, sizeBytes);
        }
    }

    public record Estimate(
            @NotNull StorageCapacityViews.Target target,
            @NotEmpty List<@NotNull @Valid EstimateFile> files
    ) {
    }
}
