// The stage: everything drawn around the real preview, the real exports and the real recording.
// stage.html?scene=<name>&lang=<ja|en>&profile=<long|short>; capture.mjs calls stage.render(t) per frame.
import { along, clamp, E, h, lerp, mask, railPath, s, seg, Timeline } from './lib.js';
import { CHAPTERS, playCut, recAt, recPlan, recSpeed, speedLabel, starts, T } from './timing.js';

const params = new URLSearchParams(location.search);
const lang = params.get('lang') === 'en' ? 'en' : 'ja';
const profile = params.get('profile') === 'short' ? 'short' : 'long';
const scene = params.get('scene') ?? 'title';
const short = profile === 'short';
const TT = T[profile][scene];
const T0 = starts(profile)[scene];
document.documentElement.lang = lang;
document.body.dataset.scene = scene;
document.body.dataset.profile = profile;

const COPY = {
  ja: {
    tagline: '設計図を、再生しよう。',
    sub: 'VS Code 拡張機能',
    hook: ['図は、止まっている。', 'システムは、動いている。'],
    previewTab: (name) => `プレビュー: ${name}`,
    cursorPos: (line, col) => `行 ${line}、列 ${col}`,
    flow: {
      head: ['データフローが、', '動いて見える。'],
      sub: 'テキストで書いた図を、ステップごとに再生。',
      tags: ['インフラ構成図', 'シーケンス図', 'アーキテクチャ図', 'コード解説'],
      caps: [
        'テキストが、そのまま<em>動く図</em>になる。',
        'リクエストの<em>順番</em>も<em>中身</em>も、ひと目で。',
        '大きな構成も、<em>カメラ</em>が流れを追う。',
        '<em>コード</em>を添えて、処理の中身まで解説。',
      ],
    },
    skills: {
      head: ['学習ゼロ。', 'AIに頼むだけ。'],
      sub: 'Agent Skills が、独自言語の書き方をエージェントに教える。',
      installTag: 'Agent Skills',
      install: 'スキルは、<em>コマンド1つ</em>で導入。',
      recTag: 'Claude Code',
      rec: '独自言語は、<em>AI</em>が書く。',
      resTag: '生成された図',
      res: '書いたのは、<em>依頼文</em>だけ。',
      kick: 'PROMPT',
      prompt: [
        'このリポジトリの構成を ',
        ['architecture.dav'],
        ' に図にして。注文から決済までの正常な流れと、決済プロバイダーが落ちてリトライした末に注文が失敗する流れをステップで見せて。',
      ],
      checks: [
        '<code>dav-diagrams</code> スキルを読み込む',
        'リポジトリのコードを読む',
        '<code>architecture.dav</code> を書く',
        '<code>dav-check</code> で検証',
      ],
      note: 'VS Code の実際の録画',
    },
    svg: {
      head: ['SVGで、', 'GitHubにそのまま。'],
      sub: '高画質のまま動く図を、README に貼れる。',
      expTag: '書き出す',
      exp: 'プレビューから、<em>アニメーション SVG</em>。',
      hubTag: 'README.md',
      hub: '<em>GitHub</em> の上で、そのまま再生。',
      calls: [
        ['IMAGE', '画像として貼るだけ。<br>スクリプトは不要。'],
        ['VECTOR', 'ベクターだから、<br>拡大しても鮮明。'],
        ['THEME', 'ライト／ダークに<br>自動で追従。'],
      ],
      readme: [
        'nginx・Node.js API・worker・PostgreSQL・Redis・RabbitMQ で動く、小さな注文サービス。',
        'アーキテクチャ',
      ],
    },
    html: {
      head: ['HTML 1ファイルで、', '同じ体験を共有。'],
      sub: '受け取った人は、ブラウザで開くだけ。',
      tag: '単一 HTML',
      cap: '<em>1ファイル</em>を送るだけで、同じ図が動く。',
      facts: [
        '操作できる 1 ファイル',
        'オフラインで動く',
        '外部リクエストなし',
        '元の .dav を取り出せる',
      ],
      one: '1 ファイル',
    },
    end: {
      pills: ['動くデータフロー', 'Skills で学習ゼロ', 'SVG を GitHub へ', 'HTML 1ファイルで共有'],
      search: 'VS Code Marketplace で <b>DynamicArchitectViewer</b> を検索',
      meta: 'MIT · VS Code 1.96+ · 日本語 / English',
    },
  },
  en: {
    tagline: 'Play your architecture.',
    sub: 'A VS Code extension',
    hook: ['Diagrams stand still.', 'Systems don’t.'],
    previewTab: (name) => `Preview: ${name}`,
    cursorPos: (line, col) => `Ln ${line}, Col ${col}`,
    flow: {
      head: ['Data flow,', 'in motion.'],
      sub: 'Diagrams written as text, played step by step.',
      tags: ['Infrastructure', 'Sequence', 'Architecture', 'Code'],
      caps: [
        'Text becomes a diagram <em>that plays</em>.',
        'The <em>order</em> of every request, and what it <em>carries</em>.',
        'Large systems: the <em>camera</em> follows the flow.',
        'Packets carry <em>code</em>: explain what really runs.',
      ],
    },
    skills: {
      head: ['Nothing to learn.', 'Just ask your agent.'],
      sub: 'Agent Skills teach your coding agent the language.',
      installTag: 'Agent Skills',
      install: 'Install the skills with <em>one command</em>.',
      recTag: 'Claude Code',
      rec: 'Your <em>agent</em> writes it.',
      resTag: 'The result',
      res: 'All you wrote was <em>the request</em>.',
      kick: 'PROMPT',
      prompt: [
        'Diagram this repository’s architecture in ',
        ['architecture.dav'],
        '. Show the normal flow from order to payment, and the flow where the payment provider is down, retries fail and the order fails, as steps.',
      ],
      checks: [
        'Loads the <code>dav-diagrams</code> skill',
        'Reads the repository',
        'Writes <code>architecture.dav</code>',
        'Validates with <code>dav-check</code>',
      ],
      note: 'A real recording of VS Code',
    },
    svg: {
      head: ['Export SVG.', 'It plays on GitHub.'],
      sub: 'A sharp, moving diagram, right in your README.',
      expTag: 'Export',
      exp: 'From the preview: an <em>animated SVG</em>.',
      hubTag: 'README.md',
      hub: 'It plays right on <em>GitHub</em>.',
      calls: [
        ['IMAGE', 'Just an image.<br>No script.'],
        ['VECTOR', 'Vector: sharp<br>at any zoom.'],
        ['THEME', 'Follows light<br>and dark themes.'],
      ],
      readme: [
        'A small order service: nginx, a Node.js API, a worker, PostgreSQL, Redis and RabbitMQ.',
        'Architecture',
      ],
    },
    html: {
      head: ['One HTML file.', 'The same experience.'],
      sub: 'Whoever gets it just opens it in a browser.',
      tag: 'Standalone HTML',
      cap: 'Send <em>one file</em>. The same diagram plays.',
      facts: [
        'One interactive file',
        'Works offline',
        'No external requests',
        'The .dav source comes back out',
      ],
      one: '1 file',
    },
    end: {
      pills: [
        'Data flow that moves',
        'Skills: nothing to learn',
        'SVG for GitHub',
        'One HTML file to share',
      ],
      search: 'Search <b>DynamicArchitectViewer</b> in the VS Code Marketplace',
      meta: 'MIT · VS Code 1.96+ · English / 日本語',
    },
  },
};
const C = COPY[lang];
const CHAPTER_NAMES = { flow: 'FLOW', skills: 'SKILLS', svg: 'SVG', html: 'HTML' };

