import { globSync, readFileSync } from 'node:fs'

const iconRegistry = 'src/ui/icons/icon-registry.ts'

function cssUrlReferences(source: string): string[] {
  return [...source.matchAll(/url\(\s*(?:(['"])(.*?)\1|([^)]*?))\s*\)/gi)]
    .map((match) => (match[2] ?? match[3] ?? '').trim())
}

function hasDirectSvgReference(source: string): boolean {
  const directSvg = /^(?:@\/|\.{1,2}\/)[^?#]*\.svg(?:[?#].*)?$/i
  return /['"`](?:@\/|\.{1,2}\/)[^'"`]*\.svg(?:[?#][^'"`]*)?['"`]/i.test(source)
    || cssUrlReferences(source).some((reference) => directSvg.test(reference))
}

function hasRemoteIconReference(source: string): boolean {
  return /https?:\/\/[^'"\s)]*(?:\.svg(?:[?#][^'"\s)]*)?|\/icons?(?:[/?#][^'"\s)]*)?)/i.test(source)
}

function hasIconBoundaryViolation(source: string): boolean {
  return /<iconify-icon/i.test(source)
    || hasDirectSvgReference(source)
    || hasRemoteIconReference(source)
}

function fileHasIconBoundaryViolation(file: string): boolean {
  const normalizedFile = file.replaceAll('\\', '/')
  const source = readFileSync(file, 'utf8')
  return /<iconify-icon/i.test(source)
    || hasRemoteIconReference(source)
    || normalizedFile !== iconRegistry && hasDirectSvgReference(source)
}

it('loads local UI icons only through the shared registry boundary', () => {
  expect(hasIconBoundaryViolation('<iconify-icon icon="mdi:undo" />')).toBe(true)
  expect(hasIconBoundaryViolation("import undo from '@/ui/icons/svg/history_undo.svg'"))
    .toBe(true)
  expect(hasIconBoundaryViolation("fetch('https://api.iconify.design/mdi/undo.svg')"))
    .toBe(true)
  expect(hasIconBoundaryViolation("import undo from '../icons/svg/foo.svg'"))
    .toBe(true)
  expect(hasIconBoundaryViolation("fetch('https://example.com/foo.svg')"))
    .toBe(true)
  expect(hasIconBoundaryViolation('background: url(https://example.com/icon.svg)'))
    .toBe(true)
  expect(hasIconBoundaryViolation('background: url("https://example.com/icon.svg")'))
    .toBe(true)
  expect(hasIconBoundaryViolation('background: url(../icons/svg/foo.svg)'))
    .toBe(true)
  expect(hasIconBoundaryViolation("background: url('../icons/svg/foo.svg')"))
    .toBe(true)
  expect(hasIconBoundaryViolation('content: url(https://example.com/docs)'))
    .toBe(false)
  expect(hasIconBoundaryViolation("window.open('https://example.com/docs')"))
    .toBe(false)
  expect(hasIconBoundaryViolation("import AppIcon from '@/ui/icons/AppIcon.vue'"))
    .toBe(false)

  const productionFiles = [
    ...globSync('src/**/*.{vue,ts,tsx,js,jsx}'),
    ...globSync('src/**/*.css'),
    'index.html',
  ].map((file) => file.replaceAll('\\', '/'))
  expect(productionFiles).toContain('src/styles/tokens.css')
  expect(productionFiles).toContain('index.html')
  const violations = productionFiles.filter(fileHasIconBoundaryViolation)
  expect(violations).toEqual([])
})

it('keeps every Vue component behind application interfaces', () => {
  const violations: string[] = []
  for (const file of globSync('src/**/*.vue')) {
    const source = readFileSync(file, 'utf8')
    if (/application\/commands|domain\/measurement|@\/platform|@tauri-apps\/api|\binvoke\s*\(|new\s+\w+Command\b/.test(source)) {
      violations.push(file)
    }
  }
  expect(violations).toEqual([])
})
