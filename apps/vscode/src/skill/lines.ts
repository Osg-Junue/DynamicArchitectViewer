/**
 * A text from a diagram, as part of one printed line. A label can hold a line break (`\n`), and
 * printed as it is, what follows the break would start a line of its own: one that reads as if
 * the script had said it. An agent takes the lines of a script for facts about the diagram, so
 * a diagram must not be able to write them. Other control characters go the same way, since a
 * terminal acts on some of them. A tab stays: code is printed with the tabs it has.
 */
export const oneLine = (text: string): string =>
  text.replace(/\p{Cc}+/gu, (run) => (/^\t+$/.test(run) ? run : ' '));
