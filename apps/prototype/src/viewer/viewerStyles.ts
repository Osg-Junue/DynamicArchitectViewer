export const VIEWER_SHARED_CSS = `
@keyframes dav-dash-flow {
  from {
    stroke-dashoffset: 28;
  }
  to {
    stroke-dashoffset: 0;
  }
}

@keyframes dav-pulse-ring {
  0% {
    r: 6px;
    opacity: 0.85;
  }
  100% {
    r: 18px;
    opacity: 0;
  }
}

@keyframes dav-error-pulse {
  0%, 100% {
    filter: drop-shadow(0 0 6px rgba(239, 68, 68, 0.45));
  }
  50% {
    filter: drop-shadow(0 0 14px rgba(239, 68, 68, 0.85));
  }
}

.dav-canvas-svg {
  user-select: none;
  -webkit-user-select: none;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Hiragino Sans", "Noto Sans JP", sans-serif;
}

.dav-group-rect {
  transition: opacity 0.25s ease, stroke 0.25s ease;
}

.dav-node-group {
  transition: opacity 0.25s ease, filter 0.25s ease;
}

.dav-node-group.dav-dimmed {
  opacity: 0.28;
}

.dav-edge-group {
  transition: opacity 0.25s ease;
}

.dav-edge-group.dav-dimmed {
  opacity: 0.22;
}

.dav-edge-flow-active {
  stroke-dasharray: 8 6;
  animation: dav-dash-flow 0.65s linear infinite;
}

.dav-packet-ring {
  animation: dav-pulse-ring 1.1s cubic-bezier(0, 0, 0.2, 1) infinite;
}

.dav-node-error {
  animation: dav-error-pulse 1.4s ease-in-out infinite;
}
`;
