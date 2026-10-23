package com.wikiaov.terminology.internal.settings.persistence.entity;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;

@Entity
@Getter
@Setter
@Table(schema = "terminology", name = "configuration")
public class ReferenceConfiguration {
    public static final UUID ID = UUID.fromString("47df8910-0c55-4c51-9407-343282a45233");
    @Id
    private UUID id;
    private long version;
    private boolean autoRecognize;
    private String fallbackLocale;
    private Instant updatedAt;
}
