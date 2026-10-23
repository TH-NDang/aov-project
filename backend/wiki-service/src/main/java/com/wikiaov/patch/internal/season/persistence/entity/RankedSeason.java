package com.wikiaov.patch.internal.season.persistence.entity;

import jakarta.persistence.*;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;

@Entity
@Getter
@Setter
@Table(schema = "patch", name = "ranked_season")
public class RankedSeason {
    @Id
    private UUID id;
    private long ordinal;
    private String code;
    private String displayName;
    private Integer seasonYear;
    private Integer seasonNumber;
}
