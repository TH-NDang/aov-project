package com.wikiaov.enchantment.internal.persistence.entity;
import com.wikiaov.platform.CatalogText.*;
import jakarta.persistence.*;
import java.util.*;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Getter
@Setter
@Table(schema = "enchantment", name = "enchantment_translation")
public class EnchantmentTranslation {
    @Id
    private UUID id;
    private UUID revisionId;
    private String locale;
    private String name;
    private String summary;
    @Column(columnDefinition = "text")
    private String description;
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    private Map<String, String> statLabels;
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    private List<Effect> effects;
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    private Map<String, String> variantLabels;
    public Translation content() {
        return new Translation(locale, name, summary, description, statLabels, effects, variantLabels);
    }
}