const root = document.getElementById('root');
const caps = document.getElementById('caps');
const scrim = document.getElementById('scrim');
const veil = document.getElementById('veil');
const tl = new Timeline();
/** Work that has to finish before a frame is complete (decoding an image). */
const frameHooks = [];
const devices = {};
const offsets = {};
const pointerTracks = {};
const json = (url) => fetch(url).then((r) => r.json());
const loaded = (frame) =>
  new Promise((done) => {
    frame.addEventListener('load', () => done(), { once: true });
  });

/** The root of an exported SVG and the <svg> elements in it: in Chromium each keeps its own clock. */
const clocks = (svg) => [svg, ...svg.querySelectorAll('svg')];

/**
 * Takes over the clocks of an exported SVG. A timeline starts a moment after the file has loaded,
 * and a pause before that is lost, so this waits until it runs.
 */
async function hold(svg) {
  for (let i = 0; i < 300 && !(svg.getCurrentTime() > 0); i++)
    await new Promise((r) => setTimeout(r, 10));
  for (const el of clocks(svg)) el.pauseAnimations();
}
/** Shows an exported SVG as it is `time` seconds into its loop. */
function seek(svg, time) {
  for (const el of clocks(svg)) {
    if (!el.animationsPaused()) el.pauseAnimations();
    el.setCurrentTime(time);
    if (Math.abs(el.getCurrentTime() - time) > 0.002)
      console.error(`SVG clock is at ${el.getCurrentTime()}, not ${time}`);
  }
}

// ---------- shared pieces ----------

function hud() {
  const index = CHAPTERS.indexOf(scene);
  if (index < 0) return;
  document.body.dataset.hud = '1';
  const el = document.getElementById('hud');
  const fills = CHAPTERS.map((name, i) => {
    const fill = h('i');
    const tick = h(
      'div',
      { class: `tick${i === index ? ' on' : i < index ? ' done' : ''}` },
      h('b', {}, String(i + 1).padStart(2, '0')),
      CHAPTER_NAMES[name],
      fill,
    );
    document.getElementById('ticks').append(tick);
    return fill;
  });
  fills.forEach((fill, i) => {
    if (i < index) fill.style.transform = 'scaleX(1)';
  });
  tl.each((t) => {
    fills[index].style.transform = `scaleX(${clamp(t / TT.dur).toFixed(4)})`;
  });
  // The timeline arrives with the first chapter and leaves with the last.
  if (index === 0) tl.set(el, { opacity: 0 }).to(el, 0.1, 0.6, { opacity: 1 });
  if (index === CHAPTERS.length - 1) tl.to(el, TT.out, TT.dur - TT.out, { opacity: 0 }, E.in2);
}

/** A caption on the bottom left: a tag and one line. */
function cap(tag, text, at, until) {
  const el = h(
    'div',
    { class: 'cap' },
    h('span', { class: 'cap-tag' }, tag),
    h('span', { class: 'cap-text', html: text }),
  );
  caps.append(el);
  tl.show(el, at, until, { dy: 26, inDur: 0.55 });
  return el;
}

/** The opening card of a chapter: its number, name and message. */
function card(n, name, head, sub) {
  if (!(TT.card >= 0)) return;
  const num = h('div', { class: 'card-n' }, String(n).padStart(2, '0'));
  const kick = h('div', { class: 'card-k' }, name);
  const lines = head.map((text) => h('span', { class: 'ln' }, h('span', { html: text })));
  const subEl = h('p', { class: 'card-s' }, sub);
  const el = h('div', { class: 'card' }, num, kick, h('h1', { class: 'card-h' }, lines), subEl);
  root.append(el);
  const at = TT.card;
  tl.set(num, { opacity: 0, x: -50 }).to(num, at, 0.8, { opacity: 1, x: 0 }, E.out5);
  tl.set(kick, { opacity: 0, x: -24 }).to(kick, at + 0.12, 0.6, { opacity: 1, x: 0 }, E.out4);
  lines.forEach((line, i) => {
    const inner = mask(line.firstChild);
    tl.set(inner, { y: 150 }).to(inner, at + 0.16 + i * 0.1, 0.85, { y: 0 }, E.out5);
  });
  tl.set(subEl, { opacity: 0, y: 18 }).to(subEl, at + 0.55, 0.6, { opacity: 1, y: 0 }, E.out4);
  tl.to(el, TT.cardOut, 0.32, { opacity: 0, y: -46 }, E.in2);
}

/** The pointer of a device: keyframes [t, x, y, click?] in the device's own pixels, set by the capture. */
function pointer(name, dev) {
  const ptr = s(
    'svg',
    { class: 'ptr', viewBox: '0 0 28 28' },
    s('path', {
      d: 'M3 2 L3 22 L8.5 17 L12.5 26 L16 24.5 L12 15.8 L19.5 15.8 Z',
      fill: '#fff',
      stroke: '#111',
      'stroke-width': 1.5,
      'stroke-linejoin': 'round',
    }),
  );
  const ring = h('div', { class: 'ring' });
  dev.append(ring, ptr);
  tl.each((t) => {
    const keys = pointerTracks[name];
    if (!keys || t < keys[0][0] - 1e-6 || t > keys.at(-1)[0] + 1e-6) {
      ptr.style.display = 'none';
      ring.style.opacity = 0;
      return;
    }
    let [, x, y] = keys[0];
    for (let i = 0; i < keys.length - 1; i++) {
      const [t0, x0, y0] = keys[i];
      const [t1, x1, y1] = keys[i + 1];
      if (t >= t0 && t <= t1) {
        const k = E.inOut3((t - t0) / (t1 - t0 || 1));
        x = lerp(x0, x1, k);
        y = lerp(y0, y1, k);
      } else if (t > t1) {
        x = x1;
        y = y1;
      }
    }
    ptr.style.display = 'block';
    ptr.style.transform = `translate(${(x - 3).toFixed(2)}px, ${(y - 2).toFixed(2)}px)`;
    const last = keys.filter(([tk, , , click]) => click && tk <= t).at(-1);
    const press = last ? Math.min(1, (t - last[0]) / 0.4) : 1;
    ring.style.left = `${x}px`;
    ring.style.top = `${y}px`;
    ring.style.opacity = press < 1 ? (1 - press).toFixed(3) : 0;
    ring.style.transform = `scale(${(0.45 + press * 0.9).toFixed(3)})`;
  });
}

