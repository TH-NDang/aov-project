package com.wikiaov.platform;

import static org.assertj.core.api.Assertions.*;

import com.wikiaov.platform.CatalogText.Stat;
import java.math.BigDecimal;
import java.util.List;
import org.junit.jupiter.api.Test;

class CatalogTextTest {
    @Test
    void comparableNumbersIgnoreTheScaleAClientDropped() {
        assertThat(CatalogText.comparable(new BigDecimal("9.0")))
                .isEqualTo(CatalogText.comparable(new BigDecimal("9")));
        assertThat(CatalogText.comparable(new BigDecimal("10.00"))).isEqualTo(CatalogText.comparable(BigDecimal.TEN));
        assertThat(CatalogText.comparable(new BigDecimal("0.0"))).isEqualTo(CatalogText.comparable(BigDecimal.ZERO));
        assertThat(CatalogText.comparable((BigDecimal) null)).isNull();
    }

    @Test
    void comparableStatsStillTellDifferentValuesApart() {
        var stored = List.of(new Stat("armor", new BigDecimal("9.0"), null));

        assertThat(CatalogText.comparable(stored))
                .isEqualTo(CatalogText.comparable(List.of(new Stat("armor", new BigDecimal("9"), null))));
        assertThat(CatalogText.comparable(stored))
                .isNotEqualTo(CatalogText.comparable(List.of(new Stat("armor", new BigDecimal("9.5"), null))));
        assertThat(CatalogText.comparable(stored))
                .isNotEqualTo(CatalogText.comparable(List.of(new Stat("armor", new BigDecimal("9"), "%"))));
    }
}
