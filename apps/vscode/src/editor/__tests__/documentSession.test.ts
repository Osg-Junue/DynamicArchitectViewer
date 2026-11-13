import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { hasFatalError, parse } from '../../dsl';
import { adoptZonePlan } from '../../layout';
import { DocumentSession, type SessionView } from '../documentSession';
import { ZonePlanner } from '../zonePlanner';
import { FakeWorker } from './fakeWorker';

const REPO = resolve(__dirname, '../../../../..');
/** A diagram with links long enough that its zones are searched for a better place. */
const SEARCHED = readFileSync(resolve(REPO, 'promo/pv/architecture-en.dav'), 'utf8');
const SMALL = `dav 1
node a "A"
node b "B"
a --> b : "x"
step "One" {
  animate a --> b : "first"
}
step "Two" {
  animate a --> b : "second"
}
`;
/** A text with an error and nothing to draw. */
const BROKEN = 'dav 1\nnode\n';

/** Everything the session told the page, in order. */
function setup() {
  const worker = new FakeWorker();
  const told: string[] = [];
  const view: SessionView = {
    switched: (uri) => told.push(`switched ${uri}`),
    textChanged: (_dsl, fatal) => told.push(`text ${fatal ? 'fatal' : 'ok'}`),
    show: (valid) => told.push(`show ${valid.document.nodes.length} nodes`),
    cursorAt: (elementId, stepIndex) => told.push(`cursor ${elementId} step ${stepIndex}`),
  };
  const session = new DocumentSession(new ZonePlanner(() => worker), view);
  return { session, worker, told };
}

