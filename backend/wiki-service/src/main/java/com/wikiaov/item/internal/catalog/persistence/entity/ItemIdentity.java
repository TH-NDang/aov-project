package com.wikiaov.item.internal.catalog.persistence.entity;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;

@Entity
@Getter
@Setter
@Table(schema = "item", name = "item")
public class ItemIdentity {
    @Id
    private UUID id;
    private String code;
    private Instant createdAt;
    private String createdByIssuer;
    private String createdBySubject;
}
