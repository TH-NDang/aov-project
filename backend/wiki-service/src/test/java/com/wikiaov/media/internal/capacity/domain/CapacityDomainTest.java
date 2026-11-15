package com.wikiaov.media.internal.capacity.domain;

import static org.assertj.core.api.Assertions.assertThat;

import com.wikiaov.media.internal.capacity.domain.R2Operations.OperationClass;
import org.junit.jupiter.api.Test;

class CapacityDomainTest {

    @Test
    void levelsWarnBeforeTheFreeTierRunsOut() {
        assertThat(CapacityLevel.of(0.44, 0.8, 0.95)).isEqualTo(CapacityLevel.OK);
        assertThat(CapacityLevel.of(0.8, 0.8, 0.95)).isEqualTo(CapacityLevel.WARNING);
        assertThat(CapacityLevel.of(0.95, 0.8, 0.95)).isEqualTo(CapacityLevel.CRITICAL);
        assertThat(CapacityLevel.of(1.0, 0.8, 0.95)).isEqualTo(CapacityLevel.CRITICAL);
        assertThat(CapacityLevel.of(1.01, 0.8, 0.95)).isEqualTo(CapacityLevel.OVER);
    }

    @Test
    void operationsFollowTheCloudflareClassesAndUnknownNamesCountAsClassA() {
        assertThat(R2Operations.classify("PutObject")).isEqualTo(OperationClass.CLASS_A);
        assertThat(R2Operations.classify("CopyObject")).isEqualTo(OperationClass.CLASS_A);
        assertThat(R2Operations.classify("ListObjects")).isEqualTo(OperationClass.CLASS_A);
        assertThat(R2Operations.classify("GetObject")).isEqualTo(OperationClass.CLASS_B);
        assertThat(R2Operations.classify("HeadObject")).isEqualTo(OperationClass.CLASS_B);
        assertThat(R2Operations.classify("UsageSummary")).isEqualTo(OperationClass.CLASS_B);
        assertThat(R2Operations.classify("DeleteObject")).isEqualTo(OperationClass.FREE);
        assertThat(R2Operations.classify("AbortMultipartUpload")).isEqualTo(OperationClass.FREE);
        assertThat(R2Operations.classify("SomethingNew")).isEqualTo(OperationClass.CLASS_A);
    }
}
