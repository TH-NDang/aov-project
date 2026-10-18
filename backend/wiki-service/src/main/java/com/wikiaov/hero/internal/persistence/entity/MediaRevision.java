package com.wikiaov.hero.internal.persistence.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

@Entity
@Getter
@Setter
@Table(schema = "hero", name = "hero_media_binding_revision")
public class MediaRevision extends SectionRevision {
}
