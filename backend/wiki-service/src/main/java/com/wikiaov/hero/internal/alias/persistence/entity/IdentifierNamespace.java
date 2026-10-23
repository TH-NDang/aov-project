package com.wikiaov.hero.internal.alias.persistence.entity;

import jakarta.persistence.*;

@Entity
@Table(schema = "hero", name = "identifier_namespace")
public class IdentifierNamespace {
    @Id
    private String name;
}
