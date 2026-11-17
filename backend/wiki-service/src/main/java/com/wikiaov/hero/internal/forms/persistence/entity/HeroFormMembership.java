package com.wikiaov.hero.internal.forms.persistence.entity;

import com.wikiaov.platform.AssignedIdentifierEntity;
import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;

/** One form of a catalog hero: the hero aggregate that plays the form, its key and its place in the switcher. */
@Entity
@Getter
@Setter
@Table(schema = "hero", name = "hero_form")
public class HeroFormMembership extends AssignedIdentifierEntity<UUID> {
    @Id
    private UUID heroId;

    private UUID parentHeroId;

    private String formKey;

    private int displayOrder;

    private Instant createdAt;

    private String createdByIssuer;

    private String createdBySubject;

    @Override
    public UUID getId() {
        return heroId;
    }
}
