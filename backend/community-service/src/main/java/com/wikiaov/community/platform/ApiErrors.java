package com.wikiaov.community.platform;

import org.springframework.http.*;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.*;

@RestControllerAdvice
class ApiErrors {
    @ExceptionHandler(ApiException.class)
    ProblemDetail handle(ApiException error) {
        var problem = ProblemDetail.forStatusAndDetail(HttpStatusCode.valueOf(error.status()), error.getMessage());
        problem.setProperty("code", error.code());
        error.properties().forEach(problem::setProperty);
        return problem;
    }

    @ExceptionHandler({IllegalArgumentException.class, HttpMessageNotReadableException.class,
            MethodArgumentNotValidException.class})
    ProblemDetail invalid(Exception error) {
        var problem = ProblemDetail.forStatusAndDetail(HttpStatus.BAD_REQUEST, "The request contains invalid values.");
        problem.setProperty("code", "TOURNAMENT_INVALID_REQUEST");
        return problem;
    }

    @ExceptionHandler(org.springframework.dao.DataIntegrityViolationException.class)
    ProblemDetail duplicate(Exception error) {
        var problem = ProblemDetail.forStatusAndDetail(HttpStatus.CONFLICT,
                "A record already reserves this identity, including records in the trash. Restore or edit the existing record.");
        problem.setProperty("code", "TOURNAMENT_DUPLICATE_CODE");
        return problem;
    }

    @ExceptionHandler(ObjectOptimisticLockingFailureException.class)
    ProblemDetail conflict(Exception error) {
        var problem = ProblemDetail.forStatusAndDetail(HttpStatus.CONFLICT,
                "The record changed. Reload before saving.");
        problem.setProperty("code", "TOURNAMENT_VERSION_CONFLICT");
        return problem;
    }
}
