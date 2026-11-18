package com.wikiaov.enchantment.internal.metadata.persistence.entity;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;

@Entity
@Getter
@Setter
@Table(schema = "enchantment", name = "enchantment_branch")
public class EnchantmentBranch {
    @Id
    private String code;
    private long version;
    private int displayOrder;
    private UUID iconAssetId;
    private UUID backgroundAssetId;
    private String color;
}
