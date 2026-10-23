package com.wikiaov.architecture;

import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.noClasses;

import com.tngtech.archunit.core.domain.JavaClasses;
import com.tngtech.archunit.core.importer.ClassFileImporter;
import com.tngtech.archunit.core.importer.ImportOption;
import org.junit.jupiter.api.Test;

class LayerArchitectureTests {
    private static final JavaClasses APPLICATION = new ClassFileImporter()
            .withImportOption(new ImportOption.DoNotIncludeTests()).importPackages("com.wikiaov");

    @Test
    void domainRulesStayIndependentOfFrameworksAndAdapters() {
        noClasses().that().resideInAPackage("..internal..domain..")
                .should().dependOnClassesThat().resideInAnyPackage(
                        "org.springframework..", "jakarta.persistence..", "jakarta.servlet..",
                        "org.hibernate..", "software.amazon.awssdk..", "java.sql..", "java.net.http..",
                        "..internal..application..", "..internal..persistence..", "..internal..infrastructure..",
                        "..internal..web..")
                .because("domain rules must be testable without HTTP, persistence or external services")
                .check(APPLICATION);
    }

    @Test
    void controllersUseApplicationContractsInsteadOfPersistenceOrStorage() {
        noClasses().that().haveSimpleNameEndingWith("Controller")
                .should().dependOnClassesThat().resideInAnyPackage(
                        "..internal..persistence..", "org.springframework.jdbc..", "jakarta.persistence..",
                        "software.amazon.awssdk..")
                .because("HTTP adapters must delegate workflows to their module's application layer")
                .check(APPLICATION);
    }

    @Test
    void applicationWorkflowsKeepDirectIoInTheirAdapters() {
        noClasses().that().resideInAPackage("..internal..application..")
                .should().dependOnClassesThat().resideInAnyPackage(
                        "jakarta.persistence..", "org.springframework.jdbc..", "software.amazon.awssdk..",
                        "java.net.http..")
                .because("use cases orchestrate repositories and ports rather than issue raw IO")
                .check(APPLICATION);
    }
}
