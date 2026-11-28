package com.wikiaov.community.community.internal.translation.domain;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class PostLanguageTest {
    @Test
    void tellsTheLanguagesPlayersWriteIn() {
        assertThat(PostLanguage.guess("Laville giờ bá quá, cấu máu đau mà vẫn gánh được")).isEqualTo("vi-VN");
        assertThat(PostLanguage.guess("Abyssal Dragon is up in 30s, don't get caught alone")).isEqualTo("en-US");
        assertThat(PostLanguage.guess("ป่าเราฟาร์มไม่ทัน โดนขโมยบัฟแดงอีกแล้ว")).isEqualTo("th-TH");
        assertThat(PostLanguage.guess("今天的排位賽真的很難打")).isEqualTo("zh-TW");
    }

    @Test
    void aFewWordsAreNotEnough() {
        assertThat(PostLanguage.guess("GG")).isNull();
        assertThat(PostLanguage.guess("")).isNull();
    }

    @Test
    void namesInsideReferenceTagsAndLinksDoNotDecide() {
        assertThat(PostLanguage.guess("<ref=hero:1>Tôn Ngộ Không</ref> is strong in the new patch https://x.y/ạ"))
                .isEqualTo("en-US");
    }
}
