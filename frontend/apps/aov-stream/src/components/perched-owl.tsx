import "./perched-owl.css"

/**
 * The owl of the logo without its tile, its talons around the line it sits on: that line runs 4px above the bottom of
 * the drawing. Inside a control it looks up while the control is pointed at or focused.
 */
export function PerchedOwl() {
  return (
    <svg className="hub-owl" viewBox="15 14 42 52" width="42" height="52" aria-hidden="true" focusable="false">
      <path d="m18 16 13 8h10l13-8-2 24c2 13-6 22-16 22S17 53 20 40Z" fill="#7d87b1" />
      <path d="M20 37c-8 14-3 21 6 23l-1-21m27-2c8 14 3 21-6 23l1-21" fill="#555f8e" />
      <path d="M20 27c7-5 12-3 16 2 4-5 9-7 16-2l-1 12c-2 8-9 12-15 15-6-3-13-7-15-15Z" fill="#eee0ba" />
      <ellipse cx="28" cy="35" rx="8" ry="9" fill="#d3a857" />
      <ellipse cx="44" cy="35" rx="8" ry="9" fill="#d3a857" />
      <g className="hub-owl-gaze">
        <ellipse cx="29" cy="35" rx="4.3" ry="5.7" fill="#1c2a3b" />
        <ellipse cx="43" cy="35" rx="4.3" ry="5.7" fill="#1c2a3b" />
        <circle cx="30.6" cy="32.8" r="1.7" fill="#fff4d7" />
        <circle cx="44.6" cy="32.8" r="1.7" fill="#fff4d7" />
      </g>
      <path d="m32.5 43 3.5-4 3.5 4-3.5 5Z" fill="#bd8055" />
      <g fill="none" strokeLinecap="round">
        <path d="m29 55 3 2m8 0 3-2" stroke="#bdb58e" strokeWidth="2" />
        <path d="M28.5 60.5v4m3.5-4v4m8-4v4m3.5-4v4" stroke="#bd8055" strokeWidth="2.4" />
      </g>
    </svg>
  )
}