const FILE_ICON = '../../apps/vscode/media/file-icon-dark.svg';

/**
 * VS Code around the real preview. `files` are shown one at a time: each has its highlighted lines,
 * the line the cursor is on and a pane for the preview's picture.
 */
function vscode(name, workspace, files) {
  const title = h('span');
  const tabName = h('span');
  const tabPreview = h('span');
  const pos = h('span', { class: 'sp' });
  const edBody = h('div', { class: 'body' });
  const pvBody = h('div', { class: 'body preview' });
  const layers = files.map((file, i) => {
    const editor = h('div', { class: 'editor' });
    const first = Math.max(0, file.top ?? file.line - 7);
    for (let n = first; n < Math.min(file.lines.length, first + 35); n++) {
      const current = n === file.line - 1;
      const code = h('span', { class: 'code', html: file.lines[n] });
      if (current) code.prepend(h('span', { class: 'caret' }));
      editor.append(
        h(
          'div',
          { class: current ? 'line current' : 'line' },
          h('span', { class: 'ln' }, String(n + 1)),
          code,
        ),
      );
    }
    const live = h('img', { class: 'live', id: `live-${name}-${i}`, alt: '' });
    offsets[live.id] = [609, 69];
    edBody.append(editor);
    pvBody.append(live);
    return { editor, live };
  });
  const dev = h(
    'div',
    { class: 'dev vsc' },
    h('div', { class: 'tb' }, h('div', { class: 'dots' }, h('i'), h('i'), h('i')), title),
    h('div', { class: 'ab' }, h('i'), h('i'), h('i'), h('i')),
    h(
      'div',
      { class: 'pane ed' },
      h(
        'div',
        { class: 'tabs' },
        h('div', { class: 'tab' }, h('img', { src: FILE_ICON, alt: '' }), tabName),
      ),
      edBody,
    ),
    h(
      'div',
      { class: 'pane pv' },
      h('div', { class: 'tabs' }, h('div', { class: 'tab' }, tabPreview)),
      pvBody,
    ),
    h(
      'div',
      { class: 'sb' },
      h('span', {}, 'main'),
      pos,
      h('span', {}, 'UTF-8'),
      h('span', {}, 'DynamicArchitectViewer DSL'),
    ),
  );
  root.append(dev);
  pointer(name, dev);
  devices[name] = dev;
  let shown = -1;
  const show = (i) => {
    if (i === shown) return;
    shown = i;
    const file = files[i];
    title.textContent = `${file.name} - ${workspace} - Visual Studio Code`;
    tabName.textContent = file.name;
    tabPreview.textContent = C.previewTab(file.name);
    pos.textContent = C.cursorPos(file.line, 1);
  };
  show(0);
  return { dev, layers, show };
}

/** Where a device sits when the camera has moved in on the preview. */
const PUSHED = { scale: 1.28, x: 972 - 1.28 * 1124, y: 470 - 1.28 * 422 };
const HOME = { scale: 1, x: 140, y: 56 };
/** Closer still, on the middle of the preview, where a packet's code is shown. */
const CODE_POSE = { scale: 1.62, x: 1360 - 1.62 * 1124, y: 332 - 1.62 * 470 };

function enter(dev, at, pose = HOME) {
  tl.set(dev, { opacity: 0, x: pose.x, y: pose.y + 80, scale: pose.scale * 0.965, rx: 7 });
  tl.to(dev, at, 0.95, { opacity: 1, y: pose.y, scale: pose.scale, rx: 0 }, E.out5);
}
function leave(dev, at, dur = 0.38) {
  tl.to(dev, at, dur, { opacity: 0 }, E.in2);
}

/** Rails with right-angled turns, drawn on from the left, with packets running along them. */
function rails(specs, fadeAt) {
  const svg = s('svg', { class: 'rails', viewBox: '0 0 1920 1080', width: 1920, height: 1080 });
  root.append(svg);
  const items = specs.map((spec) => {
    const d = railPath(spec.pts, 44);
    const base = s('path', { d, stroke: '#20252d', 'stroke-width': 5 });
    const lit = s('path', { d, stroke: spec.color, 'stroke-width': 5, opacity: spec.opacity ?? 1 });
    svg.append(base, lit);
    const stops = (spec.stops ?? []).map((f) => {
      const c = s('circle', { r: 17, fill: '#0c0e12', stroke: '#59616d', 'stroke-width': 5 });
      svg.append(c);
      return [f, c];
    });
    const glow = s('circle', { r: 46, fill: spec.color, opacity: 0.16 });
    const dot = s('circle', { r: 12, fill: '#fff', stroke: spec.color, 'stroke-width': 5 });
    svg.append(glow, dot);
    return { spec, base, lit, stops, glow, dot, length: lit.getTotalLength() };
  });
  tl.each((t) => {
    for (const { spec, base, lit, stops, glow, dot, length } of items) {
      const f =
        spec.to * seg(t, spec.at, spec.dur, E.inOut3) +
        (spec.drift ?? 0.012) * Math.max(0, t - spec.at - spec.dur);
      base.style.opacity = seg(t, 0, 0.5);
      lit.setAttribute('stroke-dasharray', `${(f * length).toFixed(1)} ${length.toFixed(1)}`);
      const [x, y] = along(lit, f);
      const on = seg(t, spec.at, 0.25);
      for (const el of [glow, dot]) {
        el.setAttribute('cx', x);
        el.setAttribute('cy', y);
      }
      dot.style.opacity = on;
      glow.style.opacity = on * 0.18;
      for (const [sf, c] of stops) {
        const [sx, sy] = along(lit, sf);
        const k = clamp((f - sf + 0.02) / 0.02);
        c.setAttribute('cx', sx);
        c.setAttribute('cy', sy);
        c.setAttribute('r', 13 + 5 * E.outBack(k));
        c.setAttribute('stroke', k >= 1 ? spec.color : '#59616d');
        c.style.opacity = seg(t, 0, 0.5) * (0.5 + 0.5 * k);
      }
    }
  });
  if (fadeAt >= 0) tl.to(svg, fadeAt, TT.dur - fadeAt, { opacity: 0 }, E.in2);
  return svg;
}

const RAIL_A = {
  pts: [
    [-60, 968],
    [380, 968],
    [380, 902],
    [1100, 902],
    [1100, 996],
    [1560, 996],
    [1560, 924],
    [1990, 924],
  ],
  color: '#eb6101',
};
const RAIL_B = {
  pts: [
    [-60, 178],
    [300, 178],
    [300, 96],
    [1180, 96],
    [1180, 196],
    [1640, 196],
    [1640, 116],
    [1990, 116],
  ],
  color: '#5d6878',
  opacity: 0.9,
};

