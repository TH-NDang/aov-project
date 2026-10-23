package com.wikiaov.enchantment.internal.application;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.util.List;
import java.util.UUID;

public final class EnchantmentOrdering {
    private EnchantmentOrdering() {
    }

    public record Branches(
            @NotEmpty @Size(max = 100) List<@NotNull @Valid Branch> entries
    ) {
    }

    public record Branch(
            @NotBlank String code,
            @NotNull @Positive Long expectedVersion
    ) {
    }

    public record Nodes(
            @NotNull UUID rulesetId,
            @NotBlank String branchCode,
            @Min(1) @Max(3) int tier,
            @NotEmpty @Size(max = 100) List<@NotNull @Valid Node> entries
    ) {
    }

    public record Node(
            @NotNull UUID id,
            @NotNull UUID revisionId,
            @NotNull @Positive Long expectedVersion
    ) {
    }
}
