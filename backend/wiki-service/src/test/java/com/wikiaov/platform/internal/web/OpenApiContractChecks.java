package com.wikiaov.platform.internal.web;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasItem;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.wikiaov.hero.HeroChangeQueries;
import com.wikiaov.patch.PatchCatalog;
import com.wikiaov.query.internal.web.PatchPageController;
import com.wikiaov.spell.SpellChangeQueries;
import io.swagger.v3.oas.annotations.Operation;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import org.springframework.web.servlet.mvc.method.annotation.RequestMappingHandlerMapping;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

abstract class OpenApiContractChecks {
    private static final String DOCS = "/api/wiki/v1/admin/openapi";
    private static final Set<String> HTTP_METHODS = Set.of("get", "post", "put", "patch", "delete", "head", "options");
    @Autowired
    MockMvc mvc;
    @Autowired
    JsonMapper json;
    @Autowired
    @Qualifier("requestMappingHandlerMapping")
    RequestMappingHandlerMapping mappings;

    @Test
    void generatedSpecMatchesEveryRuntimeEndpointAndHasNoDuplicateOrDanglingDefinitions() throws Exception {
        JsonNode spec = json.readTree(mvc.perform(get(DOCS).with(reader()))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
        Set<String> expected = new HashSet<>();
        int methods = 0;
        for (var entry : mappings.getHandlerMethods().entrySet()) {
            var handler = entry.getValue();
            if (!handler.getBeanType().getName().startsWith("com.wikiaov.")
                    || handler.getBeanType().equals(ProblemErrorController.class)) {
                continue;
            }
            var contract = Class.forName(handler.getBeanType().getName().replace("Controller", "Api"));
            Operation annotation = contract.getMethod(handler.getMethod().getName(),
                    handler.getMethod().getParameterTypes()).getAnnotation(Operation.class);
            assertThat(annotation).as(handler.toString()).isNotNull();
            methods++;
            for (String path : entry.getKey().getPatternValues()) {
                String concrete = path.replace("{apiVersion}", "v1");
                for (var verb : entry.getKey().getMethodsCondition().getMethods()) {
                    String method = verb.name().toLowerCase(Locale.ROOT);
                    expected.add(method + " " + concrete);
                    JsonNode operation = spec.path("paths").path(concrete).path(method);
                    assertThat(operation.isMissingNode()).as(method + " " + concrete).isFalse();
                    assertThat(operation.path("summary").asText()).isEqualTo(annotation.summary());
                    assertThat(operation.path("description").asText()).isEqualTo(annotation.description());
                    for (var response : annotation.responses()) {
                        assertThat(operation.path("responses").has(response.responseCode()))
                                .as(concrete + " response " + response.responseCode()).isTrue();
                    }
                    boolean secured = concrete.contains("/admin/") || concrete.contains("/users/");
                    assertThat(operation.path("security").toString().contains("bearerAuth"))
                            .as("Security for " + concrete).isEqualTo(secured);
                }
            }
        }
        assertThat(methods).isEqualTo(164);
        Set<String> actual = new HashSet<>();
        Set<String> ids = new HashSet<>();
        for (var path : spec.path("paths").properties()) {
            assertThat(path.getKey()).startsWith("/api/wiki/v1/").doesNotContain("{apiVersion}");
            for (var operation : path.getValue().properties()) {
                if (!HTTP_METHODS.contains(operation.getKey())) {
                    continue;
                }
                actual.add(operation.getKey() + " " + path.getKey());
                assertThat(ids.add(operation.getValue().path("operationId").asText()))
                        .as("Unique operation ID for " + path.getKey()).isTrue();
                Set<String> parameters = new HashSet<>();
                for (var parameter : operation.getValue().path("parameters")) {
                    assertThat(parameter.has("schema") || parameter.has("content") || parameter.has("$ref"))
                            .as("Parameter schema for " + path.getKey() + ": " + parameter).isTrue();
                    assertThat(parameters.add(parameter.path("in").asText() + ":" + parameter.path("name").asText()))
                            .as("Unique parameter for " + path.getKey()).isTrue();
                }
            }
        }
        assertThat(actual).containsExactlyInAnyOrderElementsOf(expected);
        assertLocalReferencesResolve(spec, spec);
        assertThat(spec.path("components").path("schemas").path("ApiProblem").path("properties").has("code")).isTrue();
        assertThat(spec.path("components").path("securitySchemes").path("bearerAuth").path("scheme").asText())
                .isEqualTo("bearer");
        Path directory = Path.of(persistArtifact() ? "target/openapi" : "target/openapi-mvc");
        Files.createDirectories(directory);
        Files.writeString(directory.resolve("wiki-v1.json"),
                json.writerWithDefaultPrettyPrinter().writeValueAsString(spec));
    }

    @Test
    void capabilityMovesPreservePublishedSchemaIdentifiers() throws Exception {
        JsonNode spec = json.readTree(mvc.perform(get(DOCS).with(reader()))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
        var schemas = spec.path("components").path("schemas");

        for (String name : List.of(
                "com.wikiaov.hero.internal.application.service.HeroImports.Field",
                "com.wikiaov.hero.internal.application.service.HeroPatchChanges.AssessmentInput",
                "com.wikiaov.patch.internal.application.service.PatchDataReviewService.Update",
                "com.wikiaov.patch.internal.application.service.RankedSeasons.Input",
                "com.wikiaov.patch.internal.application.service.RankedSeasons.ScheduleInput",
                "com.wikiaov.patch.internal.application.service.RankedSeasons.View")) {
            assertThat(schemas.has(name)).as("Stable published schema identifier: %s", name).isTrue();
            assertThat(spec.toString()).as("Operations continue to reference %s", name)
                    .contains("#/components/schemas/" + name);
        }
    }

    @Test
    void docsUseExistingAdminSecurityAndDoNotOpenTheDefaultDocsPath() throws Exception {
        for (String path : new String[] {DOCS, DOCS + ".yaml"}) {
            mvc.perform(get(path)).andExpect(status().isUnauthorized());
            mvc.perform(get(path).with(jwt())).andExpect(status().isForbidden());
            mvc.perform(get(path).with(reader())).andExpect(status().isOk())
                    .andExpect(header().string(HttpHeaders.CACHE_CONTROL, "no-store"));
        }
        mvc.perform(get("/v3/api-docs")).andExpect(status().isUnauthorized());
        mvc.perform(get("/v3/api-docs").with(reader())).andExpect(status().isForbidden());
    }

    @Test
    void inheritedValidStillRejectsInvalidBodiesAndNestedFieldsBeforeUseCases() throws Exception {
        mvc.perform(post("/api/wiki/v1/auth/login").contentType(MediaType.APPLICATION_JSON)
                .content("{\"username\":\"\",\"password\":\"\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(content().contentTypeCompatibleWith("application/problem+json"))
                .andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
        mvc.perform(post("/api/wiki/v1/admin/media/assets").with(reader()).contentType(MediaType.APPLICATION_JSON)
                .content("{\"semanticType\":\"HERO_PORTRAIT\",\"source\":{\"label\":\"\"}}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_REQUEST"))
                .andExpect(jsonPath("$.errors[*].path", hasItem("source.label")));
    }

    @Test
    void inheritedMethodConstraintsStillProduceTheSameQueryProblem() throws Exception {
        mvc.perform(get("/api/wiki/v1/admin/media/assets?page=-1&size=101").with(reader()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_QUERY_PARAMETER"))
                .andExpect(jsonPath("$.errors[*].path", hasItem("page")))
                .andExpect(jsonPath("$.errors[*].path", hasItem("size")));
        mvc.perform(get("/api/wiki/v1/admin/users?size=101").with(reader()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_QUERY_PARAMETER"));
        mvc.perform(get("/api/wiki/v2/heroes"))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("INVALID_API_VERSION"));
    }

    @Test
    void inheritedDocumentationPreservesRequestSchemasDefaultsAndConditionalStatusCodes() throws Exception {
        JsonNode spec = json.readTree(mvc.perform(get(DOCS).with(reader()))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
        JsonNode login = spec.path("paths").path("/api/wiki/v1/auth/login").path("post");
        assertThat(login.path("requestBody").path("required").asBoolean()).isTrue();
        assertThat(login.path("requestBody").path("content").toString()).contains("LoginRequest");
        assertThat(login.path("parameters").toString()).contains("X-AOV-Auth", "Origin");
        JsonNode list = spec.path("paths").path("/api/wiki/v1/admin/media/assets").path("get");
        JsonNode page = findParameter(list, "page");
        assertThat(page.path("schema").path("default").asInt()).isZero();
        assertThat(page.path("schema").path("minimum").asInt()).isZero();
        JsonNode size = findParameter(list, "size");
        assertThat(size.path("schema").path("default").asInt()).isEqualTo(20);
        assertThat(size.path("schema").path("maximum").asInt()).isEqualTo(100);
        assertThat(spec.path("paths").path("/api/wiki/v1/heroes").path("get").path("responses").has("304")).isTrue();
        assertThat(spec.path("paths").path("/api/wiki/v1/auth/logout").path("post").path("responses").has("204"))
                .isTrue();
        assertThat(
                spec.path("paths").path("/api/wiki/v1/auth/google/callback").path("get").path("responses").has("303"))
                .isTrue();
    }

    @Test
    void similarlyNamedDtosGenericCollectionsEnumsAndDynamicResponsesKeepTheirActualSchemas() throws Exception {
        JsonNode spec = json.readTree(mvc.perform(get(DOCS).with(reader()))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
        JsonNode arcanaCreate = contentSchema(spec.path("paths").path("/api/wiki/v1/admin/arcana")
                .path("post").path("requestBody"));
        JsonNode spellCreate = contentSchema(spec.path("paths").path("/api/wiki/v1/admin/spells")
                .path("post").path("requestBody"));
        assertThat(arcanaCreate.path("$ref").asText()).isNotBlank().isNotEqualTo(spellCreate.path("$ref").asText());
        JsonNode arcanaInput = resolve(spec, arcanaCreate);
        JsonNode spellInput = resolve(spec, spellCreate);
        assertThat(arcanaInput.path("required").toString()).contains("code", "rulesetId", "initialLocale", "name");
        JsonNode arcanaContent = resolve(spec, arcanaInput.path("properties").path("content"));
        JsonNode spellContent = resolve(spec, spellInput.path("properties").path("content"));
        assertThat(arcanaContent.path("properties").has("tier")).isTrue();
        assertThat(arcanaContent.path("properties").has("cooldownSeconds")).isFalse();
        assertThat(spellContent.path("properties").has("cooldownSeconds")).isTrue();
        assertThat(spellContent.path("properties").has("tier")).isFalse();
        JsonNode page = resolve(spec, contentSchema(spec.path("paths").path("/api/wiki/v1/arcana")
                .path("get").path("responses").path("200")));
        assertThat(page.path("properties").has("totalElements")).isTrue();
        JsonNode items = page.path("properties").path("items");
        assertThat(items.path("type").asText()).isEqualTo("array");
        assertThat(resolve(spec, items.path("items")).path("properties").has("content")).isTrue();
        JsonNode revisions = contentSchema(spec.path("paths").path("/api/wiki/v1/admin/heroes/{heroId}/revisions")
                .path("get").path("responses").path("200"));
        assertThat(revisions.path("type").asText()).isEqualTo("array");
        assertThat(resolve(spec, revisions.path("items")).path("properties").has("heroId")).isTrue();
        JsonNode dynamic = contentSchema(spec.path("paths").path("/api/wiki/v1/heroes")
                .path("get").path("responses").path("200"));
        assertThat(dynamic.path("type").asText()).isEqualTo("object");
        assertThat(dynamic.path("additionalProperties").asBoolean()).isTrue();
        JsonNode media = resolve(spec, contentSchema(spec.path("paths").path("/api/wiki/v1/admin/media/assets")
                .path("post").path("requestBody")));
        assertThat(media.path("required").toString()).contains("semanticType");
        assertThat(media.path("properties").path("semanticType").path("enum").toString()).contains("HERO_PORTRAIT");
        assertThat(resolve(spec, media.path("properties").path("source")).path("required").toString())
                .contains("label");
    }

    @Test
    void changeDomainFiltersDescribeEachEndpointRatherThanAssumingHeroOnly() throws Exception {
        JsonNode spec = json.readTree(mvc.perform(get(DOCS).with(reader()))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
        assertThat(domainValues(spec, "/api/wiki/v1/patches/{id}/changes"))
                .containsExactlyInAnyOrder("HERO", "SPELL");
        assertThat(domainValues(spec, "/api/wiki/v1/admin/catalog-changes"))
                .containsExactlyInAnyOrder("ARCANA", "ENCHANTMENT", "ITEM", "SPELL");
        mvc.perform(get("/api/wiki/v1/patches/00000000-0000-0000-0000-000000000001/changes")
                .param("domain", "ITEM"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_QUERY_PARAMETER"));
    }

    @Test
    void documentedPublicDomainsDispatchToTheirExistingChangeProviders() {
        var patches = mock(PatchCatalog.class);
        var heroes = mock(HeroChangeQueries.class);
        var spells = mock(SpellChangeQueries.class);
        var patchId = UUID.randomUUID();
        var variantId = UUID.randomUUID();
        when(patches.published(patchId, "VN", "vi-VN")).thenReturn(Map.of("variantId", variantId));
        when(heroes.forVariant(variantId, "vi-VN")).thenReturn(List.of());
        when(spells.forVariant(variantId, "vi-VN")).thenReturn(List.of());
        var controller = new PatchPageController(patches, heroes, spells);
        for (String domain : List.of("HERO", "SPELL")) {
            assertThat(controller.changes(patchId, "VN", "vi-VN", domain, 0, 50,
                    new MockHttpServletRequest()).getStatusCode().value()).isEqualTo(200);
        }
        verify(heroes).forVariant(variantId, "vi-VN");
        verify(spells).forVariant(variantId, "vi-VN");
    }

    Set<String> domainValues(JsonNode spec, String path) {
        Set<String> values = new HashSet<>();
        findParameter(spec.path("paths").path(path).path("get"), "domain")
                .path("schema").path("enum").forEach(value -> values.add(value.asText()));
        return values;
    }

    private JsonNode contentSchema(JsonNode message) {
        for (var media : message.path("content").properties()) {
            if (media.getValue().has("schema")) {
                return media.getValue().path("schema");
            }
        }
        throw new AssertionError("Missing content schema: " + message);
    }

    private JsonNode resolve(JsonNode spec, JsonNode schema) {
        return schema.has("$ref") ? spec.at(schema.path("$ref").asText().substring(1)) : schema;
    }

    private JsonNode findParameter(JsonNode operation, String name) {
        for (var parameter : operation.path("parameters")) {
            if (name.equals(parameter.path("name").asText())) {
                return parameter;
            }
        }
        throw new AssertionError("Missing parameter: " + name);
    }

    private void assertLocalReferencesResolve(JsonNode node, JsonNode root) {
        if (node.isObject()) {
            if (node.has("$ref")) {
                String ref = node.path("$ref").asText();
                assertThat(ref).startsWith("#/");
                assertThat(root.at(ref.substring(1)).isMissingNode()).as(ref).isFalse();
            }
            for (var property : node.properties()) {
                assertLocalReferencesResolve(property.getValue(), root);
            }
        } else if (node.isArray()) {
            for (var element : node) {
                assertLocalReferencesResolve(element, root);
            }
        }
    }

    boolean persistArtifact() {
        return false;
    }

    private static RequestPostProcessor reader() {
        return jwt().authorities(new SimpleGrantedAuthority("catalog:read"));
    }
}