// ---------- hook: a diagram that stands still, then plays ----------

async function hook() {
  const frame = h('iframe', { src: 'out/hook.svg' });
  const zoom = h('div', { style: 'position:absolute;inset:0;transform-origin:50% 50%' }, frame);
  const wrap = h('div', { id: 'hookWrap' }, zoom);
  const shade = h('div', { id: 'hookShade' });
  const lines = C.hook.map((text, i) =>
    h('span', { class: `hook-line${i ? ' b' : ''}` }, h('span', {}, text)),
  );
  const play = h(
    'div',
    { class: 'playbtn' },
    s(
      'svg',
      { viewBox: '0 0 24 24' },
      s('path', {
        d: 'M5 2.5 L21 12 L5 21.5 Z',
        fill: '#eb6101',
        stroke: '#eb6101',
        'stroke-width': 2.4,
        'stroke-linejoin': 'round',
      }),
    ),
  );
  const burst = h('div', { class: 'burst' });
  root.append(wrap, shade, h('div', { class: 'hook-lines' }, lines), burst, play);
  await loaded(frame);
  const svg = frame.contentDocument.documentElement;
  await hold(svg);
  // The canvas of the exported SVG (below its header) covers the screen.
  const canvas = svg.querySelector(':scope > svg');
  const width = Number(svg.getAttribute('width'));
  const height = Number(svg.getAttribute('height'));
  const top = Number(canvas.getAttribute('y'));
  const canvasHeight = Number(canvas.getAttribute('height'));
  const k = Math.max(1920 / width, 1080 / canvasHeight);
  svg.setAttribute('width', '100%');
  svg.setAttribute('height', '100%');
  frame.style.width = `${width * k}px`;
  frame.style.height = `${height * k}px`;
  frame.style.left = `${(1920 - width * k) / 2}px`;
  frame.style.top = `${(1080 - canvasHeight * k) / 2 - top * k}px`;

  const { line1, line2, linesOut, playIn, click, out, dur } = TT;
  tl.set(wrap, { sat: 0, bright: 0.92 }).to(wrap, click, 0.9, { sat: 1, bright: 1 }, E.out3);
  tl.set(shade, { opacity: 1 }).to(shade, click, 0.9, { opacity: 0.22 });
  tl.set(zoom, { scale: 1.0 }).to(zoom, click, dur - click, { scale: 1.07 }, E.out2);
  [line1, line2].forEach((at, i) => {
    const inner = mask(lines[i].firstChild);
    tl.set(inner, { y: 170 }).to(inner, at, 0.8, { y: 0 }, E.out5);
    tl.to(lines[i], linesOut + i * 0.06, 0.4, { opacity: 0, y: -30 }, E.in2);
  });
  tl.set(play, { opacity: 0, scale: 0.5 })
    .to(play, playIn, 0.55, { opacity: 1, scale: 1 }, E.outBack)
    .to(play, click - 0.14, 0.14, { scale: 0.88 }, E.out2)
    .to(play, click, 0.4, { scale: 1.35, opacity: 0 }, E.out3);
  tl.set(burst, { opacity: 0, scale: 1 })
    .to(burst, click, 0.02, { opacity: 0.9 })
    .to(burst, click + 0.02, 0.9, { scale: 7, opacity: 0 }, E.out3);
  tl.set(veil, { opacity: 0 }).to(veil, out, dur - out, { opacity: 1 }, E.inOut2);
  tl.each((t) => {
    seek(svg, Math.max(0, t - click));
  });
}

// ---------- title ----------

function lockup(withTail) {
  const icon = h('img', { class: 'icon', src: '../../apps/vscode/media/icon.png', alt: '' });
  const name = h('span', {}, 'DynamicArchitectViewer');
  const ver = h('span', { class: 'v' }, '1.0');
  const word = h('div', { class: 'word' }, h('span', {}, name), ver);
  const tag = h('div', { class: 'tag' }, h('span', {}, C.tagline));
  const lock = h('div', { class: 'lock' }, icon, word, tag);
  root.append(lock);
  const { icon: iconAt, word: wordAt, tag: tagAt } = TT;
  tl.set(icon, { opacity: 0, scale: 0.6, rz: -8 }).to(
    icon,
    iconAt,
    0.8,
    { opacity: 1, scale: 1, rz: 0 },
    E.outBack,
  );
  const nameIn = mask(name.parentNode);
  tl.set(nameIn, { y: 140 }).to(nameIn, wordAt, 0.85, { y: 0 }, E.out5);
  tl.set(ver, { opacity: 0, x: -18 }).to(ver, wordAt + 0.4, 0.6, { opacity: 1, x: 0 }, E.out4);
  const tagIn = mask(tag);
  tl.set(tagIn, { y: 90 }).to(tagIn, tagAt, 0.8, { y: 0 }, E.out5);
  withTail(lock);
  return lock;
}

function title() {
  rails(
    [
      { ...RAIL_A, at: 0.05, dur: 2.0, to: 0.66, stops: [0.2, 0.47] },
      { ...RAIL_B, at: 0.25, dur: 2.2, to: 0.58, stops: [0.3] },
    ],
    TT.out,
  );
  const lock = lockup((el) => {
    const sub = h('div', { class: 'sub' }, C.sub);
    el.append(sub);
    tl.set(sub, { opacity: 0 }).to(sub, TT.ver, 0.6, { opacity: 1 });
  });
  tl.to(lock, TT.out, TT.dur - TT.out, { opacity: 0, y: -30 }, E.in2);
}

// ---------- chapter 1: the data flow, playing ----------

async function flow() {
  // Three bundled samples, then a step of the first one whose packet carries code.
  const KEYS = ['infra', 'seq', 'ent', 'code'];
  const NAMES = [
    '01-infra-ha-failover.dav',
    '05-sequence-payment-retry.dav',
    '04-enterprise-zero-trust-payment.dav',
    '01-infra-ha-failover.dav',
  ];
  const meta = await json('out/meta.json');
  const lines = await Promise.all(
    KEYS.map((key) => json(`out/hl-${key === 'code' ? 'infra' : key}.json`)),
  );
  card(1, 'FLOW', C.flow.head, C.flow.sub);
  const win = vscode(
    'flow',
    'examples',
    KEYS.map((key, i) => ({
      name: NAMES[i],
      lines: lines[i],
      line: meta.flow[key].line,
      // The editor shows the step from its first line, so the code block under it is in view.
      top: key === 'code' ? meta.flow[key].line - 4 : undefined,
    })),
  );
  const { d, push, out, winIn } = TT;
  if (short) {
    tl.set(win.dev, { ...PUSHED, opacity: 0 }).to(win.dev, 0, 0.3, { opacity: 1 });
    tl.set(scrim, { opacity: 1 });
  } else {
    enter(win.dev, winIn);
    tl.to(win.dev, push, 1.5, PUSHED, E.inOut3);
    tl.set(scrim, { opacity: 0 }).to(scrim, push, 1.2, { opacity: 1 });
  }
  win.layers.forEach(({ editor, live }, i) => {
    if (i === 0) return;
    tl.set(editor, { opacity: 0 }).to(editor, d[i].at, 0.01, { opacity: 1 });
    tl.set(live, { opacity: 0, x: 26 }).to(live, d[i].at, 0.45, { opacity: 1, x: 0 }, E.out4);
  });
  tl.each((t) => {
    win.show(d.findLastIndex((item, i) => i === 0 || t >= item.at));
  });
  d.forEach((item, i) => {
    cap(C.flow.tags[i], C.flow.caps[i], item.cap, d[i + 1] ? d[i + 1].at - 0.12 : out - 0.1);
    // The camera moves in on the packet with code.
    if (item.zoom >= 0) tl.to(win.dev, item.zoom, 1.3, CODE_POSE, E.inOut3);
  });
  leave(win.dev, out);
  tl.to(scrim, out, 0.4, { opacity: 0 });
}

