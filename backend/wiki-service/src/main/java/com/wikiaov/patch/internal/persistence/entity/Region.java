package com.wikiaov.patch.internal.persistence.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.util.UUID;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.jspecify.annotations.Nullable;

@Entity
@Table(name = "region", schema = "patch")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Region {
    @Id
    private UUID id;
    @Column(nullable = false, length = 16)
    private String code;
    @Column(name = "display_name", nullable = false, length = 80)
    private String displayName;
    @Column(name = "product_name", nullable = false, length = 80)
    private String productName;
    @Column(name = "default_locale", nullable = false, length = 16)
    private String defaultLocale;
    @Column(nullable = false, length = 64)
    private String timezone;
    @Column(name = "lifecycle_state", nullable = false, length = 16)
    private String lifecycleState;
    @Column(name = "unavailable_reason", length = 255)
    private @Nullable String unavailableReason;
    @Column(name = "sort_order", nullable = false)
    private int sortOrder;

    public Region(UUID id, String code, String displayName, String productName, String defaultLocale,
            String timezone, boolean available) {
        this.id = id;
        this.code = code;
        this.displayName = displayName;
        this.productName = productName;
        this.defaultLocale = defaultLocale;
        this.timezone = timezone;
        this.lifecycleState = available ? "ACTIVE" : "LOCKED";
        this.unavailableReason = available ? null : "Data is not available yet.";
        this.sortOrder = 100;
    }

    public boolean isAvailable() {
        return "ACTIVE".equals(lifecycleState);
    }
}
