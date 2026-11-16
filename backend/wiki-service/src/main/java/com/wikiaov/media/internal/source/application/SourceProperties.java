package com.wikiaov.media.internal.source.application;

import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;
import org.springframework.util.unit.DataSize;
import org.springframework.validation.annotation.Validated;

/**
 * Source file settings ({@code wiki.sources.*}, ADR-030). Upload URL and completion deadlines reuse the media ones.
 *
 * @param maxUploadSize largest accepted file; below the 5 GB limit of one PUT and one CopyObject
 * @param linkValidity  how long a presigned download URL works
 */
@Validated
@ConfigurationProperties("wiki.sources")
public record SourceProperties(
        @DefaultValue("2GB") DataSize maxUploadSize,
        @DefaultValue("10m") Duration linkValidity
) {
}
