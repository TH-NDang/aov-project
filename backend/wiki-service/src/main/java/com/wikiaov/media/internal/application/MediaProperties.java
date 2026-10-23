package com.wikiaov.media.internal.application;

import com.wikiaov.media.internal.ingestion.domain.image.ImageLimits;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Positive;
import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;
import org.springframework.util.unit.DataSize;
import org.springframework.validation.annotation.Validated;

/**
 * Media policy and upload settings ({@code wiki.media.*}).
 *
 * @param maxUploadSize         largest accepted file
 * @param maxPixels             largest accepted width x height
 * @param maxDimension          largest accepted width or height
 * @param uploadUrlValidity     how long a presigned upload URL works
 * @param uploadSessionValidity how long after the request an upload can still be completed
 * @param validationTimeout     after this, a validation that never finished (crash) no longer blocks a retry
 * @param publicBaseUrl         URL prefix that serves the {@code assets/} prefix of the bucket
 */
@Validated
@ConfigurationProperties("wiki.media")
public record MediaProperties(
        @DefaultValue("25MB") DataSize maxUploadSize,
        @DefaultValue("40000000") @Positive long maxPixels,
        @DefaultValue("16384") @Positive int maxDimension,
        @DefaultValue("15m") Duration uploadUrlValidity,
        @DefaultValue("1h") Duration uploadSessionValidity,
        @DefaultValue("5m") Duration validationTimeout,
        @DefaultValue("/media") @NotBlank String publicBaseUrl
) {

    public ImageLimits imageLimits() {
        return new ImageLimits(maxUploadSize.toBytes(), maxPixels, maxDimension);
    }

    /** Completion is always allowed at least as long as the upload URL works. */
    public Duration completionWindow() {
        return uploadSessionValidity.compareTo(uploadUrlValidity) >= 0 ? uploadSessionValidity : uploadUrlValidity;
    }
}
