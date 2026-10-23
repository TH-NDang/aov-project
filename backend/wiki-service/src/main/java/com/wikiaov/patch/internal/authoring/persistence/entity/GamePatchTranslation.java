package com.wikiaov.patch.internal.authoring.persistence.entity;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.IdClass;
import jakarta.persistence.Table;
import java.io.Serializable;
import java.util.UUID;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.springframework.data.domain.Persistable;

@Entity
@Getter
@NoArgsConstructor
@IdClass(GamePatchTranslation.Key.class)
@Table(schema = "patch", name = "game_patch_translation")
public class GamePatchTranslation implements Persistable<GamePatchTranslation.Key> {
    @Id
    private UUID patchId;
    @Id
    private String locale;
    private String title;
    private String summary;
    private String description;

    public GamePatchTranslation(UUID patchId, String locale, String title, String summary, String description) {
        this.patchId = patchId;
        this.locale = locale;
        this.title = title;
        this.summary = summary;
        this.description = description;
    }

    public record Key(
            UUID patchId,
            String locale
    ) implements Serializable {
    }

    @Override
    public Key getId() {
        return new Key(patchId, locale);
    }

    @Override
    public boolean isNew() {
        return true;
    }
}
