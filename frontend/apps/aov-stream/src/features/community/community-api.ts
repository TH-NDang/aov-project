import type { ApiRequest } from "../../lib/api-client"
import { communityRequest } from "../../lib/stream-api"

/** One community request: a body makes it a POST unless `method` says otherwise. */
export const communityApi = <T>(path: string, body?: unknown, method?: ApiRequest["method"]) =>
  communityRequest<T>(path, { body, method })