// ---------- chapter 2: skills ----------

async function architecture(name) {
  const meta = await json('out/meta.json');
  const lines = await json(`out/hl-arch-${lang}.json`);
  // The cursor is on the first line, outside every step: the preview opens on the overview.
  return {
    meta,
    win: vscode(name, 'tiny-orders', [{ name: 'architecture.dav', lines, line: 1, top: 0 }]),
  };
}

/**
 * A recording shown through a frame: `pose` gives the frame on screen (fx, fy, fw, fh) and the part
 * of the recording in it (from sx, sy, sw wide; as high as the frame's shape makes it). The recording
 * is `width` pixels wide in the coordinates of the boxes take.mjs measured.
 */
function footage(dir, count, startAt, width, pose) {
  const img = h('img', { alt: '' });
  const frame = h('div', { class: 'foot' }, img);
  root.append(frame);
  img.style.width = `${width}px`;
  const cam = {};
  tl.set(cam, pose);
  const at = (t) => {
    const v = {};
    for (const key of Object.keys(pose)) v[key] = tl.value(cam, key, t);
    return v;
  };
  tl.each((t) => {
    const v = at(t);
    const k = v.fw / v.sw;
    frame.style.left = `${v.fx.toFixed(2)}px`;
    frame.style.top = `${v.fy.toFixed(2)}px`;
    frame.style.width = `${v.fw.toFixed(2)}px`;
    frame.style.height = `${v.fh.toFixed(2)}px`;
    img.style.transform = `translate(${(-v.sx * k).toFixed(2)}px, ${(-v.sy * k).toFixed(2)}px) scale(${k.toFixed(5)})`;
  });
  let shown = 0;
  frameHooks.push(async (t) => {
    const n = clamp(Math.floor((t - startAt) * 60) + 1, 1, count);
    if (n === shown) return;
    shown = n;
    img.src = `${dir}/f${String(n).padStart(4, '0')}.jpg`;
    await img.decode();
  });
  return {
    frame,
    cam,
    at,
    move: (when, dur, to, ease = E.inOut3) => tl.to(cam, when, dur, to, ease),
  };
}

