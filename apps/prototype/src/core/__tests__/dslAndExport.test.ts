import { describe, expect, it } from 'vitest';
import { generateStandaloneHtml } from '../../exporter/htmlExporter';
import { extractDslFromImportedContent } from '../../exporter/htmlImporter';
import { resolveDiagramStep } from '../../viewer/stepResolver';
import { parseDsl } from '../parser';
import { SAMPLE_TEMPLATES } from '../samples';
import { patchPositionsInDsl, serializeModelToDsl } from '../serializer';

describe('DynamicArchitectViewer DSL Parser, Two-Way Sync & HTML Exporter', () => {
  it('parses all sample templates without syntax errors', () => {
    for (const sample of SAMPLE_TEMPLATES) {
      const model = parseDsl(sample.dsl);
      expect(model.diagnostics).toEqual([]);
      expect(model.nodes.length).toBeGreaterThan(0);
      expect(model.edges.length).toBeGreaterThan(0);
      expect(model.steps.length).toBeGreaterThan(0);
    }
  });

  it('auto-layouts AI-generated DSL without @pos coordinates and supports Mermaid pipe labels', () => {
    const aiDsl = `
      diagram "AI Generated Flow"
      group backend "Backend VPC" {
        node api "API Server" [icon: server]
        node db "Database" [icon: database]
      }
      node client "Browser" [icon: browser]

      client -->|HTTPS GET| api
      api --> db : "SQL Query"

      step 1 "Fetch Data" {
        desc "Client requests data from API"
        focus client, api, db
        animate client --> api : "GET /items" [color: #3b82f6]
        animate api --> db : "SELECT *" [color: #10b981]
      }
    `;

    const model = parseDsl(aiDsl);
    expect(model.diagnostics).toEqual([]);
    expect(model.title).toBe('AI Generated Flow');
    expect(model.nodes).toHaveLength(3);
    expect(model.edges[0].label).toBe('HTTPS GET');

    const client = model.nodes.find((n) => n.id === 'client')!;
    const api = model.nodes.find((n) => n.id === 'api')!;
    const db = model.nodes.find((n) => n.id === 'db')!;

    // Topological auto-layout places client -> api -> db from left to right
    expect(client.x).toBeLessThan(api.x);
    expect(api.x).toBeLessThan(db.x);
  });

  it('patches @pos and @size in-place while preserving comments', () => {
    const original = `diagram "Test"
// Important comment
group g1 "Group 1" {
  node n1 "Node 1" [icon: server] // inline comment
}
`;
    const patched = patchPositionsInDsl(
      original,
      [{ id: 'n1', x: 320, y: 180 }],
      [{ id: 'g1', x: 280, y: 120, width: 400, height: 250 }]
    );

    expect(patched).toContain('// Important comment');
    expect(patched).toContain('// inline comment');
    expect(patched).toContain('@pos(320, 180)');
    expect(patched).toContain('@pos(280, 120)');
    expect(patched).toContain('@size(400, 250)');

    const reparsed = parseDsl(patched);
    expect(reparsed.nodes[0].x).toBe(320);
    expect(reparsed.nodes[0].y).toBe(180);
    expect(reparsed.groups[0].x).toBe(280);
    expect(reparsed.groups[0].width).toBe(400);
  });

  it('round-trips model serialization and step resolution accurately', () => {
    const model = parseDsl(SAMPLE_TEMPLATES[0].dsl);
    const serialized = serializeModelToDsl(model);
    const reparsed = parseDsl(serialized);

    expect(reparsed.diagnostics).toEqual([]);
    expect(reparsed.nodes.length).toBe(model.nodes.length);
    expect(reparsed.edges.length).toBe(model.edges.length);
    expect(reparsed.steps.length).toBe(model.steps.length);

    // Verify step 4 failover state override resolution
    const step4View = resolveDiagramStep(reparsed, 3);
    const priDb = step4View.nodes.find((n) => n.id === 'db_pri')!;
    const sbyDb = step4View.nodes.find((n) => n.id === 'db_sby')!;
    const failoverEdge = step4View.edges.find((e) => e.id === 'e_failover')!;

    expect(priDb.status).toBe('error');
    expect(priDb.badge).toBe('DOWN');
    expect(sbyDb.status).toBe('active');
    expect(failoverEdge.visible).toBe(true);
    expect(step4View.phases.length).toBe(1);
  });

  it('exports a self-contained single-file HTML and re-imports the exact DSL', () => {
    const originalDsl = SAMPLE_TEMPLATES[1].dsl;
    const model = parseDsl(originalDsl);
    const html = generateStandaloneHtml(model, originalDsl);

    expect(html).toContain('<!DOCTYPE html>');
    expect(html).not.toMatch(/https?:\/\/cdn\./i);
    expect(html).toContain('id="dav-dsl-source"');
    expect(html).toContain('id="dav-model-json"');

    const extractedDsl = extractDslFromImportedContent(html);
    expect(extractedDsl).toBe(originalDsl);
  });
});
