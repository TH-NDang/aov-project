package com.wikiaov.hero.internal.persistence.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

@Entity
@Getter
@Setter
@Table(schema = "hero", name = "hero_combat_stats_revision")
public class StatsRevision extends SectionRevision {
}