async function skills() {
  const S = C.skills;
  card(2, 'SKILLS', S.head, S.sub);
  const meta = await json('out/meta.json');
  const take = meta.take[lang];
  const m = take.marks;
  const plan = recPlan(m, profile);
  const R = TT.rec;
  const recEnd = R + plan.length;
  /** When the cut shows the take's own second `src`, in seconds of this scene. */
  const when = (src) => R + recAt(plan.segments, src);
  const [, , W, H] = take.boxes.window;

  // ----- the take: VS Code, the Command Palette, Claude Code -----
  const FULL = { fx: 224, fy: 56, fw: 1472, fh: 800, sx: 0, sy: 0, sw: W };
  // The right of the window: the end of the editor, Claude Code and the preview, at full height.
  const sideFrom = take.boxes.claude[0] - 86;
  const SIDE = { fx: 940, fy: 36, fw: 920, fh: 900, sx: sideFrom, sy: 0, sw: W - sideFrom };
  const rec = footage(
    `out/rec/${lang}-${profile}`,
    meta.rec[`${lang}-${profile}`],
    R,
    W,
    short ? SIDE : { ...FULL, fy: FULL.fy + 70 },
  );
  tl.set(rec.frame, { opacity: 0 })
    .to(rec.frame, R, 0.5, { opacity: 1 })
    .to(rec.frame, recEnd - 0.05, 0.35, { opacity: 0 }, E.in2);
  const keys = h('div', { class: 'keys' });
  root.append(keys);
  tl.set(keys, { opacity: 0, x: 0, y: 742 });
  if (!short) {
    rec.move(R, 0.9, { fy: FULL.fy }, E.out5);
    // In on the Command Palette, at the top of the window; then on the notification, at its bottom.
    rec.move(when(m.paletteOpen) + 0.1, 0.9, { sx: 480, sy: 0, sw: 1600 });
    rec.move(when(m.skillInstalled) + 0.15, 0.9, { sx: W - 1280, sy: H - 696, sw: 1280 });
    rec.move(R + plan.at.open, 1.0, SIDE);
    // The keys that were pressed.
    const presses = [
      [when(m.paletteOpen), 'F1'],
      [when(m.palettePicks), 'Enter'],
      [when(m.palettePick), 'Enter'],
    ];
    for (const [at] of presses) {
      tl.to(keys, at - 0.12, 0.12, { opacity: 1 }).to(keys, at + 0.45, 0.25, { opacity: 0 });
    }
    tl.each((t) => {
      const key = presses.findLast(([at]) => t >= at - 0.2)?.[1] ?? presses[0][1];
      if (keys.dataset.k === key) return;
      keys.dataset.k = key;
      keys.innerHTML = `<kbd>${key}</kbd>`;
      keys.style.left = `${960 - keys.offsetWidth / 2}px`;
    });
    cap(S.installTag, S.install, R + 0.4, R + plan.at.open);
  }

  // ----- beside it: the request in large type, and what the recording shows, ticked off -----
  const bubble = h('div', { class: 'bubble' });
  const chars = [];
  for (const part of S.prompt) {
    const target = Array.isArray(part) ? bubble.appendChild(h('code')) : bubble;
    for (const ch of Array.isArray(part) ? part[0] : part) {
      const span = h('span', { class: 'ch' }, ch);
      target.append(span);
      chars.push(span);
    }
  }
  const caret = h('span', { class: 'tcar' });
  const prompt = h('div', { class: 'prompt' }, h('div', { class: 'kick' }, S.kick), bubble);
  const tick = () =>
    s(
      'svg',
      { viewBox: '0 0 20 20' },
      s('path', {
        d: 'M4 10.5 L8.3 14.6 L16 5.8',
        fill: 'none',
        stroke: '#3ddc97',
        'stroke-width': 2.6,
        'stroke-linecap': 'round',
        'stroke-linejoin': 'round',
      }),
    );
  const marks = [m.skill, m.read, m.write, m.check];
  const checks = S.checks.map((text, i) => {
    const el = h(
      'div',
      { class: 'check' },
      h('span', { class: 'box' }, tick()),
      h('span', { html: text }),
    );
    if (i === 3) el.append(h('span', { class: 'out' }, `ok (${meta.arch[lang].counts})`));
    return el;
  });
  const list = h('div', { class: 'checks' }, checks);
  const note = h('div', { class: 'rec-note' }, S.note);
  const speed = h('div', { class: 'speed' });
  root.append(prompt, list, note, speed);

  const side = short ? R : R + plan.at.open + 0.35;
  tl.set(prompt, { opacity: 0, y: 30 })
    .to(prompt, side, 0.6, { opacity: 1, y: 0 }, E.out4)
    .to(prompt, recEnd - 0.05, 0.35, { opacity: 0, x: -60 }, E.in2);
  tl.set(list, { opacity: 0 })
    .to(list, side + 0.2, 0.5, { opacity: 1 })
    .to(list, recEnd - 0.05, 0.35, { opacity: 0, x: -60 }, E.in2);
  checks.forEach((el, i) => {
    tl.set(el, { opacity: 0, x: -16 }).to(
      el,
      side + 0.25 + i * 0.07,
      0.5,
      { opacity: 1, x: 0 },
      E.out4,
    );
  });
  tl.set(note, { opacity: 0 })
    .to(note, R + 0.4, 0.5, { opacity: 1 })
    .to(note, recEnd - 0.05, 0.3, { opacity: 0 });
  cap(S.recTag, S.rec, side + 0.3, recEnd - 0.05);

  const typeFrom = when(m.promptType);
  const typeFor = Math.max(0.3, when(m.promptTyped) - typeFrom);
  tl.each((t) => {
    // The large type follows the typing in the recording.
    const typed = Math.floor(clamp((t - typeFrom) / typeFor) * chars.length);
    chars.forEach((ch, i) => {
      ch.classList.toggle('on', i < typed);
    });
    if (typed < chars.length && typed > 0) chars[typed - 1].after(caret);
    else caret.remove();
    checks.forEach((el, i) => {
      el.classList.toggle('on', t >= when(marks[i]));
    });
    const v = rec.at(t);
    note.style.left = `${(v.fx + 4).toFixed(1)}px`;
    note.style.top = `${(v.fy - 27).toFixed(1)}px`;
    const rt = t - R;
    const sp = rt >= 0 && rt < plan.length ? recSpeed(plan.segments, rt) : 1;
    speed.textContent = speedLabel(sp);
    speed.style.opacity = sp > 1.05 && t < recEnd ? 1 : 0;
    speed.style.left = `${(v.fx + v.fw - 14 - speed.offsetWidth).toFixed(1)}px`;
    speed.style.top = `${(v.fy + 14).toFixed(1)}px`;
  });

  // ----- the file it wrote, played in VS Code -----
  const P = meta.play[lang];
  const res = TT.res;
  const [, , PW, PH] = P.boxes.window;
  const [, py, pw] = P.boxes.preview;
  // The preview and the end of the editor beside it, without the bars above and below.
  const wide = Math.min(PW, pw + 760);
  const CLOSE = { fx: 140, fy: 40, fw: 1640, fh: 830, sx: PW - wide, sw: wide };
  // From under the preview's toolbar: the step's text stays in view, the bars at the bottom do not.
  CLOSE.sy = clamp(py + 84, 0, PH - (wide * 830) / 1640);
  const WHOLE = { fx: 224, fy: 56, fw: 1472, fh: 800, sx: 0, sy: 0, sw: PW };
  const play = footage(
    `out/play/${lang}-${profile}`,
    meta.playFrames[`${lang}-${profile}`],
    res.at,
    PW,
    short ? CLOSE : { ...WHOLE, fy: WHOLE.fy + 70 },
  );
  tl.set(play.frame, { opacity: 0 })
    .to(play.frame, res.at, 0.5, { opacity: 1 })
    .to(play.frame, TT.out, 0.38, { opacity: 0 }, E.in2);
  if (!short) {
    play.move(res.at, 0.9, { fy: WHOLE.fy }, E.out5);
    play.move(res.push, 1.4, CLOSE);
    // The pointer on "play all": the click is the one in the recording.
    pointer('play', play.frame);
    const k = WHOLE.fw / PW;
    const [bx, by] = [P.button[0] * k, P.button[1] * k];
    const click = playCut(P.play, profile);
    const at = res.at + (P.play - click[0]);
    pointerTracks.play = [
      [at - 0.9, bx + 260, by + 240],
      [at, bx, by, true],
      [at + 0.45, bx, by],
    ];
  }
  cap(S.resTag, S.res, res.at + 0.5, TT.out - 0.1);
  const A = meta.arch[lang];
  const chips = h(
    'div',
    { class: 'cap-side' },
    h('span', { class: 'stat', html: `<b>${A.nodes}</b> nodes` }),
    h('span', { class: 'stat', html: `<b>${A.steps}</b> steps` }),
    h('span', { class: 'stat', html: `<b>${A.code}</b> code` }),
    h('span', { class: 'stat ok' }, 'dav-check ✓'),
  );
  caps.append(chips);
  [...chips.children].forEach((el, i) => {
    tl.set(el, { opacity: 0, y: 18 })
      .to(el, res.stats + i * 0.12, 0.5, { opacity: 1, y: 0 }, E.out4)
      .to(el, TT.out - 0.1, 0.3, { opacity: 0 });
  });
}

// ---------- chapter 3: SVG ----------

const FILE_SVG = () =>
  s(
    'svg',
    { viewBox: '0 0 40 40' },
    s('path', {
      d: 'M9 3 H24 L32 11 V35 A2 2 0 0 1 30 37 H9 A2 2 0 0 1 7 35 V5 A2 2 0 0 1 9 3 Z',
      fill: '#1d222b',
      stroke: '#eb6101',
      'stroke-width': 2,
    }),
    s('path', {
      d: 'M24 3 V11 H32',
      fill: 'none',
      stroke: '#eb6101',
      'stroke-width': 2,
      'stroke-linejoin': 'round',
    }),
    s('circle', { cx: 14, cy: 26, r: 3, fill: 'none', stroke: '#fff', 'stroke-width': 2 }),
    s('path', {
      d: 'M17 26 H22 L26 20',
      fill: 'none',
      stroke: '#ff8a4c',
      'stroke-width': 2,
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
    }),
    s('circle', { cx: 26, cy: 20, r: 2.4, fill: '#ff8a4c' }),
  );

// At 1.5 the preview's picture is shown pixel for pixel; the half pixels put it on whole ones.
const EXPORT_POSE = { scale: 1.5, x: 1780 - 1.5 * 1640 + 0.5, y: 40.5 };

