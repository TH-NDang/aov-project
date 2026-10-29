package com.wikiaov.media.internal.web.request;

import com.wikiaov.media.internal.application.SourceInput;
import com.wikiaov.media.internal.domain.model.ProvenanceSourceType;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import org.jspecify.annotations.Nullable;

/** Provenance of an artwork. The URL is stored for reference only and never fetched. */
public record SourceRequest(
        @Nullable ProvenanceSourceType type,
        @NotBlank @Size(max = 200) String label,
        @Nullable @Size(max = 2048) @Pattern(regexp = "https?://\\S+", message = "must be an http(s) URL") String url,
        @Nullable Instant observedAt,
        @Nullable @Size(max = 2000) String note,
        @Nullable @Size(max = 200) String ownerName,
        @Nullable @Size(max = 2048) @Pattern(regexp = "https?://\\S+", message = "must be an http(s) URL") String contactUrl
) {

    public SourceInput toInput() {
        return new SourceInput(type != null ? type : ProvenanceSourceType.OTHER, label.strip(), url, observedAt, note,
                ownerName == null || ownerName.isBlank() ? null : ownerName.strip(), contactUrl);
    }

    public static @Nullable SourceInput toInput(@Nullable SourceRequest source) {
        return source == null ? null : source.toInput();
    }
}
