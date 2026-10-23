package com.wikiaov.hero.internal.profile.persistence.entity;

import com.wikiaov.hero.internal.sections.persistence.entity.SectionRevision;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

@Entity
@Getter
@Setter
@Table(schema = "hero", name = "hero_profile_revision")
public class ProfileRevision extends SectionRevision {
}
