import {
  buildPacket,
  computePacketCalloutBox,
  type IconShapes,
  type Packet,
  type PacketCalloutBox,
  packetBubblePath,
  packetPosition,
} from '../scene';
import { clear, renderSvg, svg } from './dom';

interface PacketEntry {
  packet: Packet;
  box: PacketCalloutBox | null;
  dotEl: SVGGElement | null;
  bubbleEl: SVGPathElement | null;
}

function placePacket(entry: PacketEntry, t: number): void {
  const p = packetPosition(entry.packet, t);
  entry.dotEl?.setAttribute('transform', `translate(${p.x.toFixed(1)} ${p.y.toFixed(1)})`);
  if (entry.bubbleEl && entry.box) {
    entry.bubbleEl.setAttribute('d', packetBubblePath(entry.box, p));
  }
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
      const bubbleEl = el.querySelector<SVGPathElement>('.dav-packet-bubble');
      const entry: PacketEntry = { packet, box: computePacketCalloutBox(packet), dotEl, bubbleEl };
      this.#entries.push(entry);
      placePacket(entry, t);
    }
  }

  /** Updates each active packet's position and callout tail for `elapsed` ms into the phase. */
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
