package com.wikiaov.item.internal.metadata.persistence.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;

@Entity
@Getter
@Setter
@Table(schema = "item", name = "item_category_translation")
public class ItemCategoryTranslation {
    @Id
    private UUID id;
    private String ownerCode;
    private String locale;
    private String name;
    @Column(columnDefinition = "text")
    private String description;
    @Column(columnDefinition = "text")
    private String suitability;
}
