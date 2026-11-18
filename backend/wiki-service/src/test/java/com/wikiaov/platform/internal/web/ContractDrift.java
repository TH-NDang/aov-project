package com.wikiaov.platform.internal.web;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.TreeSet;
import org.jspecify.annotations.Nullable;
import tools.jackson.databind.JsonNode;

/**
 * Where a hand-written OpenAPI contract, which Admin generates its types from, leaves out what the API sends. Each of
 * its operations is compared with the document generated from the code: a field the API sends must be documented, an
 * enum must list the values the API sends, and a type must match. A contract may say more than the generated document
 * where the code uses a map or a string.
 */
final class ContractDrift {
    private static final Set<String> METHODS = Set.of("get", "post", "put", "patch", "delete");

    private final JsonNode contract;
    private final JsonNode generated;
    private final List<String> problems = new ArrayList<>();
    private final Set<String> compared = new HashSet<>();

    private ContractDrift(JsonNode contract, JsonNode generated) {
        this.contract = contract;
        this.generated = generated;
    }

    static List<String> between(JsonNode contract, JsonNode generated) {
        var drift = new ContractDrift(contract, generated);
        drift.compareOperations();
        return drift.problems;
    }

    private void compareOperations() {
        for (var path : contract.path("paths").properties()) {
            for (var operation : path.getValue().properties()) {
                if (!METHODS.contains(operation.getKey())) {
                    continue;
                }

                String label = operation.getKey().toUpperCase(Locale.ROOT) + " " + path.getKey();
                JsonNode actual = generated.path("paths").path(path.getKey()).path(operation.getKey());
                if (actual.isMissingNode()) {
                    problems.add(label + ": the API has no such operation");
                    continue;
                }

                for (var response : operation.getValue().path("responses").properties()) {
                    JsonNode documented = schemaOf(response.getValue());
                    if (!response.getKey().startsWith("2") || documented == null) {
                        continue;
                    }
                    JsonNode sent = schemaOf(actual.path("responses").path(response.getKey()));
                    if (sent == null) {
                        problems.add(label + " " + response.getKey() + ": the API answers without this body");
                        continue;
                    }
                    compare(label + " " + response.getKey(), documented, sent);
                }
                JsonNode body = schemaOf(operation.getValue().path("requestBody"));
                JsonNode accepted = schemaOf(actual.path("requestBody"));
                if (body != null && accepted != null) {
                    compare(label + " body", body, accepted);
                }
            }
        }
    }

    private void compare(String where, JsonNode documentedSchema, JsonNode sentSchema) {
        if (documentedSchema.has("$ref") && sentSchema.has("$ref")
                && !compared.add(documentedSchema.path("$ref").asText() + " " + sentSchema.path("$ref").asText())) {
            return;
        }

        JsonNode documented = resolve(contract, documentedSchema);
        JsonNode sent = resolve(generated, sentSchema);
        String documentedType = type(documented);
        String sentType = type(sent);
        if (sent.has("enum") && !values(sent).equals(values(documented))) {
            problems.add(where + ": the API sends " + values(sent) + ", the contract documents "
                    + (documented.has("enum") ? values(documented) : documentedType));
        }
        if (sentType != null && documentedType != null && !sentType.equals(documentedType)) {
            problems.add(where + ": the API sends " + sentType + ", the contract documents " + documentedType);
            return;
        }

        if (sent.has("items") && documented.has("items")) {
            compare(where + "[]", documented.path("items"), sent.path("items"));
        }
        JsonNode sentProperties = sent.path("properties");
        JsonNode documentedProperties = documented.path("properties");
        if (!sentProperties.isEmpty() && !documentedProperties.isEmpty()) {
            for (var property : sentProperties.properties()) {
                if (documentedProperties.has(property.getKey())) {
                    compare(where + "." + property.getKey(), documentedProperties.path(property.getKey()),
                            property.getValue());
                } else {
                    problems.add(where + "." + property.getKey() + ": the API sends it, the contract leaves it out");
                }
            }
        }
        if (sent.path("additionalProperties").isObject() && documented.path("additionalProperties").isObject()) {
            compare(where + "{}", documented.path("additionalProperties"), sent.path("additionalProperties"));
        }
    }

    private static @Nullable JsonNode schemaOf(JsonNode message) {
        for (var media : message.path("content").properties()) {
            if (media.getKey().contains("json") && media.getValue().has("schema")) {
                return media.getValue().path("schema");
            }
        }
        return null;
    }

    /** Follows references and drops the wrappers both generators put around a single or nullable schema. */
    private static JsonNode resolve(JsonNode document, JsonNode schema) {
        JsonNode current = schema;
        for (int depth = 0; depth < 20; depth++) {
            if (current.has("$ref")) {
                current = document.at(current.path("$ref").asText().substring(1));
            } else if (current.path("allOf").size() == 1) {
                current = current.path("allOf").path(0);
            } else if (single(current.path("oneOf")) != null) {
                current = single(current.path("oneOf"));
            } else if (single(current.path("anyOf")) != null) {
                current = single(current.path("anyOf"));
            } else {
                return current;
            }
        }
        return current;
    }

    private static @Nullable JsonNode single(JsonNode alternatives) {
        JsonNode found = null;
        for (var alternative : alternatives) {
            if ("null".equals(alternative.path("type").asText())) {
                continue;
            }
            if (found != null) {
                return null;
            }
            found = alternative;
        }
        return found;
    }

    private static @Nullable String type(JsonNode schema) {
        JsonNode type = schema.path("type");
        if (type.isArray()) {
            for (var value : type) {
                if (!"null".equals(value.asText())) {
                    return value.asText();
                }
            }
            return null;
        }
        if (type.isString()) {
            return type.asText();
        }
        return schema.has("properties") ? "object" : null;
    }

    private static Set<String> values(JsonNode schema) {
        Set<String> values = new TreeSet<>();
        schema.path("enum").forEach(value -> {
            if (!value.isNull()) {
                values.add(value.asText());
            }
        });
        return values;
    }
}
