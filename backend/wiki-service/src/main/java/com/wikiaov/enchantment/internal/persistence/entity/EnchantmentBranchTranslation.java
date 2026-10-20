package com.wikiaov.enchantment.internal.persistence.entity;
import jakarta.persistence.*;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;
@Entity
@Getter
@Setter
@Table(schema = "enchantment", name = "enchantment_branch_translation")
public class EnchantmentBranchTranslation {
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
