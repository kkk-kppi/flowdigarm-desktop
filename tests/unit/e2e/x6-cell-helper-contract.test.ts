import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const fixtures = readFileSync('e2e/fixtures.ts', 'utf8')

function helperSource(name: string, nextDeclaration: string): string {
  return fixtures.slice(fixtures.indexOf(`export async function ${name}`), fixtures.indexOf(nextDeclaration))
}

describe('X6 cell E2E helper contract', () => {
  it('requires strict domain, uniqueness, attachment, geometry, and revision proof for created cells', () => {
    const source = helperSource('waitForCreatedX6Cell', 'export function createCanvasFixture')

    expect(source).toContain('node.id === id')
    expect(source).toContain('edge.id === id')
    expect(source).toContain('documentHasCell: true')
    expect(source).toContain('cellCount: 1')
    expect(source).toContain('attached: cell?.isConnected === true')
    expect(source).toContain('box.width > 0 && box.height > 0')
    expect(source).toContain('revisionAdvanced: true')
    expect(source).toContain('hasCompleteBox: true')
  })

  it('retains old/new identity while requiring strict rebuilt-cell integrity', () => {
    const source = helperSource('waitForRebuiltX6Cell', 'export async function waitForCreatedX6Cell')

    expect(source).toContain('node.id === id')
    expect(source).toContain('edge.id === id')
    expect(source).toContain('documentHasCell: true')
    expect(source).toContain('cellCount: 1')
    expect(source).toContain('newAttached: cell?.isConnected === true')
    expect(source).toContain('box.width > 0 && box.height > 0')
    expect(source).toContain('revisionAdvanced: true')
    expect(source).toContain('hasCompleteBox: true')
    expect(source).toContain('oldDetached: oldCell.isConnected === false')
    expect(source).toContain('identityChanged: cell !== null && cell !== oldCell')
    expect(source).toContain('oldDetached: true')
    expect(source).toContain('identityChanged: true')
  })
})
