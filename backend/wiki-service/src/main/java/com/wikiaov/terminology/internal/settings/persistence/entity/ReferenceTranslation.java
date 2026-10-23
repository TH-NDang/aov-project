package com.wikiaov.terminology.internal.settings.persistence.entity;

import jakarta.persistence.*;
import java.util.*;
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
