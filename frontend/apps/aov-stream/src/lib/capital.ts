/** Words that stand on their own, with a capital at their start. */
export const capital = (words: string) => words.charAt(0).toLocaleUpperCase("vi-VN") + words.slice(1)
