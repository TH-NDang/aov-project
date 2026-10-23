package com.wikiaov.hero.internal.alias.persistence.entity;

import jakarta.persistence.*;
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
