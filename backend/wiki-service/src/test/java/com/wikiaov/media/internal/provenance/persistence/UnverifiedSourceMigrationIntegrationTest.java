package com.wikiaov.media.internal.provenance.persistence;

import static org.assertj.core.api.Assertions.assertThat;

import com.wikiaov.DockerBacked;
import com.wikiaov.TestcontainersConfiguration;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.SQLException;
import java.util.UUID;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;

@DockerBacked
class UnverifiedSourceMigrationIntegrationTest {

    @Test
    void theMigrationFlagsTheSourcesTheCreditFilterRecognisedByTheirLabel() throws Exception {
        try (var database = TestcontainersConfiguration.postgres()) {
            database.start();
            migrate(database.getJdbcUrl(), database.getUsername(), database.getPassword(), "73");
            UUID placeholder = UUID.randomUUID();
            UUID credit = UUID.randomUUID();
            try (var connection = DriverManager.getConnection(database.getJdbcUrl(), database.getUsername(),
                    database.getPassword())) {
                UUID asset = asset(connection);
                source(connection, placeholder, asset, "Chưa xác minh nguồn");
                source(connection, credit, asset, "Ảnh chụp từ game Liên Quân");
            }

            migrate(database.getJdbcUrl(), database.getUsername(), database.getPassword(), "74");

            try (var connection = DriverManager.getConnection(database.getJdbcUrl(), database.getUsername(),
                    database.getPassword())) {
                assertThat(unverified(connection, placeholder)).isTrue();
                assertThat(unverified(connection, credit)).isFalse();
            }
        }
    }

    private static void migrate(String url, String user, String password, String target) {
        Flyway.configure().dataSource(url, user, password).target(target).load().migrate();
    }

    private static UUID asset(Connection connection) throws SQLException {
        UUID id = UUID.randomUUID();
        try (var insert = connection.prepareStatement("""
                INSERT INTO media.media_asset (id, semantic_type, lifecycle_state, last_version_no, lock_version,
                    created_at, created_by_issuer, created_by_subject, updated_at)
                VALUES (?, 'PATCH_ART', 'ACTIVE', 0, 0, now(), 'issuer', 'editor', now())
                """)) {
            insert.setObject(1, id);
            insert.executeUpdate();
        }
        return id;
    }

    private static void source(Connection connection, UUID id, UUID asset, String label) throws SQLException {
        try (var insert = connection.prepareStatement("""
                INSERT INTO media.media_provenance (id, asset_id, source_type, source_label, created_at)
                VALUES (?, ?, 'OTHER', ?, now())
                """)) {
            insert.setObject(1, id);
            insert.setObject(2, asset);
            insert.setString(3, label);
            insert.executeUpdate();
        }
    }

    private static boolean unverified(Connection connection, UUID id) throws SQLException {
        try (var select = connection.prepareStatement("SELECT unverified FROM media.media_provenance WHERE id = ?")) {
            select.setObject(1, id);
            try (var row = select.executeQuery()) {
                row.next();
                return row.getBoolean(1);
            }
        }
    }
}
