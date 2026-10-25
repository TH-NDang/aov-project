package com.wikiaov.platform.internal.web;

import static org.assertj.core.api.Assertions.assertThat;

import com.sun.source.tree.ClassTree;
import com.sun.source.tree.MethodTree;
import com.sun.source.util.JavacTask;
import io.swagger.v3.oas.annotations.Operation;
import jakarta.validation.Validation;
import jakarta.validation.groups.Default;
import java.lang.annotation.Annotation;
import java.lang.reflect.Method;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.StringJoiner;
import java.util.TreeMap;
import javax.tools.ToolProvider;
import org.junit.jupiter.api.Test;
import org.springframework.core.annotation.AnnotatedElementUtils;
import org.springframework.web.bind.annotation.RequestMapping;
import tools.jackson.databind.json.JsonMapper;

class ApiInterfaceContractTest {
    private static final Path SOURCES = Path.of("src/main/java");
    private static final JsonMapper JSON = JsonMapper.builder().build();
    private static final String CONSTRAINT = "@(Valid|Min|Max|Size|NotNull|NotBlank|NotEmpty|Positive|PositiveOrZero|Negative|NegativeOrZero|Pattern)(?:\\([^)]*\\))?";

    @Test
    void everyEndpointHasExactlyOneInterfaceOwnedOperationAndValidConstraintHierarchy() throws Exception {
        int controllers = 0;
        int operations = 0;
        Set<String> ids = new java.util.HashSet<>();
        try (var validatorFactory = Validation.buildDefaultValidatorFactory(); var files = Files.walk(SOURCES)) {
            for (Path file : files.filter(p -> p.toString().endsWith("Controller.java")).toList()) {
                if (file.getFileName().toString().equals("ProblemErrorController.java")) {
                    continue;
                }
                String name = controllerClassName(SOURCES.relativize(file));
                Class<?> controller = Class.forName(name);
                Class<?> contract = Class.forName(name.replace("Controller", "Api"));
                assertThat(contract.isInterface()).as(name).isTrue();
                assertThat(contract.isAssignableFrom(controller)).as(name).isTrue();
                assertThat(controller.getDeclaredAnnotations()).allMatch(a -> !isDocumentation(a));
                var descriptor = validatorFactory.getValidator().getConstraintsForClass(controller);
                for (Method method : controller.getDeclaredMethods()) {
                    if (!AnnotatedElementUtils.hasAnnotation(method, RequestMapping.class)) {
                        continue;
                    }
                    Method apiMethod = contract.getDeclaredMethod(method.getName(), method.getParameterTypes());
                    Operation operation = apiMethod.getDeclaredAnnotation(Operation.class);
                    assertThat(operation).as(method.toString()).isNotNull();
                    assertThat(operation.description()).isNotBlank();
                    assertThat(operation.responses()).isNotEmpty();
                    assertThat(ids.add(operation.operationId())).as(operation.operationId()).isTrue();
                    assertThat(method.getDeclaredAnnotations()).noneMatch(ApiInterfaceContractTest::isDocumentation);
                    for (var parameter : method.getParameters()) {
                        assertThat(parameter.getDeclaredAnnotations())
                                .noneMatch(ApiInterfaceContractTest::isDocumentation);
                        assertThat(parameter.getDeclaredAnnotations())
                                .noneMatch(ApiInterfaceContractTest::isValidation);
                    }
                    var constraints = descriptor.getConstraintsForMethod(method.getName(), method.getParameterTypes());
                    if (constraints != null) {
                        constraints.getParameterDescriptors().forEach(parameter -> parameter.getConstraintDescriptors()
                                .forEach(constraint -> assertThat(constraint.getGroups()).contains(Default.class)));
                    }
                    operations++;
                }
                controllers++;
            }
        }
        assertThat(controllers).isEqualTo(38);
        assertThat(operations).isEqualTo(165);
    }

