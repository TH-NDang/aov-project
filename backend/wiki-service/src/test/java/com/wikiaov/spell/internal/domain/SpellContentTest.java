package com.wikiaov.spell.internal.domain;

import static org.assertj.core.api.Assertions.assertThat;

import java.math.BigDecimal;
import java.util.List;
import org.junit.jupiter.api.Test;

class SpellContentTest {
    @Test
    void mechanicsCompareCooldownsByValue() {
        var stored = spell(new BigDecimal("60.0"), new BigDecimal("45.00"));

        assertThat(stored.mechanics()).isEqualTo(spell(new BigDecimal("60"), new BigDecimal("45")).mechanics());
        assertThat(stored.mechanics()).isNotEqualTo(spell(new BigDecimal("90"), new BigDecimal("45")).mechanics());
    }

    private SpellContent spell(BigDecimal cooldown, BigDecimal recharge) {
        return new SpellContent(null, cooldown, 5, "LEVEL", "AVAILABLE", false, 0, recharge, 2, null, List.of(),
                List.of(), List.of(), null);
    }
}
