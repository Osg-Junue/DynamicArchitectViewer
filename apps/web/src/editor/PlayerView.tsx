import { useEffect, useRef } from 'react';
import { Player, type PlayerData } from '../runtime/player';
import '../runtime/styles.css';

/** React host for the shared runtime player (same code as the exported HTML). */
export function PlayerView({ data, locale }: { data: PlayerData; locale: 'ja' | 'en' }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<Player | null>(null);
  const dataRef = useRef(data);
  dataRef.current = data;

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const player = new Player(host, dataRef.current, { locale, autoplay: true });
    playerRef.current = player;
    return () => {
      player.destroy();
      playerRef.current = null;
    };
  }, [locale]);

  useEffect(() => {
    playerRef.current?.update(data);
  }, [data]);

  return <div ref={hostRef} className="player-host" />;
}
