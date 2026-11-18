package com.wikiaov.hero.internal.alias.persistence.entity;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.util.UUID;
import lombok.Getter;

@Entity
@Getter
@Table(schema = "hero", name = "image_file_alias")
public class ImageFileAlias {
    @Id
    private UUID assetId;
    private String legacyName;
    private String fileName;
}
