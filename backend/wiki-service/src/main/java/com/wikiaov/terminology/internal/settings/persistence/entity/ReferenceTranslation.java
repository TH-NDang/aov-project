package com.wikiaov.terminology.internal.settings.persistence.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.util.List;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Getter
@Setter
@Table(schema = "terminology", name = "translation")
public class ReferenceTranslation {
    @Id
    private UUID id;
    private UUID entryId;
    private String locale;
    private String name;
    @Column(columnDefinition = "text")
    private String description;
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    private List<String> aliases;
}
