const attentionCounts: { itemIssues?: number } = {}

/** Keep optional navigation badge slots without loading retired resource reports. */
export function useAttentionCounts() {
  return attentionCounts
}
