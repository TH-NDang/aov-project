package com.wikiaov.hero.internal.persistence.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

@Entity
@Getter
@Setter
@Table(schema = "hero", name = "hero_skin_set_revision")
public class SkinsRevision extends SectionRevision {
}