    @Test
    void derivesControllerClassNamesFromSourcePathComponents() {
        Path relativeSource = Path.of("com", "wikiaov", "hero", "internal", "web", "HeroAdminController.java");

        assertThat(controllerClassName(relativeSource))
                .isEqualTo("com.wikiaov.hero.internal.web.HeroAdminController");
    }

    @Test
    void controllerBehaviorMappingsSecurityAndBindingMatchThePreDocumentationBaseline() throws Exception {
        var baseline = JSON.readTree(Path.of("src/test/resources/contracts/controller-baseline.json").toFile());
        for (var entry : baseline.properties()) {
            String source = Files.readString(SOURCES.resolve(entry.getKey()));
            // DOTALL is necessary for Javadoc; imports may be cleaned by Spotless after moving annotations.
            String normalized = source.replaceAll("(?s)/\\*.*?\\*/|//[^\\n]*", "")
                    .replaceAll("(?m)^import .*;\\s*", "")
                    .replaceAll(" implements \\w+Api", "")
                    .replaceAll("\\bpublic\\s+", "")
                    .replaceAll(CONSTRAINT, "")
                    .replaceAll("\\s+", "");
            String digest = HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                    .digest(normalized.getBytes(StandardCharsets.UTF_8)));
            assertThat(digest).as(entry.getKey()).isEqualTo(entry.getValue().asText());
        }
    }

    @Test
    void validationAnnotationsIncludingArgumentsMovedWithoutDuplicationOrLoss() throws Exception {
        var baseline = JSON.readTree(Path.of("src/test/resources/contracts/validation-baseline.json").toFile());
        var compiler = ToolProvider.getSystemJavaCompiler();
        assertThat(compiler).as("Tests require the project JDK, not a JRE").isNotNull();
        try (var files = Files.walk(SOURCES); var manager = compiler.getStandardFileManager(null, null, null)) {
            var paths = files.filter(p -> p.toString().endsWith("Api.java")).toList();
            var task = (JavacTask) compiler.getTask(null, manager, null, List.of("-proc:none"), null,
                    manager.getJavaFileObjectsFromPaths(paths));
            Map<String, List<List<String>>> actual = new TreeMap<>();
            for (var unit : task.parse()) {
                for (var declaration : unit.getTypeDecls()) {
                    if (!(declaration instanceof ClassTree type)) {
                        continue;
                    }
                    for (var member : type.getMembers()) {
                        if (!(member instanceof MethodTree method)) {
                            continue;
                        }
                        List<List<String>> parameters = new ArrayList<>();
                        for (var parameter : method.getParameters()) {
                            parameters.add(parameter.getModifiers().getAnnotations().stream()
                                    .filter(a -> a.getAnnotationType().toString()
                                            .matches(CONSTRAINT.substring(1, CONSTRAINT.indexOf("(?:"))))
                                    .map(a -> a.toString().replaceAll("\\s+", ""))
                                    .sorted().toList());
                        }
                        actual.put(unit.getPackageName() + "."
                                + type.getSimpleName().toString().replace("Api", "Controller")
                                + "#" + method.getName(), parameters);
                    }
                }
            }
            for (var entry : baseline.properties()) {
                assertThat((tools.jackson.databind.JsonNode) JSON.valueToTree(actual.get(entry.getKey())))
                        .as(entry.getKey()).isEqualTo(entry.getValue());
            }
        }
    }

    private static String controllerClassName(Path relativeSource) {
        var name = new StringJoiner(".");
        for (Path component : relativeSource) {
            name.add(component.toString());
        }
        String qualifiedName = name.toString();
        return qualifiedName.substring(0, qualifiedName.length() - ".java".length());
    }

    private static boolean isDocumentation(Annotation annotation) {
        return annotation.annotationType().getPackageName().startsWith("io.swagger.v3.oas.annotations");
    }

    private static boolean isValidation(Annotation annotation) {
        return annotation.annotationType().getPackageName().startsWith("jakarta.validation");
    }
}
