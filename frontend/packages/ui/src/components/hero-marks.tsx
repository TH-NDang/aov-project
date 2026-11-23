import type { CSSProperties, ReactNode } from "react"
import { cn } from "@aov/ui/lib/utils"

/**
 * The marks of a hero's lane, role and difficulty, drawn on a 48 grid in the colour of the text around them. Every app
 * draws lanes and roles with these, so a lane reads the same in the Wiki, Admin and Stream.
 */
const MARKS = {
  /**
   * The Dark Slayer (top) lane mark as the tournament broadcast draws it: the map is cut into separate pieces with a
   * gap between them, the chosen piece filled and the others drawn as thin outlines; the top lane and the bottom
   * lane meet at the diagonal and the empty centre holds a dot with a second one half hidden behind it.
   */
  top: (
    <>
      <path d="M2 2L43.9 2L33.9 12L12 12L12 33.9L2 43.9Z" />
      <path
        d="M44.8 7L44.8 44.8L7 44.8L14.6 37.2L37.2 37.2L37.2 14.6Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
      />
      <circle cx="22.5" cy="25.5" r="6" />
      <path d="M24.37 17.72A4.5 4.5 0 1 1 30.28 23.63A8 8 0 0 0 24.37 17.72Z" />
    </>
  ),
  /**
   * The jungle mark as the tournament broadcast draws it: two filled triangles split by a diagonal gap, set off from
   * the thin map outline.
   */
  jungle: (
    <>
      <rect x="3.2" y="3.2" width="41.6" height="41.6" fill="none" stroke="currentColor" strokeWidth="2.4" />
      <path d="M7.6 7.6H33.2L7.6 33.2Z" />
      <path d="M40.4 40.4H14.8L40.4 14.8Z" />
    </>
  ),
  /**
   * The middle lane mark as the tournament broadcast draws it: the map is cut into separate pieces with a gap
   * between them, the chosen piece filled and the others drawn as thin outlines; the middle band runs from corner to
   * corner between the two side lanes.
   */
  mid: (
    <>
      <path d="M40 2L46 2L46 8L8 46L2 46L2 40Z" />
      <path
        d="M3.2 3.2L33.1 3.2L25.5 10.8L10.8 10.8L10.8 25.5L3.2 33.1Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
      />
      <path
        d="M44.8 44.8L14.9 44.8L22.5 37.2L37.2 37.2L37.2 22.5L44.8 14.9Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
      />
    </>
  ),
  /**
   * The Abyssal Dragon (bottom) lane mark as the tournament broadcast draws it: the map is cut into separate pieces
   * with a gap between them, the chosen piece filled and the others drawn as thin outlines; the bottom lane and the
   * top lane meet at the diagonal and the empty centre holds a dot.
   */
  dragon: (
    <>
      <path d="M46 46L4.1 46L14.1 36L36 36L36 14.1L46 4.1Z" />
      <path
        d="M3.2 41L3.2 3.2L41 3.2L33.4 10.8L10.8 10.8L10.8 33.4Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
      />
      <circle cx="24" cy="24" r="6" />
    </>
  ),
  /** The roaming support lane uses the same mark as the support role, traced from the game's own icon. */
  roam: (
    <path
      fillRule="evenodd"
      d="M3.43 3.58L3.73 3.70L6.62 6.76L15.54 16.34L16.46 17.52L16.74 24.00L17.78 27.77L18.88 30.08L23.24 37.01L23.88 38.54L25.15 37.37L25.66 36.15L29.96 29.32L30.95 26.92L31.93 22.42L32.06 17.68L32.39 16.96L43.96 4.55L44.95 3.70L45.39 3.48L45.69 3.94L45.66 6.01L45.43 8.20L44.62 11.85L43.64 13.67L42.67 15.01L39.68 17.88L37.27 19.50L36.48 20.60L36.35 21.45L36.64 21.78L37.49 21.71L39.05 20.84L41.99 18.90L45.27 16.34L45.63 16.71L45.54 18.04L44.70 21.08L44.15 21.93L43.69 22.84L42.84 23.82L40.65 25.62L38.46 26.64L36.15 27.25L35.45 27.65L35.01 28.25L35.18 28.68L35.55 28.96L37.61 28.77L38.95 28.54L42.48 27.39L42.72 28.38L41.68 30.32L40.67 31.41L39.02 32.51L36.64 33.40L32.63 33.74L31.66 34.04L27.52 38.70L25.60 41.50L25.05 42.72L23.88 43.81L23.26 42.23L21.19 39.07L19.32 36.76L16.54 33.97L16.10 33.74L12.21 33.50L9.39 32.51L7.96 31.52L7.10 30.67L6.15 29.35L5.85 28.25L6.01 27.87L6.38 27.63L9.66 28.59L12.21 28.91L13.18 28.93L13.57 28.25L13.30 27.89L12.21 27.22L9.90 26.63L7.95 25.70L6.38 24.65L5.28 23.59L4.29 22.18L3.34 20.04L2.96 17.56L3.13 16.71L3.58 16.45L6.25 18.81L9.29 20.83L10.39 21.29L11.24 21.89L11.85 21.45L11.82 20.48L11.48 19.89L7.44 16.71L5.28 14.37L4.25 12.82L3.46 10.63ZM23.88 13.55L24.19 13.67L25.15 14.64L25.58 15.86L26.08 16.59L26.58 17.92L28.09 20.72L28.69 22.42L28.13 24.12L26.57 27.04L26.13 28.25L25.58 29.08L25.13 30.32L24.36 31.09L24.00 31.41L23.71 31.17L23.27 29.96L22.71 29.10L22.30 27.96L21.76 27.16L19.64 22.54L19.87 21.75Z"
    />
  ),
  /** The game's tank mark, its outline traced from the game's own icon so the shape matches it. */
  tank: (
    <path
      fillRule="evenodd"
      d="M23.35 2.58L24.58 2.52L28.31 5.26L32.63 7.55L37.66 9.24L38.01 9.62L38.51 10.92L39.19 13.22L40.39 14.91L43.12 17.24L43.37 17.67L42.57 20.55L42.11 23.14L41.43 24.72L40.91 26.73L38.70 31.48L37.34 33.63L35.22 36.44L31.91 39.83L27.88 43.10L24.58 45.31L23.28 45.21L18.68 42.07L14.81 38.67L11.58 35.07L9.28 31.48L6.95 26.44L6.42 24.29L5.72 22.71L5.27 20.12L4.55 17.67L4.82 17.24L7.39 15.08L8.65 13.36L9.92 9.62L10.20 9.27L15.23 7.59L16.24 6.93L17.67 6.43L21.31 4.16ZM24.29 6.74L23.28 6.81L22.35 7.61L20.22 8.76L18.82 9.22L17.82 9.87L16.24 10.35L15.08 10.99L13.07 11.60L12.75 11.92L12.46 13.07L12.83 20.26L13.79 26.29L14.99 30.47L15.62 31.62L16.14 33.20L18.58 37.23L20.71 39.67L22.56 41.39L23.14 42.21L23.53 42.41L24.58 42.42L25.34 41.40L28.29 38.52L30.61 35.36L31.76 33.25L32.95 30.47L34.07 26.59L35.05 20.84L35.39 16.38L35.42 12.93L34.95 11.63L30.18 9.91L29.18 9.25L27.59 8.70ZM23.57 14.65L24.43 14.53L24.80 14.94L25.38 16.52L27.16 19.80L27.61 21.12L28.30 22.13L28.57 23.28L28.25 24.58L26.45 27.88L25.95 29.32L25.34 30.18L24.83 31.62L24.58 32.02L24.29 32.07L23.42 31.95L23.11 31.62L22.53 30.04L21.91 29.18L21.41 27.74L19.62 24.43L19.33 23.42L19.58 22.27L20.25 21.27L20.75 19.83L22.56 16.52L23.06 15.08Z"
    />
  ),
  /** The game's warrior mark, its outline traced from the game's own icon so the shape matches it. */
  warrior: (
    <path
      fillRule="evenodd"
      d="M23.45 3.03L24.34 2.96L24.68 3.12L27.40 5.65L28.33 6.85L29.15 8.38L29.49 9.87L29.55 32.55L29.26 33.01L28.90 33.17L28.56 32.83L25.80 28.10L25.13 23.32L24.65 16.36L24.38 14.65L24.34 14.55L23.54 15.01L23.43 15.40L22.76 24.23L22.15 28.10L20.10 31.87L19.33 32.91L18.87 33.21L18.41 32.55L18.41 10.78L18.54 9.30L19.53 7.02L20.47 5.78L22.18 4.05ZM14.92 35.06L32.55 34.96L33.58 35.22L33.91 36.31L34.16 38.93L34.03 39.12L33.46 39.34L32.55 38.74L30.73 38.35L26.17 38.34L25.67 39.05L25.68 40.87L25.94 41.86L27.61 43.49L27.65 44.52L27.19 45.14L24.34 44.80L20.69 45.08L20.30 44.52L20.31 43.61L22.07 41.78L22.31 40.76L22.22 38.82L21.61 38.31L17.16 38.36L15.68 38.66L14.54 39.33L14.20 39.32L13.82 38.93L14.05 36.31L14.31 35.40Z"
    />
  ),
  /** The game's assassin mark, its outline traced from the game's own icon so the shape matches it. */
  assassin: (
    <path
      fillRule="evenodd"
      d="M4.69 2.14L6.06 2.28L7.46 3.40L13.77 11.25L15.03 11.45L16.94 9.99L18.39 9.21L19.38 9.00L20.64 9.20L22.27 10.41L21.90 10.92L20.78 11.40L19.38 12.48L17.67 14.19L11.71 19.10L9.54 20.92L7.04 21.94L5.69 21.90L3.55 20.64L3.68 20.28L4.30 19.80L6.55 18.68L8.31 17.39L9.56 16.01L9.99 15.03L9.68 13.77L7.91 11.67L6.07 9.01L4.80 8.15L3.68 8.13L2.70 9.04L2.17 8.45L2.15 6.06L2.38 4.80L3.68 2.60ZM42.41 2.14L43.48 2.30L44.60 3.41L45.52 5.92L45.63 8.31L45.16 8.92L44.18 8.19L43.06 8.03L41.73 8.87L38.10 13.63L37.71 15.03L38.17 16.15L39.41 17.46L40.96 18.61L43.20 19.63L43.81 20.22L43.97 20.64L41.94 21.88L40.82 21.94L38.29 21.00L37.31 20.24L36.19 20.05L34.87 21.62L30.87 27.22L30.59 27.44L29.21 26.80L26.46 22.60L25.82 21.99L25.12 20.64L25.73 19.10L28.72 15.03L29.16 13.91L28.42 12.65L26.84 11.39L25.71 10.83L25.44 10.41L27.22 9.12L28.48 9.02L29.46 9.31L30.87 10.06L32.97 11.69L34.32 10.83L37.16 7.04L40.38 3.26L41.65 2.28ZM19.20 15.87L19.52 15.82L19.69 16.01L22.71 20.64L25.40 23.47L28.06 27.55L28.72 28.20L29.19 29.61L30.30 31.29L33.67 35.66L38.38 40.96L42.46 44.46L43.57 45.16L42.92 45.68L40.39 45.68L38.57 45.46L33.95 44.45L30.87 43.28L28.76 42.16L27.08 41.06L25.36 39.41L23.58 37.60L20.81 33.81L19.21 31.99L17.45 29.32L15.80 27.36L12.50 22.74L12.40 21.76L12.65 21.43L16.15 19.44L17.27 19.42L19.18 22.04L19.71 22.46L21.48 25.12L22.18 25.61L22.47 26.38L23.26 26.94L23.78 27.92L24.34 28.20L24.98 29.57L25.61 29.61L25.37 28.34L24.56 27.85L24.28 26.93L23.64 26.38L22.88 25.01L22.41 24.70L21.98 23.58L18.14 18.39L18.08 17.13ZM25.96 29.73L25.84 30.73L26.10 31.02L26.38 31.03L26.64 30.59L26.24 29.82ZM27.22 31.27L26.86 31.71L27.05 32.13L27.63 32.55L28.34 34.01L28.91 34.37L29.29 35.35L30.03 35.68L30.31 36.47L30.83 36.75L31.17 36.33L30.99 35.91L30.31 35.36L29.68 33.95L29.04 33.56L28.65 32.55L27.92 32.24L27.74 31.71ZM17.05 32.55L17.48 32.83L21.48 38.43L21.04 39.69L19.38 40.93L17.27 42.14L15.59 42.71L14.61 43.27L12.51 43.77L10.82 44.46L8.31 44.87L5.92 45.49L4.80 45.49L4.49 45.16L5.36 44.65L5.78 43.94L8.19 41.94L10.83 39.19L14.09 35.35L15.96 32.69ZM31.57 37.01L31.40 37.45L31.85 37.77L32.10 37.31L31.85 37.01Z"
    />
  ),
  /** The game's mage mark, its outline traced from the game's own icon so the shape matches it. */
  mage: (
    <path
      fillRule="evenodd"
      d="M23.09 4.12L23.33 4.46L24.11 4.84L24.61 6.13L25.10 6.80L26.04 8.81L25.12 10.71L24.53 11.49L23.82 13.28L23.81 14.17L24.72 15.40L25.79 15.31L26.08 14.95L26.76 13.06L27.13 12.70L27.57 12.58L28.67 14.95L29.03 16.40L29.57 17.52L29.88 18.75L30.45 19.76L30.81 20.80L32.60 24.04L33.15 24.67L34.31 26.68L34.20 27.46L34.01 27.69L32.93 28.19L30.14 29.93L26.57 32.74L25.79 33.52L24.89 33.58L24.63 32.82L23.96 28.36L24.22 28.05L24.67 27.89L26.57 27.92L27.21 27.69L28.29 26.68L28.42 25.79L27.91 24.38L27.35 23.71L26.68 23.44L25.79 23.34L24.20 23.44L22.88 23.66L21.28 24.67L20.24 25.79L19.95 26.57L20.14 27.24L20.65 28.13L20.99 29.36L21.50 30.25L21.91 31.82L22.40 32.82L22.47 33.72L22.21 34.06L21.90 33.83L21.65 33.34L19.89 31.71L17.75 29.97L14.84 28.21L13.45 27.57L13.09 26.68L16.16 22.32L17.51 19.87L18.53 18.58L19.64 19.00L21.32 20.64L22.21 20.60L23.14 19.98L23.50 19.53L23.65 18.64L23.52 17.75L22.99 16.74L21.43 15.64L19.42 15.55L18.97 15.07L19.29 14.28L21.43 11.34L22.45 9.59L22.83 7.81ZM6.81 31.26L11.94 31.73L13.28 32.23L15.07 32.60L17.19 33.54L18.75 34.44L20.76 36.15L22.38 38.07L22.88 39.20L23.89 40.63L24.14 40.42L24.63 39.08L25.45 37.84L27.82 35.39L29.14 34.42L30.81 33.53L32.15 33.12L32.93 32.69L37.29 31.67L40.86 31.48L41.76 31.62L42.15 31.93L42.54 32.93L42.43 33.83L41.98 34.68L41.76 34.84L40.97 34.81L39.97 34.35L39.30 34.95L38.84 35.39L38.03 37.18L37.51 39.42L37.07 40.21L36.40 40.48L32.93 40.34L30.25 40.75L28.36 41.53L26.79 42.52L23.89 45.04L22.99 44.65L21.77 43.34L20.65 42.41L19.42 41.62L17.30 40.69L14.06 40.29L10.49 40.40L10.16 39.97L9.90 38.29L9.43 37.29L9.04 35.89L8.15 34.50L7.81 34.28L6.91 34.25L6.02 34.88L5.00 33.72L4.84 32.82L5.13 32.03L6.02 31.36Z"
    />
  ),
  /** The game's marksman mark, its outline traced from the game's own icon so the shape matches it. */
  marksman: (
    <path
      fillRule="evenodd"
      d="M23.78 3.23L24.00 3.13L24.20 3.34L25.10 5.02L25.46 6.13L26.86 8.92L27.81 11.38L26.40 13.28L25.58 14.73L25.48 15.07L25.61 15.96L26.12 16.23L27.91 16.57L30.25 17.41L33.05 19.24L34.87 21.10L36.67 23.78L37.10 24.89L37.61 25.68L39.86 32.01L40.75 33.36L41.64 34.03L42.65 34.35L42.96 34.61L43.32 36.51L43.12 37.29L42.76 37.51L40.53 36.78L39.08 35.61L37.57 33.49L35.98 31.71L33.83 29.96L31.93 28.99L29.25 28.22L26.68 27.89L26.21 27.69L26.08 27.46L26.08 26.68L26.23 26.29L26.57 25.98L27.46 25.91L30.92 26.40L33.30 27.24L34.61 27.94L34.91 27.80L35.08 27.46L34.09 25.56L33.21 24.45L30.59 21.96L28.69 20.92L26.68 20.36L25.89 20.43L25.68 20.60L25.47 21.32L25.47 33.72L25.83 34.61L26.46 35.57L28.66 38.29L28.70 44.44L28.47 44.79L28.24 44.70L27.29 43.77L25.01 40.70L24.00 39.94L20.54 43.93L19.53 44.76L19.21 44.44L19.26 38.29L21.43 35.61L22.23 34.39L22.47 33.72L22.47 21.32L22.10 20.36L21.32 20.35L19.20 20.94L17.41 21.89L16.29 22.79L14.69 24.45L13.81 25.56L12.82 27.46L12.98 27.80L13.28 27.94L14.62 27.23L17.08 26.38L21.21 25.89L21.54 26.12L21.77 26.57L21.79 27.46L21.65 27.70L21.21 27.92L18.64 28.22L15.96 29.01L14.06 30.01L11.96 31.71L10.26 33.58L8.87 35.61L7.47 36.75L5.24 37.57L4.74 37.29L4.60 36.51L4.95 34.61L6.36 33.98L7.13 33.38L8.09 32.04L10.30 25.68L10.81 24.89L11.17 23.89L13.03 21.10L14.84 19.25L17.63 17.43L18.91 17.08L19.98 16.57L21.77 16.24L22.33 15.96L22.46 15.07L22.31 14.62L20.10 11.38L21.01 9.04L22.44 6.18L22.77 5.10Z"
    />
  ),
  /** The game's support mark, its outline traced from the game's own icon so the shape matches it. */
  support: (
    <path
      fillRule="evenodd"
      d="M3.43 3.58L3.73 3.70L6.62 6.76L15.54 16.34L16.46 17.52L16.74 24.00L17.78 27.77L18.88 30.08L23.24 37.01L23.88 38.54L25.15 37.37L25.66 36.15L29.96 29.32L30.95 26.92L31.93 22.42L32.06 17.68L32.39 16.96L43.96 4.55L44.95 3.70L45.39 3.48L45.69 3.94L45.66 6.01L45.43 8.20L44.62 11.85L43.64 13.67L42.67 15.01L39.68 17.88L37.27 19.50L36.48 20.60L36.35 21.45L36.64 21.78L37.49 21.71L39.05 20.84L41.99 18.90L45.27 16.34L45.63 16.71L45.54 18.04L44.70 21.08L44.15 21.93L43.69 22.84L42.84 23.82L40.65 25.62L38.46 26.64L36.15 27.25L35.45 27.65L35.01 28.25L35.18 28.68L35.55 28.96L37.61 28.77L38.95 28.54L42.48 27.39L42.72 28.38L41.68 30.32L40.67 31.41L39.02 32.51L36.64 33.40L32.63 33.74L31.66 34.04L27.52 38.70L25.60 41.50L25.05 42.72L23.88 43.81L23.26 42.23L21.19 39.07L19.32 36.76L16.54 33.97L16.10 33.74L12.21 33.50L9.39 32.51L7.96 31.52L7.10 30.67L6.15 29.35L5.85 28.25L6.01 27.87L6.38 27.63L9.66 28.59L12.21 28.91L13.18 28.93L13.57 28.25L13.30 27.89L12.21 27.22L9.90 26.63L7.95 25.70L6.38 24.65L5.28 23.59L4.29 22.18L3.34 20.04L2.96 17.56L3.13 16.71L3.58 16.45L6.25 18.81L9.29 20.83L10.39 21.29L11.24 21.89L11.85 21.45L11.82 20.48L11.48 19.89L7.44 16.71L5.28 14.37L4.25 12.82L3.46 10.63ZM23.88 13.55L24.19 13.67L25.15 14.64L25.58 15.86L26.08 16.59L26.58 17.92L28.09 20.72L28.69 22.42L28.13 24.12L26.57 27.04L26.13 28.25L25.58 29.08L25.13 30.32L24.36 31.09L24.00 31.41L23.71 31.17L23.27 29.96L22.71 29.10L22.30 27.96L21.76 27.16L19.64 22.54L19.87 21.75Z"
    />
  ),
  /** Easy heroes: the first of three rising bars filled. */
  easy: (
    <>
      <rect x="7.5" y="28" width="9" height="14" rx="1.5" />
      <rect x="20.7" y="19.2" width="6.6" height="21.6" rx="0.8" fill="none" stroke="currentColor" strokeWidth="2.4" />
      <rect x="32.7" y="9.2" width="6.6" height="31.6" rx="0.8" fill="none" stroke="currentColor" strokeWidth="2.4" />
    </>
  ),
  /** Medium heroes: two of three rising bars filled. */
  medium: (
    <>
      <rect x="7.5" y="28" width="9" height="14" rx="1.5" />
      <rect x="19.5" y="18" width="9" height="24" rx="1.5" />
      <rect x="32.7" y="9.2" width="6.6" height="31.6" rx="0.8" fill="none" stroke="currentColor" strokeWidth="2.4" />
    </>
  ),
  /** Hard heroes: all three rising bars filled. */
  hard: (
    <>
      <rect x="7.5" y="28" width="9" height="14" rx="1.5" />
      <rect x="19.5" y="18" width="9" height="24" rx="1.5" />
      <rect x="31.5" y="8" width="9" height="34" rx="1.5" />
    </>
  ),
  /** Heroes changed by the version: an arrow up beside an arrow down. */
  changed: (
    <path
      d="M15 39V11M6 20l9-9 9 9M33 9v28M24 28l9 9 9-9"
      fill="none"
      stroke="currentColor"
      strokeWidth="4.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ),
} satisfies Record<string, ReactNode>

export type HeroMarkName = keyof typeof MARKS

/** The lanes as the contracts name them; the roaming support lane wears the support mark. */
export type HeroLane = "TOP" | "JUNGLE" | "MID" | "DRAGON" | "SUPPORT"
export const LANE_MARKS = {
  TOP: "top",
  JUNGLE: "jungle",
  MID: "mid",
  DRAGON: "dragon",
  SUPPORT: "roam",
} satisfies Record<HeroLane, HeroMarkName>

export type HeroRole = "TANK" | "WARRIOR" | "ASSASSIN" | "MAGE" | "MARKSMAN" | "SUPPORT"
export const ROLE_MARKS = {
  TANK: "tank",
  WARRIOR: "warrior",
  ASSASSIN: "assassin",
  MAGE: "mage",
  MARKSMAN: "marksman",
  SUPPORT: "support",
} satisfies Record<HeroRole, HeroMarkName>

type MarkProps = { size?: number | string; label?: string; className?: string; style?: CSSProperties }

/** One mark; with a label it is announced as an image, without one it is decoration beside its name. */
export function HeroMark({ name, size = 20, label, className, style }: MarkProps & { name: HeroMarkName }) {
  return (
    <svg
      viewBox="0 0 48 48"
      width={size}
      height={size}
      fill="currentColor"
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
      className={className}
      style={style}
    >
      {label && <title>{label}</title>}
      {MARKS[name]}
    </svg>
  )
}

export function HeroLaneIcon({ lane, className, ...props }: MarkProps & { lane: HeroLane }) {
  return <HeroMark {...props} name={LANE_MARKS[lane]} className={cn("inline-block shrink-0", className)} />
}

export function HeroRoleIcon({ role, className, ...props }: MarkProps & { role: HeroRole }) {
  return <HeroMark {...props} name={ROLE_MARKS[role]} className={cn("inline-block shrink-0", className)} />
}
