package com.wikiaov.terminology.internal.settings.persistence.entity;

import com.wikiaov.terminology.internal.domain.ReferenceSettings.*;
import jakarta.persistence.*;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Getter
@Setter
@Table(schema = "terminology", name = "entry")
public class ReferenceEntry {
    @Id
    private UUID id;
    private String referenceKey;
    private String kind;
    private String icon;
    private Boolean autoMatch;
    private int displayOrder;
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    private Display display;
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    private Destinations destinations;
}
