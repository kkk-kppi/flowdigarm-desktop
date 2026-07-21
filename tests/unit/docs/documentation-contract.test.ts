import { readFileSync } from 'node:fs'

it('ties final acceptance claims to the concrete blocker regressions', () => {
  const acceptance = readFileSync('docs/acceptance.md', 'utf8')
  for (const evidence of [
    'tests/unit/domain/document-schema.test.ts',
    'tests/unit/editor/persistence/document-persistence-controller.test.ts',
    'tests/unit/editor/graph-adapter-transform.test.ts',
    'tests/unit/editor/commands/edit-text.test.ts',
    'tests/component/CanvasArea.test.ts',
    'tests/unit/editor/export/svg-export.test.ts',
    'src-tauri/tests/export_commands.rs',
    'tests/unit/architecture/vue-layering.test.ts',
  ]) expect(acceptance).toContain(evidence)
})