async function svgScene() {
  card(3, 'SVG', C.svg.head, C.svg.sub);
  const meta = await json('out/meta.json');
  const A = meta.arch[lang];
  const X = TT.exp;
  const H = TT.hub;

  // The repository page with the exported file.
  const frame = h('iframe', { src: `out/architecture-${lang}.svg` });
  const [intro, heading] = C.svg.readme;
  const md = h(
    'div',
    { class: 'md' },
    h('h1', {}, 'tiny-orders'),
    h('p', {}, intro),
    h('h2', {}, heading),
    frame,
  );
  const book = s(
    'svg',
    { viewBox: '0 0 16 16' },
    s('path', {
      d: 'M2 2.5A2.5 2.5 0 0 1 4.5 0h8.75a.75.75 0 0 1 .75.75v12.5a.75.75 0 0 1-.75.75h-2.5a.75.75 0 0 1 0-1.5h1.75v-2h-8a1 1 0 0 0-.714 1.7.75.75 0 1 1-1.072 1.05A2.495 2.495 0 0 1 2 11.5Zm10.5-1h-8a1 1 0 0 0-1 1v6.708A2.486 2.486 0 0 1 4.5 9h8Z',
    }),
  );
  const listIcon = s(
    'svg',
    { viewBox: '0 0 16 16' },
    s('path', {
      d: 'M2 4a1 1 0 1 0 0-2 1 1 0 0 0 0 2Zm3.75-1.5a.75.75 0 0 0 0 1.5h8.5a.75.75 0 0 0 0-1.5h-8.5Zm0 5a.75.75 0 0 0 0 1.5h8.5a.75.75 0 0 0 0-1.5h-8.5Zm0 5a.75.75 0 0 0 0 1.5h8.5a.75.75 0 0 0 0-1.5h-8.5ZM3 8a1 1 0 1 1-2 0 1 1 0 0 1 2 0Zm-1 6a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z',
    }),
  );
  const page = h(
    'div',
    { class: 'page' },
    h(
      'div',
      { class: 'top' },
      h(
        'div',
        { class: 'repo' },
        book,
        h('span', {}, 'you'),
        h('span', { class: 'sl' }, '/'),
        h('b', {}, 'tiny-orders'),
        h('span', { class: 'pub' }, 'Public'),
      ),
      h(
        'div',
        { class: 'nav' },
        h('span', { class: 'on' }, 'Code'),
        h('span', {}, 'Issues'),
        h('span', {}, 'Pull requests'),
        h('span', {}, 'Actions'),
      ),
    ),
    h('div', { class: 'box' }, h('div', { class: 'bh' }, listIcon, 'README.md'), md),
  );
  const lock = s(
    'svg',
    { viewBox: '0 0 16 16' },
    s('path', { d: 'M4 7V5a4 4 0 0 1 8 0v2h1v8H3V7Zm2 0h4V5a2 2 0 0 0-4 0Z', fill: '#c8c8c8' }),
  );
  const hub = h(
    'div',
    { class: 'dev hub' },
    h(
      'div',
      { class: 'chrome' },
      h('div', { class: 'dots' }, h('i'), h('i'), h('i')),
      h('div', { class: 'url' }, lock, 'github.com/you/tiny-orders'),
    ),
    h('div', { class: 'view' }, page),
  );
  const zoomTag = h('div', { class: 'zoomtag' });
  const calls = C.svg.calls.map(([n, text], i) =>
    h(
      'div',
      { class: 'callout' },
      h('div', { class: 'n' }, `0${i + 1} · ${n}`),
      h('div', { class: 't', html: text }),
      i === 0 ? h('div', { class: 'x', html: '![architecture](<b>architecture.svg</b>)' }) : null,
      i === 1 ? h('div', { class: 'x', html: `<b>${A.svgKB} KB</b> · SVG + SMIL` }) : null,
      i === 2 ? h('div', { class: 'x', html: 'prefers-color-scheme' }) : null,
    ),
  );
  root.append(hub, h('div', { class: 'callouts' }, calls), zoomTag);
  await loaded(frame);
  const svg = frame.contentDocument.documentElement;
  await hold(svg);
  const ratio = Number(svg.getAttribute('height')) / Number(svg.getAttribute('width'));
  frame.style.height = `${Math.round(960 * ratio)}px`;

  // The preview's Export menu, in the real preview.
  if (X) {
    const { win } = await architecture('arch');
    tl.set(win.dev, { ...EXPORT_POSE, opacity: 0, scale: 1.42, x: EXPORT_POSE.x + 66, y: 70 })
      .to(win.dev, X.at, 0.9, { opacity: 1, ...EXPORT_POSE }, E.out5)
      .to(win.dev, X.out, 0.4, { opacity: 0 }, E.in2);
    tl.set(scrim, { opacity: 0 })
      .to(scrim, X.at, 0.5, { opacity: 1 })
      .to(scrim, X.out, 0.4, { opacity: 0 });
    cap(C.svg.expTag, C.svg.exp, X.at + 0.4, X.out);
    const chip = h(
      'div',
      { class: 'chipfile' },
      FILE_SVG(),
      h('span', {}, 'architecture.svg'),
      h('small', {}, `${A.svgKB} KB`),
    );
    root.append(chip);
    tl.set(chip, { opacity: 0, x: 1290, y: 300, scale: 0.7 })
      .to(chip, X.pick + 0.08, 0.5, { opacity: 1, scale: 1, x: 1180, y: 380 }, E.outBack)
      .to(chip, X.out, 0.55, { x: 700, y: 430, scale: 1.25 }, E.inOut3)
      .to(chip, H.at + 0.15, 0.4, { opacity: 0, scale: 1.1, y: 400 }, E.in2);
  }

  // The page scrolls to the picture, zooms into it and changes theme.
  const scrollTo = frame.offsetTop - 26;
  const Z = 2.4;
  // The zoom goes to where the first packets run, right of the middle and low in the picture.
  const focus = [frame.offsetLeft + 620, frame.offsetTop + Math.round(960 * ratio) * 0.8];
  enter(hub, H.at);
  tl.each((t) => {
    const sc = seg(t, H.at + 0.5, 1.1, E.inOut3);
    const u = seg(t, H.zoomIn, 1.1, E.inOut3) - seg(t, H.zoomOut, 0.9, E.inOut3);
    const k = lerp(1, Z, u);
    const x = lerp(0, 590 - Z * focus[0], u);
    const y = lerp(-scrollTo * sc, 378 - Z * focus[1], u);
    page.style.transform = `translate(${x.toFixed(2)}px, ${y.toFixed(2)}px) scale(${k.toFixed(4)})`;
    zoomTag.textContent = `${Math.round(k * 100)}%`;
    zoomTag.style.opacity = clamp(u * 3).toFixed(3);
    hub.classList.toggle('light', t >= H.light && t < H.dark);
    seek(svg, Math.max(0, t - H.at));
  });
  tl.set(zoomTag, { x: 164, y: 124 });
  [H.a, H.b, H.c].forEach((at, i) => {
    tl.set(calls[i], { opacity: 0, x: 40 }).to(calls[i], at, 0.6, { opacity: 1, x: 0 }, E.out5);
    const next = [H.b, H.c][i];
    if (next !== undefined) tl.to(calls[i], next, 0.4, { opacity: 0.42 });
    tl.to(calls[i], TT.out, 0.35, { opacity: 0 }, E.in2);
  });
  cap(C.svg.hubTag, C.svg.hub, H.at + 0.5, TT.out - 0.1);
  leave(hub, TT.out);
}

