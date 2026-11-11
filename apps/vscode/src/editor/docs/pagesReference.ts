import { COLOR_NAMES, ICON_NAMES } from '../../model/types';
import { html } from '../../runtime/dom';
import { HOLD_MS, SPEEDS } from '../../runtime/player';
import { MIN_PACKET_MS } from '../../scene';
import {
  attributeMatrix,
  type DocPage,
  diagnosticsTable,
  h2,
  key,
  note,
  p,
  table,
  timingBar,
} from './elements';
import { GRAMMAR_EBNF } from './snippets';

export const REFERENCE_PAGES: readonly DocPage[] = [
  {
    id: 'playback',
    group: 'reference',
    title: ['再生と操作', 'Playback & controls'],
    lead: [
      'ビュアーの再生の仕組みと操作の一覧です。',
      'How playback is timed, and every viewer control.',
    ],
    render(ctx) {
      const { t } = ctx;
      return [
        h2(t('時間配分（1倍速）', 'Timing at 1x')),
        timingBar(t),
        p(
          t(
            `1フェーズの長さはパケットの移動距離で決まり(最短 ${MIN_PACKET_MS / 1000} 秒)、最後のフェーズの後に ${HOLD_MS / 1000} 秒保持します。速度は ${SPEEDS[0]}x〜${SPEEDS[SPEEDS.length - 1]}x に変更できます。`,
            `A phase lasts at least ${MIN_PACKET_MS / 1000}s, and longer the further its packets travel, followed by a ${HOLD_MS / 1000}s hold after the last one. Speed ranges from ${SPEEDS[0]}x to ${SPEEDS[SPEEDS.length - 1]}x.`,
          ),
        ),
        h2(t('操作', 'Controls')),
        table(
          [t('操作', 'Control'), t('動作', 'Action')],
          [
            [
              t('再生（三角1つ）', 'Play step (one triangle)'),
              t('現在のステップを繰り返し再生します。', 'Repeats the current step.'),
            ],
            [
              t('全再生（三角2つ）', 'Play all (two triangles)'),
              t(
                '全ステップを順に再生し、最後まで行くと先頭へ戻ります。',
                'Plays every step and loops back to the first.',
              ),
            ],
            [
              t('一時停止', 'Pause'),
              t(
                '再生中に同じボタンを押すと、その位置で止まります。もう一度押すと続きから再生します。',
                'Pressing the running button freezes playback in place. Pressing it again continues from there.',
              ),
            ],
            [
              t('アニメーションのオン / オフ', 'Animation on / off'),
              t(
                'オフにすると動きを止め、そのステップの状態と使う線をまとめて表示します。ステップを移動してもオフのままで、再生すると自動でオンに戻ります。オフの間にノードをクリックすると、そのフェーズのパケットと吹き出しを線の途中に止めて表示します。',
                'Off stops all motion and shows the step’s state and every rail it uses. It stays off across steps and turns back on when you play. While off, clicking a node parks that phase’s packet and callout on its rail.',
              ),
            ],
            [
              t('ステップ選択 / 目盛り', 'Step menu / ruler'),
              t('任意のステップへ移動します。', 'Jumps to a step.'),
            ],
            [
              t('ノードをクリック', 'Click a node'),
              t(
                'そのノードが送信元のフェーズ（なければ送信先のフェーズ）を繰り返します。再度クリックで次のフェーズへ。',
                'Repeats a phase the node sends from (or receives in, if it sends none). Click again for the next one.',
              ),
            ],
            [
              t('ノードをダブルクリック', 'Double-click a node'),
              t('ソースの該当箇所へ移動します。', 'Reveals its source.'),
            ],
            [t('ホイール / ドラッグ', 'Wheel / drag'), t('ズーム / 移動', 'Zoom / pan')],
            [t('フィット', 'Fit'), t('図全体を表示します。', 'Shows the whole diagram.')],
            [
              t('追従', 'Follow'),
              t(
                '再生中のパケットへカメラを追従させます。',
                'Keeps the camera on the running packets.',
              ),
            ],
          ],
        ),
        h2(t('キーボード', 'Keyboard')),
        table(
          [t('キー', 'Key'), t('動作', 'Action')],
          [
            [
              key('←'),
              t('前のステップ（先頭では Overview）', 'Previous step (Overview from the first)'),
            ],
            [key('→'), t('次のステップ', 'Next step')],
            [key('Space'), t('現在のステップを再生 / 一時停止', 'Play or pause the current step')],
            [key('Home'), 'Overview'],
          ],
        ),
        note(
          t(
            'OSの「視差効果を減らす」設定が有効な場合、アニメーションは常にオフになります。',
            'When the OS requests reduced motion, animation is always off.',
          ),
        ),
      ];
    },
  },
  {
    id: 'attributes',
    group: 'reference',
    title: ['属性一覧', 'Attribute matrix'],
    lead: [
      '各要素で使える属性と値の型です。',
      'Which attributes each element accepts, and their value types.',
    ],
    render(ctx) {
      const { t } = ctx;
      return [
        attributeMatrix(ctx),
        h2(t('矢印', 'Arrows')),
        table(
          [t('矢印', 'Arrow'), t('線', 'Line'), t('向き', 'Direction'), 'animate'],
          [
            [
              '`-->`',
              t('実線', 'Solid'),
              t('片方向', 'One way'),
              t('使用可（片道）', 'Yes (one way)'),
            ],
            ['`..>`', t('破線', 'Dashed'), t('片方向', 'One way'), t('使用不可', 'No')],
            [
              '`<->`',
              t('実線', 'Solid'),
              t('双方向', 'Both'),
              t('使用可（往復）', 'Yes (round trip)'),
            ],
            ['`<.>`', t('破線', 'Dashed'), t('双方向', 'Both'), t('使用不可', 'No')],
          ],
        ),
        h2(t('使える値', 'Allowed values')),
        p(
          t(
            `色: ${COLOR_NAMES.map((c) => `\`${c}\``).join(' ')}`,
            `Colors: ${COLOR_NAMES.map((c) => `\`${c}\``).join(' ')}`,
          ),
        ),
        p(
          t(
            `アイコン: ${ICON_NAMES.map((c) => `\`${c}\``).join(' ')}`,
            `Icons: ${ICON_NAMES.map((c) => `\`${c}\``).join(' ')}`,
          ),
        ),
      ];
    },
  },
  {
    id: 'grammar',
    group: 'reference',
    title: ['文法 (EBNF)', 'Grammar (EBNF)'],
    lead: [
      '`dav 1` の構文です。バージョン番号と属性の値は、構文解析の後に診断で検証します。',
      'The syntax of `dav 1`. The version number and attribute values are checked after parsing, by diagnostics.',
    ],
    render: () => [html('pre', { class: 'doc-pre' }, GRAMMAR_EBNF)],
  },
  {
    id: 'diagnostics',
    group: 'reference',
    title: ['診断メッセージ', 'Diagnostics'],
    lead: [
      'エディタが報告するすべての診断です。例とメッセージは実際のパーサの出力です。',
      'Every diagnostic the editor reports. Examples and messages come from the real parser.',
    ],
    render: (ctx) => [diagnosticsTable(ctx)],
  },
];
