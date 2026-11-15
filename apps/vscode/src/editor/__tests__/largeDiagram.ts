/**
 * A diagram with so many links between its zones that its search is spread over several
 * workers: ten zones in a chain, five links from each to the next, and eight from the first.
 */
export function largeDiagram(extra = ''): string {
  const lines = ['dav 1'];
  for (let z = 0; z < 10; z++) {
    lines.push(`group z${z} {`);
    for (let n = 0; n < 4; n++) lines.push(`  node z${z}n${n}`);
    lines.push('}');
    for (let n = 1; n < 4; n++) lines.push(`z${z}n${n - 1} --> z${z}n${n}`);
    if (z > 0) {
      for (let n = 0; n < 4; n++) lines.push(`z${z - 1}n${n} --> z${z}n${n}`);
      lines.push(`z${z - 1}n3 --> z${z}n0`);
    }
    if (z > 1) lines.push(`z0n0 --> z${z}n3`);
  }
  return `${lines.join('\n')}\n${extra}\n`;
}
