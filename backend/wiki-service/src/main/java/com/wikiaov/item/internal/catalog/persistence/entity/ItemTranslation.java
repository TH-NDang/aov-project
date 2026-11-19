package com.wikiaov.item.internal.catalog.persistence.entity;

import com.wikiaov.item.internal.domain.ItemContent;
import com.wikiaov.platform.CatalogText.Effect;
import com.wikiaov.platform.CatalogText.Translation;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Getter
@Setter
@Table(schema = "item", name = "item_translation")
public class ItemTranslation {
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
        return new Translation(locale, name, summary, ItemContent.unwrapDescription(description), statLabels, effects,
                variantLabels);
    }
}
