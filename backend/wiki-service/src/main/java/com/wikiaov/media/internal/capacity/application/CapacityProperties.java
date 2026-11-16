package com.wikiaov.media.internal.capacity.application;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Positive;
import java.math.BigDecimal;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;
import org.springframework.validation.annotation.Validated;

/**
 * Free tier, prices and warning thresholds of the storage report ({@code wiki.storage.capacity.*}, ADR-030 section 9).
 * Defaults are the Cloudflare R2 Standard figures read on 2026-11-14; one gigabyte counts as 10^9 bytes.
 *
 * @param freeStorageBytes      storage included per month
 * @param freeClassAOperations  class A operations included per month
 * @param freeClassBOperations  class B operations included per month
 * @param storageUsdPerGbMonth  price of storage above the free tier
 * @param classAUsdPerMillion   price of class A operations above the free tier
 * @param classBUsdPerMillion   price of class B operations above the free tier
 * @param warningRatio          share of the free tier that starts a warning
 * @param criticalRatio         share of the free tier that starts a critical warning
 */
@Validated
@ConfigurationProperties("wiki.storage.capacity")
public record CapacityProperties(
        @DefaultValue("10000000000") @Positive long freeStorageBytes,
        @DefaultValue("1000000") @Positive long freeClassAOperations,
        @DefaultValue("10000000") @Positive long freeClassBOperations,
        @DefaultValue("0.015") BigDecimal storageUsdPerGbMonth,
        @DefaultValue("4.50") BigDecimal classAUsdPerMillion,
        @DefaultValue("0.36") BigDecimal classBUsdPerMillion,
        @DefaultValue("0.8") @DecimalMin("0.0") @DecimalMax("1.0") double warningRatio,
        @DefaultValue("0.95") @DecimalMin("0.0") @DecimalMax("1.0") double criticalRatio
) {

    public static final long BYTES_PER_GIGABYTE = 1_000_000_000L;
}
