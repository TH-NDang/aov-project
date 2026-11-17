package com.wikiaov.build.internal.persistence.entity;

import com.wikiaov.platform.AssignedIdentifierEntity;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.IdClass;
import jakarta.persistence.Table;
import java.util.UUID;
import lombok.AllArgsConstructor;
import lombok.EqualsAndHashCode;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** A hero or hero form the capture went through, with what the game showed for it. */
@Entity
@Getter
@Setter
@NoArgsConstructor
@Table(schema = "build", name = "capture_hero")
@IdClass(CaptureHeroRow.Key.class)
public class CaptureHeroRow extends AssignedIdentifierEntity<CaptureHeroRow.Key> {
    @Id
    private UUID captureId;

    @Id
    private UUID heroId;

    private String nameOnScreen;
    private int captureOrder;
    private String result;

    @Override
    public Key getId() {
        return new Key(captureId, heroId);
    }

    @NoArgsConstructor
    @AllArgsConstructor
    @EqualsAndHashCode
    public static class Key implements java.io.Serializable {
        public UUID captureId;
        public UUID heroId;
    }
}
