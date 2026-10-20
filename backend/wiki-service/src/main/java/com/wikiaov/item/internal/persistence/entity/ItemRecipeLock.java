package com.wikiaov.item.internal.persistence.entity;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;

@Entity
@Getter
@Table(schema = "item", name = "recipe_graph_lock")
public class ItemRecipeLock {
    @Id
    private int id;
}
