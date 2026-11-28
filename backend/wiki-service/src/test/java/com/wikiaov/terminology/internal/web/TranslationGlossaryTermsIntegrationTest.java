package com.wikiaov.terminology.internal.web;

import static org.assertj.core.api.Assertions.assertThat;

import com.wikiaov.DockerBacked;
import com.wikiaov.TestcontainersConfiguration;
import java.util.HashMap;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

/** The game words V088 adds for Stream post translation (ADR-037). */
@SpringBootTest
@ActiveProfiles("test")
@Import(TestcontainersConfiguration.class)
@DockerBacked
@Transactional
class TranslationGlossaryTermsIntegrationTest {
    @Autowired
    JdbcClient jdbc;

    @Test
    void theTranslationTermsHaveEnglishNamesAndHighlightNothingOnTheirOwn() {
        var english = new HashMap<String, String>();
        jdbc.sql("""
                SELECT e.reference_key, t.name FROM terminology.entry e
                JOIN terminology.translation t ON t.entry_id = e.id AND t.locale = 'en-US'
                WHERE e.kind = 'term'
                """).query((row, n) -> english.put(row.getString(1), row.getString(2))).list();

        assertThat(english).containsEntry("phep-bo-tro", "Challenger Skill").containsEntry("caesar", "Dark Slayer")
                .containsEntry("bua-xanh", "Blue buff").containsEntry("cao-thu", "Conqueror")
                .containsEntry("ganh-team", "Carry").containsEntry("noi-tai", "Passive")
                .containsEntry("giam-hoi-chieu", "Cooldown reduction");

        var autoMatch = jdbc.sql("""
                SELECT DISTINCT e.auto_match FROM terminology.entry e
                WHERE e.kind = 'term' AND e.reference_key IN ('phep-bo-tro', 'caesar', 'bua-xanh', 'ba-dao', 'cam-mat')
                """).query(Boolean.class).list();
        assertThat(autoMatch).containsExactly(false);

        List<String> vietnameseAliases = jdbc.sql("""
                SELECT jsonb_array_elements_text(t.aliases) FROM terminology.entry e
                JOIN terminology.translation t ON t.entry_id = e.id AND t.locale = 'vi-VN'
                WHERE e.kind = 'term' AND e.reference_key = 'cao-thu'
                """).query(String.class).list();
        assertThat(vietnameseAliases).contains("rank Cao Thủ");
        assertThat(jdbc.sql("""
                SELECT t.name FROM terminology.entry e
                JOIN terminology.translation t ON t.entry_id = e.id AND t.locale = 'zh-TW'
                WHERE e.kind = 'term' AND e.reference_key = 'quan-huy'
                """).query(String.class).single()).isEqualTo("點券");
    }

    @Test
    void anOldTermKeepsItsVietnameseText() {
        assertThat(jdbc.sql("""
                SELECT t.name FROM terminology.entry e
                JOIN terminology.translation t ON t.entry_id = e.id AND t.locale = 'vi-VN'
                WHERE e.kind = 'term' AND e.reference_key = 'noi-tai'
                """).query(String.class).single()).isEqualTo("Nội tại");
    }
}
