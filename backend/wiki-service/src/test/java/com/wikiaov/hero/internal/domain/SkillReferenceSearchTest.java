package com.wikiaov.hero.internal.domain;

import static org.assertj.core.api.Assertions.*;

import org.junit.jupiter.api.Test;

class SkillReferenceSearchTest {
    @Test
    void parsesOwnerSlotAndVariantIndependentlyOfWordOrder() {
        assertThat(SkillReferenceSearch.parse("chiêu 1 airi")).isEqualTo(SkillReferenceSearch.parse("airi chiêu 1"));
        assertThat(SkillReferenceSearch.parse("EdRas Chiêu 2 1"))
                .isEqualTo(new SkillReferenceSearch(java.util.List.of("edras"), 2, 1));
        assertThat(SkillReferenceSearch.parse("edras chiêu 1 2"))
                .isEqualTo(new SkillReferenceSearch(java.util.List.of("edras"), 1, 2));
        assertThat(SkillReferenceSearch.parse("Ngộ Không nội tại").words()).containsExactly("ngo", "khong");
        assertThat(SkillReferenceSearch.parse("Ngộ Không nội tại").sourceSlot()).isZero();
        assertThat(SkillReferenceSearch.parse("passive Airi").sourceSlot()).isZero();
    }

    @Test
    void neverInventsVariantFromCaptureNamesOrListOrder() {
        assertThat(SkillReferenceSearch.sourceSlot("skill-2-3")).isEqualTo(2);
        assertThat(SkillReferenceSearch.variantNo("skill-2-3")).isEqualTo(3);
        assertThat(SkillReferenceSearch.sourceSlot("capture-skill-1")).isEqualTo(1);
        assertThat(SkillReferenceSearch.variantNo("capture-skill-1")).isNull();
        assertThat(SkillReferenceSearch.sourceSlot("some-named-skill")).isNull();
        assertThat(SkillReferenceSearch.sourceSlot("skill-9999999999999999-1")).isNull();
    }

    @Test
    void recognizesSkillCategoryCommandsWithoutTreatingThemAsNames() {
        for (var q : java.util.List.of("@Kỹ năng", "Kỹ năng", "chiêu thức", "chiêu", "skills"))
            assertThat(SkillReferenceSearch.parse(q).words()).isEmpty();
        assertThat(SkillReferenceSearch.parse("Kỹ năng Edras").words()).containsExactly("edras");
        assertThat(SkillReferenceSearch.parse("chiêu thức 2 Edras").sourceSlot()).isEqualTo(2);
    }
}
