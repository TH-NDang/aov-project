package com.wikiaov.access.internal.infrastructure;

import com.wikiaov.access.AcceptedCommands;
import com.wikiaov.access.Actor;
import java.util.Set;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;

@Component
class RunAcceptedCommands implements AcceptedCommands {
    public void runHeroImport(Actor owner, Runnable command) {
        var previous = SecurityContextHolder.getContext();
        var context = SecurityContextHolder.createEmptyContext();
        context.setAuthentication(new AcceptedCommandAuthentication(new Actor(owner.issuer(), owner.subject(),
                owner.type(), owner.displayName(), Set.of("hero:write", "catalog:read"))));
        try {
            SecurityContextHolder.setContext(context);
            command.run();
        } finally {
            SecurityContextHolder.setContext(previous);
        }
    }
}
