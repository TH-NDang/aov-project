/** Present the game's five segments while preserving the stored ten-point contract. */
export function heroRatingScale(scaleCode: string) {
  return scaleCode === "GAME_OVERVIEW_10" ? { maximum: 5, factor: 2 } : { maximum: 10, factor: 1 }
}
