import "./draft-marks.css"

/**
 * The marks a draft wears in every app, so Admin records a draft the way Stream shows it.
 *
 * `BAN_FACE` goes on the element that frames a banned hero's picture: the picture turns grey and dim and a small red
 * "no" sign sits on its corner; pointed at, the hero comes back to colour. With `data-empty` the frame keeps its place
 * and a faint sign, for a ban nobody made or nobody saw.
 */
export const BAN_FACE = "aov-ban"

/**
 * `DRAFT_ROW` goes on a row of one side's turns. Where both sides stand side by side, as a broadcast shows them, the
 * row of the side on the right takes `data-mirrored`: its first turn stands at the outer edge and its turns read from
 * right to left. The document keeps the order of the turns, so the keyboard and screen readers follow the turns.
 */
export const DRAFT_ROW = "aov-draft-row"