describe('DocumentSession', () => {
  // The layout remembers its last plan; each test starts without one.
  beforeEach(() => adoptZonePlan('', undefined));

  it('uses a text that cannot be drawn, or the tests below prove nothing', () => {
    expect(hasFatalError(parse(BROKEN))).toBe(true);
    expect(hasFatalError(parse(SMALL))).toBe(false);
  });

  it('shows an empty diagram before any text has arrived', () => {
    const { session } = setup();
    expect(session.valid.document.nodes).toEqual([]);
    expect(session.dsl).toBe('');
    expect(session.uri).toBeUndefined();
  });

  it('shows a text that needs no search at once', () => {
    const { session, told } = setup();
    session.docChanged({ dsl: SMALL, uri: 'file:///a.dav', version: 1 });
    expect(told).toEqual(['switched file:///a.dav', 'text ok', 'show 2 nodes']);
    expect(session.valid.dsl).toBe(SMALL);
    expect([session.uri, session.version]).toEqual(['file:///a.dav', 1]);
  });

  it('ignores the version it has already drawn, and draws the next', () => {
    const { session, told } = setup();
    session.docChanged({ dsl: SMALL, uri: 'file:///a.dav', version: 1 });
    told.length = 0;
    session.docChanged({ dsl: `${SMALL}node c "C"\n`, uri: 'file:///a.dav', version: 1 });
    expect(told).toEqual([]);
    session.docChanged({ dsl: `${SMALL}node c "C"\n`, uri: 'file:///a.dav', version: 2 });
    expect(told).toEqual(['text ok', 'show 3 nodes']);
  });

  it('keeps the last diagram while the text cannot be drawn', () => {
    const { session, told } = setup();
    session.docChanged({ dsl: SMALL, uri: 'file:///a.dav', version: 1 });
    told.length = 0;
    session.docChanged({ dsl: BROKEN, uri: 'file:///a.dav', version: 2 });
    expect(told).toEqual(['text fatal', 'show 2 nodes']);
    // What is exported is the text that is drawn; what the documentation edits is the editor's.
    expect(session.valid.dsl).toBe(SMALL);
    expect(session.dsl).toBe(BROKEN);
  });

  it('lets nothing of one document into another', () => {
    const { session, told } = setup();
    session.docChanged({ dsl: SMALL, uri: 'file:///a.dav', version: 1 });
    told.length = 0;
    session.docChanged({ dsl: BROKEN, uri: 'file:///b.dav', version: 1 });
    expect(told).toEqual(['switched file:///b.dav', 'text fatal', 'show 0 nodes']);
    expect(session.valid.dsl).toBe('');
  });

  it('tells where the cursor is: on which element, in which step', () => {
    const { session, told } = setup();
    session.docChanged({ dsl: SMALL });
    told.length = 0;
    session.cursorMoved(SMALL.indexOf('node b') + 5);
    session.cursorMoved(SMALL.indexOf('"second"'));
    expect(told).toEqual(['cursor b step null', 'cursor null step 1']);
  });

  it('keeps the last diagram until the search for the next is done', () => {
    const { session, worker, told } = setup();
    session.docChanged({ dsl: SMALL, uri: 'file:///a.dav', version: 1 });
    told.length = 0;
    session.docChanged({ dsl: SEARCHED, uri: 'file:///a.dav', version: 2 });
    expect(told).toEqual(['text ok']);
    expect(session.valid.dsl).toBe(SMALL);
    expect(session.dsl).toBe(SEARCHED);

    worker.answer();
    expect(told).toEqual(['text ok', 'show 9 nodes']);
    expect(session.valid.dsl).toBe(SEARCHED);
  });

  it('holds a cursor that arrives during the search, and places it in the new text', () => {
    const { session, worker, told } = setup();
    // The same offset means the first step in the short text, and the second in the long one.
    const longer = SEARCHED.replace('dav 1', 'dav 1\nnode audit "Audit log"');
    const offset = SEARCHED.indexOf('step "Reserve stock"') + 8;
    session.docChanged({ dsl: longer });
    worker.answer();
    told.length = 0;

    session.docChanged({ dsl: SEARCHED });
    session.cursorMoved(offset);
    expect(told).toEqual(['text ok']);
    worker.answer();
    expect(told).toEqual(['text ok', 'show 9 nodes', 'cursor null step 1']);

    // Only the last position counts, and it is told once.
    told.length = 0;
    session.cursorMoved(offset);
    expect(told).toEqual(['cursor null step 1']);
  });

  it('shows the last diagram again when a broken text arrives during the search', () => {
    const { session, worker, told } = setup();
    session.docChanged({ dsl: SMALL });
    told.length = 0;
    session.docChanged({ dsl: SEARCHED });
    session.docChanged({ dsl: BROKEN });
    expect(told).toEqual(['text ok', 'text fatal', 'show 2 nodes']);
    // The search goes on: its text is the last that can be drawn.
    worker.answer();
    expect(told.at(-1)).toBe('show 9 nodes');
    expect(session.valid.dsl).toBe(SEARCHED);
  });

  it('drops a search when a document that cannot be drawn takes over', () => {
    const { session, worker, told } = setup();
    session.docChanged({ dsl: SEARCHED, uri: 'file:///a.dav', version: 1 });
    session.docChanged({ dsl: BROKEN, uri: 'file:///b.dav', version: 1 });
    told.length = 0;

    // Without the drop, the first document's diagram would appear under the second's name.
    worker.answer();
    expect(told).toEqual([]);
    expect(session.valid.dsl).toBe('');
  });

  it('drops a search when another document takes over', () => {
    const { session, worker, told } = setup();
    session.docChanged({ dsl: SEARCHED, uri: 'file:///a.dav', version: 1 });
    session.cursorMoved(10);
    session.docChanged({ dsl: SMALL, uri: 'file:///b.dav', version: 1 });
    told.length = 0;

    worker.answer();
    expect(told).toEqual([]);
    expect(session.valid.dsl).toBe(SMALL);
    // The cursor held for the first document is gone with it.
    session.cursorMoved(SMALL.indexOf('node a') + 5);
    expect(told).toEqual(['cursor a step null']);
  });
});
