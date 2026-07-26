import { globSync, readFileSync } from 'node:fs'

const iconRegistry = 'src/ui/icons/icon-registry.ts'

type StaticResourceReference = {
  kind: 'module' | 'html' | 'css'
  value: string
}

function staticResourceReferences(source: string): StaticResourceReference[] {
  const references: StaticResourceReference[] = []
  const collect = (kind: StaticResourceReference['kind'], pattern: RegExp, valueIndex: number) => {
    for (const match of source.matchAll(pattern)) {
      references.push({ kind, value: match[valueIndex].trim() })
    }
  }

  collect('module', /\bimport\s*(['"])([^'"\r\n]+)\1/g, 2)
  collect('module', /\bfrom\s*(['"])([^'"\r\n]+)\1/g, 2)
  collect('module', /\bimport\s*\(\s*(['"])([^'"\r\n]+)\1\s*\)/g, 2)
  collect('html', /\bsrc\s*=\s*(['"])(.*?)\1/gi, 2)

  for (const match of source.matchAll(/url\(\s*(?:(['"])(.*?)\1|([^)]*?))\s*\)/gi)) {
    references.push({ kind: 'css', value: (match[2] ?? match[3] ?? '').trim() })
  }
  return references
}

function isSvgReference(reference: string): boolean {
  return !/^(?:data:|#)/i.test(reference) && /\.svg(?:[?#].*)?$/i.test(reference)
}

function hasStaticSvgReference(source: string, allowModuleImports = false): boolean {
  return staticResourceReferences(source).some(({ kind, value }) =>
    isSvgReference(value) && !(allowModuleImports && kind === 'module'),
  )
}

function hasCustomNetworkIconReference(source: string): boolean {
  return /https?:\/\/[^'"\s)]*(?:iconify|\/icons?(?:[/?#][^'"\s)]*)?)/i.test(source)
    || /\bfetch\s*\(\s*(['"])https?:\/\/[^'"\s)]*\.svg(?:[?#][^'"\s)]*)?\1/i.test(source)
}

function hasIconBoundaryViolation(source: string): boolean {
  return /<iconify-icon/i.test(source)
    || hasStaticSvgReference(source)
    || hasCustomNetworkIconReference(source)
}

function fileHasIconBoundaryViolation(file: string): boolean {
  const normalizedFile = file.replaceAll('\\', '/')
  const source = readFileSync(file, 'utf8')
  return /<iconify-icon/i.test(source)
    || hasCustomNetworkIconReference(source)
    || hasStaticSvgReference(source, normalizedFile === iconRegistry)
}

it('loads local UI icons only through the shared registry boundary', () => {
  expect(hasIconBoundaryViolation('<iconify-icon icon="mdi:undo" />')).toBe(true)
  expect(hasIconBoundaryViolation("import undo from '@/ui/icons/svg/history_undo.svg'"))
    .toBe(true)
  expect(hasIconBoundaryViolation("fetch('https://api.iconify.design/mdi/undo.svg')"))
    .toBe(true)
  expect(hasIconBoundaryViolation("import undo from '../icons/svg/foo.svg'"))
    .toBe(true)
  expect(hasIconBoundaryViolation("import close from 'icons/close.svg?url'"))
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
  expect(hasIconBoundaryViolation('background: url(/src/ui/icons/svg/close.svg)'))
    .toBe(true)
  expect(hasIconBoundaryViolation('background: url("/src/ui/icons/svg/close.svg")'))
    .toBe(true)
  expect(hasIconBoundaryViolation('background: url(icons/close.svg)'))
    .toBe(true)
  expect(hasIconBoundaryViolation("background: url('icons/close.svg')"))
    .toBe(true)
  expect(hasIconBoundaryViolation('<img src="/src/ui/icons/svg/close.svg">'))
    .toBe(true)
  expect(hasIconBoundaryViolation("<img src='/src/ui/icons/svg/close.svg'>"))
    .toBe(true)
  expect(hasIconBoundaryViolation('<img src="icons/close.svg">'))
    .toBe(true)
  expect(hasIconBoundaryViolation("<img src='icons/close.svg'>"))
    .toBe(true)
  expect(hasIconBoundaryViolation('background: url(data:image/svg+xml,%3Csvg%3E%3C/svg%3E)'))
    .toBe(false)
  expect(hasIconBoundaryViolation('background: url(#close-icon)'))
    .toBe(false)
  expect(hasIconBoundaryViolation("const filename = 'icons/close.svg'"))
    .toBe(false)
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
