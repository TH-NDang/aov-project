package com.wikiaov.community.testsupport;

import org.junit.jupiter.api.extension.ConditionEvaluationResult;
import org.junit.jupiter.api.extension.ExecutionCondition;
import org.junit.jupiter.api.extension.ExtensionContext;
import org.testcontainers.DockerClientFactory;

/** Evaluated before Spring starts, so a skipped class never tries to reach a database. */
public final class DockerGate implements ExecutionCondition {
    @Override
    public ConditionEvaluationResult evaluateExecutionCondition(ExtensionContext context) {
        if (DockerClientFactory.instance().isDockerAvailable()) {
            return ConditionEvaluationResult.enabled("Docker is available.");
        }
        return ConditionEvaluationResult.disabled("Docker is not available; container tests are skipped.");
    }
}
