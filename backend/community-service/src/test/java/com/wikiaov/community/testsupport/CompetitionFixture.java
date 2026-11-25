package com.wikiaov.community.testsupport;

import static com.wikiaov.community.testsupport.ApiCalls.ADMIN;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;

import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.jspecify.annotations.Nullable;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import tools.jackson.databind.JsonNode;

/**
 * A competition with one match between two full teams, recorded through the Admin API as an editor does. The match
 * allows repeated picks, so every game of it can be played with the same heroes.
 */
public final class CompetitionFixture {
    private static final String[] EDITOR = {"tournament:read", "tournament:write", "tournament:publish"};
    private static final List<String> LANES = List.of("TOP", "JUNGLE", "MID", "DRAGON", "SUPPORT");
    private static final int BANS = 4;
    private static final int BEST_OF = 9;

    private final ApiCalls api;
    private final Map<String, String> teams = new HashMap<>();
    private final Map<String, List<String>> players = new HashMap<>();
    private final String id;
    private final String seriesId;
    private int games;

    private CompetitionFixture(ApiCalls api) throws Exception {
        this.api = api;
        for (var side : List.of("BLUE", "RED")) {
            teams.put(side, record("teams", Map.of("code", code("team"), "name", side + " team")));
            var seated = new ArrayList<String>();
            for (var lane : LANES) {
                seated.add(record("players", Map.of("code", code("player"), "nickname", lane + UUID.randomUUID())));
            }
            players.put(side, seated);
        }
        id = record("tournaments", Map.of("code", code("cup"), "name", "Cup", "region", "VN"));
        seriesId = series();
    }

    /** A competition whose plan is still a draft. */
    public static CompetitionFixture draft(ApiCalls api) throws Exception {
        return new CompetitionFixture(api);
    }

    public static CompetitionFixture published(ApiCalls api) throws Exception {
        var competition = new CompetitionFixture(api);
        competition.publish();
        return competition;
    }

    public String id() {
        return id;
    }

    /** One more match of the competition between its two teams, on a day not known yet. */
    public String series() throws Exception {
        return series(null);
    }

    public String series(@Nullable Instant scheduledAt) throws Exception {
        var content = new HashMap<String, Object>(Map.of("code", code("match"), "tournamentId", id, "teamAId",
                teams.get("BLUE"), "teamBId", teams.get("RED"), "bestOf", BEST_OF, "repeatPicksAllowed", true));
        if (scheduledAt != null) {
            content.put("scheduledAt", scheduledAt.toString());
        }

        return record("series", content);
    }

    /** The player who takes a seat, counted from zero, of a side. */
    public String player(String side, int seat) {
        return players.get(side).get(seat);
    }

    public void publish() throws Exception {
        var plan = Map.of("sourceUrl", "https://example.com/rules",
                "entrants", List.of(Map.of("teamId", teams.get("BLUE")), Map.of("teamId", teams.get("RED"))),
                "stages", List.of(Map.of("code", "GROUP", "name", "Group", "format", "ROUND_ROBIN", "bestOf", 3,
                        "legs", 1, "winPoints", 1, "lossPoints", 0, "advance", 1)));
        var saved = editor(put(ADMIN + "/competitions/" + id), Map.of("version", 0, "content", plan));

        editor(post(ADMIN + "/competitions/" + id + "/publish"), Map.of("version", saved.path("version").asLong()));
    }

    public void withdraw() throws Exception {
        editor(post(ADMIN + "/competitions/" + id + "/withdraw"), Map.of("version", version("competitions", id)));
    }

    /** The next game of the first match, complete enough to publish. */
    public Game game() {
        return game(seriesId, ++games);
    }

    public Game game(String match, int number) {
        return new Game(match, number);
    }

    public void withdrawGame(String gameId) throws Exception {
        editor(post(ADMIN + "/games/" + gameId + "/withdraw"), Map.of("version", version("games", gameId)));
    }

    private String record(String kind, Map<String, Object> content) throws Exception {
        return editor(post(ADMIN + "/" + kind), Map.of("content", content)).path("id").asString();
    }

    private long version(String kind, String recordId) throws Exception {
        return editor(get(ADMIN + "/" + kind + "/" + recordId), null).path("version").asLong();
    }

    private JsonNode editor(MockHttpServletRequestBuilder request, Object body) throws Exception {
        return api.send(ApiCalls.as(request, "editor", EDITOR), body, 200);
    }

    private static String code(String prefix) {
        return prefix + "-" + UUID.randomUUID();
    }

    /** A game with heroes of its own in every place; a test sets the ones it is about. */
    public final class Game {
        private final Map<String, Object> content = new HashMap<>();
        private final Map<String, List<Map<String, String>>> picks = new HashMap<>();
        private final Map<String, List<Map<String, String>>> bans = new HashMap<>();

        private Game(String match, int number) {
            content.putAll(Map.of("seriesId", match, "number", number, "region", "VN", "locale", "vi-VN"));
            for (var side : teams.keySet()) {
                picks.put(side, filled("Pick " + side + " of game " + number, LANES.size()));
                bans.put(side, filled("Ban " + side + " of game " + number, BANS));
            }
        }

        public Game pick(String side, int seat, Map<String, String> hero) {
            picks.get(side).set(seat, hero);
            return this;
        }

        public Game ban(String side, int turn, Map<String, String> hero) {
            bans.get(side).set(turn, hero);
            return this;
        }

        public Game wonBy(String side) {
            content.put("winner", side);
            return this;
        }

        public Game lasting(int seconds) {
            content.put("durationSeconds", seconds);
            return this;
        }

        public Game mvp(String playerId) {
            content.put("mvpPlayerId", playerId);
            return this;
        }

        /** Saves the game as a draft; the answer is its id. */
        public String save() throws Exception {
            var sides = new ArrayList<Map<String, Object>>();
            for (var side : List.of("BLUE", "RED")) {
                var participants = new ArrayList<Map<String, Object>>();
                for (int seat = 0; seat < LANES.size(); seat++) {
                    participants.add(Map.of("playerId", player(side, seat), "lane", LANES.get(seat), "hero",
                            picks.get(side).get(seat), "spell", Map.of("name", "Observed spell")));
                }
                sides.add(Map.of("side", side, "teamId", teams.get(side), "bans", bans.get(side), "participants",
                        participants));
            }
            content.put("sides", sides);

            return record("games", content);
        }

        /** Saves the game and publishes it; the answer is its id. */
        public String publish() throws Exception {
            String gameId = save();
            editor(post(ADMIN + "/games/" + gameId + "/publish"), Map.of("version", 0));
            return gameId;
        }

        private static List<Map<String, String>> filled(String name, int count) {
            var heroes = new ArrayList<Map<String, String>>();
            for (int place = 0; place < count; place++) {
                heroes.add(Map.of("name", name + ", " + place));
            }
            return heroes;
        }
    }
}