// ---------- chapter 4: HTML ----------

const ICONS = {
  hand: 'M9 11V5a2 2 0 0 1 4 0v6m0-2a2 2 0 0 1 4 0v3m0-1a2 2 0 0 1 4 0v5a8 8 0 0 1-8 8h-1a8 8 0 0 1-6.4-3.2L3 18a2 2 0 0 1 3-2.6L9 18',
  wifi: 'M3 3l18 18M8.5 16.5a5 5 0 0 1 7 0M5 13a10 10 0 0 1 4-2.6m5.6-.3A10 10 0 0 1 19 13M2 9.5a15 15 0 0 1 4.5-3M10 5.1A15 15 0 0 1 22 9.5M12 20h.01',
  shield: 'M12 3l8 3v6c0 4.5-3.2 8-8 9-4.800-1-8-4.500-8-9V6zM9 12l2 2 4-4',
  code: 'M8 7l-5 5 5 5M16 7l5 5-5 5M14 4l-4 16',
};

async function htmlScene() {
  card(4, 'HTML', C.html.head, C.html.sub);
  const meta = await json('out/meta.json');
  const A = meta.arch[lang];
  const live = h('img', { class: 'live', id: 'live-web-0', alt: '' });
  offsets[live.id] = [0, 44];
  const web = h(
    'div',
    { class: 'dev web' },
    h(
      'div',
      { class: 'chrome' },
      h('div', { class: 'dots' }, h('i'), h('i'), h('i')),
      h('div', { class: 'url' }, 'file:///C:/Users/you/Desktop/architecture.html'),
    ),
    h('div', { class: 'page' }, live),
  );
  root.append(web);
  pointer('web', web);
  devices.web = web;
  const file = h(
    'div',
    { class: 'file' },
    FILE_SVG(),
    h('div', {}, h('b', {}, 'architecture.html'), h('small', {}, `${C.html.one} · ${A.htmlKB} KB`)),
  );
  const facts = C.html.facts.map((text, i) =>
    h(
      'div',
      { class: 'fact' },
      s('svg', { viewBox: '0 0 24 24' }, s('path', { d: Object.values(ICONS)[i] })),
      h('span', {}, text),
    ),
  );
  root.append(h('div', { class: 'facts' }, file, facts));
  const pose = { scale: 1, x: 540, y: 56 };
  if (short) tl.set(web, { ...pose, opacity: 0 }).to(web, 0, 0.3, { opacity: 1 });
  else enter(web, TT.win, pose);
  tl.set(file, { opacity: 0, x: -30 })
    .to(file, TT.win + 0.25, 0.6, { opacity: 1, x: 0 }, E.out5)
    .to(file, TT.out, 0.35, { opacity: 0 }, E.in2);
  facts.forEach((el, i) => {
    tl.set(el, { opacity: 0, x: -30 })
      .to(el, TT.chips[i], 0.6, { opacity: 1, x: 0 }, E.out5)
      .to(el, TT.out, 0.35, { opacity: 0 }, E.in2);
  });
  cap(C.html.tag, C.html.cap, TT.win + 0.5, TT.out - 0.1);
  leave(web, TT.out);
}

// ---------- end ----------

function end() {
  rails(
    [
      { ...RAIL_A, at: 0.0, dur: 2.4, to: 0.9, stops: [0.2, 0.47, 0.74], drift: 0.006 },
      { ...RAIL_B, at: 0.2, dur: 2.6, to: 0.86, stops: [0.3, 0.62], drift: 0.006 },
    ],
    -1,
  );
  lockup((lock) => {
    const pills = C.end.pills.map((text, i) =>
      h('div', { class: 'pill' }, h('b', {}, `0${i + 1}`), text),
    );
    const search = h(
      'div',
      { class: 'search' },
      s(
        'svg',
        { viewBox: '0 0 24 24' },
        s('circle', { cx: 10.5, cy: 10.5, r: 6.5 }),
        s('path', { d: 'M15.5 15.5 L21 21' }),
      ),
      h('span', { html: C.end.search }),
    );
    const metaEl = h('div', { class: 'meta' }, C.end.meta);
    lock.append(h('div', { class: 'pills' }, pills), search, metaEl);
    pills.forEach((el, i) => {
      tl.set(el, { opacity: 0, y: 22 }).to(
        el,
        TT.pills + i * 0.09,
        0.6,
        { opacity: 1, y: 0 },
        E.out5,
      );
    });
    tl.set(search, { opacity: 0, y: 22 }).to(search, TT.search, 0.6, { opacity: 1, y: 0 }, E.out5);
    tl.set(metaEl, { opacity: 0 }).to(metaEl, TT.meta, 0.6, { opacity: 1 });
  });
  tl.set(veil, { opacity: 0 }).to(veil, TT.out, TT.dur - TT.out, { opacity: 1 }, E.inOut2);
}

// ---------- run ----------

// A Map, so that a name from the URL finds a scene and nothing an object inherits.
const SCENES = new Map(
  Object.entries({ hook, title, flow, skills, svg: svgScene, html: htmlScene, end }),
);
const build = SCENES.get(scene);
if (typeof build !== 'function')
  throw new Error(`No scene "${scene}"; one of ${[...SCENES.keys()].join(', ')}`);
const grid = document.getElementById('grid');
hud();
await build();
await document.fonts.ready;

async function render(t) {
  const g = T0 + t;
  grid.style.backgroundPosition = `${(-g * 5).toFixed(2)}px ${(-g * 3).toFixed(2)}px`;
  tl.render(t);
  for (const hook of frameHooks) await hook(t);
}

/** Shows a PNG (base64) of a live page in its pane. */
async function showLive(id, base64) {
  const img = document.getElementById(id);
  img.src = `data:image/png;base64,${base64}`;
  await img.decode();
}

window.stage = {
  lang,
  profile,
  duration: TT.dur,
  offsets,
  render,
  showLive,
  setPointer: (name, keys) => {
    pointerTracks[name] = keys;
  },
  ready: false,
};
await render(Number(params.get('t') ?? 0));
// Only now: a frame asked for while the first one loads its pictures would cut that loading short.
window.stage.ready = true;
