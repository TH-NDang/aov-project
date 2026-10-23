package com.wikiaov.hero.internal.media.persistence.entity;

import com.wikiaov.hero.internal.sections.persistence.entity.SectionRevision;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

@Entity
@Getter
@Setter
@Table(schema = "hero", name = "hero_media_binding_revision")
public class MediaRevision extends SectionRevision {
}
