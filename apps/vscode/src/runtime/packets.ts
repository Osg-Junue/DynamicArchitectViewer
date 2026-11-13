import { buildPacket, type IconShapes, type Packet, packetPosition } from '../scene';
import { clear, renderSvg, svg } from './dom';

interface PacketEntry {
  packet: Packet;
  dotEl: SVGGElement | null;
}

/** Moves the marker along its rail. The callout stays where it is. */
function placePacket(entry: PacketEntry, t: number): void {
  const p = packetPosition(entry.packet, t);
  entry.dotEl?.setAttribute('transform', `translate(${p.x.toFixed(1)} ${p.y.toFixed(1)})`);
}

/** Manages the active animation phase's SVG packet elements and `t`-interpolated placement. */
export class PacketLayer {
  readonly layer = svg('g', { class: 'dav-layer-packets' });
  #entries: PacketEntry[] = [];

  clear(): void {
    clear(this.layer);
    this.#entries = [];
  }

  /** Rebuilds packet SVG elements for `packets` and places each at `progressOf(packet)`. */
  render(
    packets: readonly Packet[],
    icons: IconShapes,
    progressOf: (packet: Packet) => number,
  ): void {
    this.clear();
    for (const packet of packets) {
      const t = progressOf(packet);
      const el = renderSvg(buildPacket(packet, icons, t));
      this.layer.append(el);
      const dotEl = el.querySelector<SVGGElement>('.dav-packet-dot');
      const entry: PacketEntry = { packet, dotEl };
      this.#entries.push(entry);
      placePacket(entry, t);
    }
  }

  /** Updates each active packet's position for `elapsed` ms into the phase. */
  place(elapsed: number): void {
    for (const entry of this.#entries) {
      placePacket(entry, Math.min(1, elapsed / entry.packet.durationMs));
    }
  }

  /** Resets all active packets to the start of their paths (`t = 0`). */
  reset(): void {
    for (const entry of this.#entries) placePacket(entry, 0);
  }
}
