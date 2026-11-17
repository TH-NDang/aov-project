package com.wikiaov.platform.internal.web;

import static org.assertj.core.api.Assertions.assertThat;

import io.swagger.v3.oas.annotations.Operation;
import jakarta.validation.Validation;
import jakarta.validation.groups.Default;
import java.lang.annotation.Annotation;
import java.lang.reflect.Method;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.HashSet;
import java.util.Set;
import java.util.StringJoiner;
import org.junit.jupiter.api.Test;
import org.springframework.core.annotation.AnnotatedElementUtils;
import org.springframework.web.bind.annotation.RequestMapping;

class ApiInterfaceContractTest {
    private static final Path SOURCES = Path.of("src/main/java");

    @Test
    void everyEndpointHasExactlyOneInterfaceOwnedOperationAndValidConstraintHierarchy() throws Exception {
        int operations = 0;
        Set<String> ids = new HashSet<>();
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
                    assertThat(operation.description()).as(method.toString()).isNotBlank();
                    assertThat(operation.responses()).as(method.toString()).isNotEmpty();
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
            }
        }
        assertThat(operations).as("controller operations found under " + SOURCES).isPositive();
    }

    @Test
    void derivesControllerClassNamesFromSourcePathComponents() {
        Path relativeSource = Path.of("com", "wikiaov", "hero", "internal", "web", "HeroAdminController.java");

        assertThat(controllerClassName(relativeSource))
                .isEqualTo("com.wikiaov.hero.internal.web.HeroAdminController");
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
