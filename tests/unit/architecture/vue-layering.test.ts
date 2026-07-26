import { globSync, readFileSync } from 'node:fs'

const iconRegistry = 'src/ui/icons/icon-registry.ts'

function hasDirectSvgReference(source: string): boolean {
  return /['"`](?:@\/|\.{1,2}\/)[^'"`]*\.svg(?:\?[^'"`]*)?['"`]/i.test(source)
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
  expect(hasIconBoundaryViolation("window.open('https://example.com/docs')"))
    .toBe(false)
  expect(hasIconBoundaryViolation("import AppIcon from '@/ui/icons/AppIcon.vue'"))
    .toBe(false)

  const violations = globSync('src/**/*.{vue,ts,tsx,js,jsx}').filter(fileHasIconBoundaryViolation)
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
