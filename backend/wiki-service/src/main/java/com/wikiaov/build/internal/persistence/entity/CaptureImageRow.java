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

/** A screenshot of a capture, addressed by the SHA-256 of its file. */
@Entity
@Getter
@Setter
@NoArgsConstructor
@Table(schema = "build", name = "capture_image")
@IdClass(CaptureImageRow.Key.class)
public class CaptureImageRow extends AssignedIdentifierEntity<CaptureImageRow.Key> {
    @Id
    private UUID captureId;

    @Id
    private String imageId;

    private String fileName;
    private int width;
    private int height;
    private String layout;

    @Override
    public Key getId() {
        return new Key(captureId, imageId);
    }

    @NoArgsConstructor
    @AllArgsConstructor
    @EqualsAndHashCode
    public static class Key implements java.io.Serializable {
        public UUID captureId;
        public String imageId;
    }
}
