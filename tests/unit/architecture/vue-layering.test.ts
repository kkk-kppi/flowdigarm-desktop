import { readFileSync } from 'node:fs'
import { globSync } from 'node:fs'

function hasIconBoundaryViolation(source: string): boolean {
  return /<iconify-icon|(?:@\/ui\/icons|\.\/icons)\/svg\/|https?:\/\/[^'"\s]*(?:iconify|icons)/i.test(source)
}

it('loads local UI icons only through the shared registry boundary', () => {
  expect(hasIconBoundaryViolation('<iconify-icon icon="mdi:undo" />')).toBe(true)
  expect(hasIconBoundaryViolation("import undo from '@/ui/icons/svg/history_undo.svg'"))
    .toBe(true)
  expect(hasIconBoundaryViolation("fetch('https://api.iconify.design/mdi/undo.svg')"))
    .toBe(true)
  expect(hasIconBoundaryViolation("import AppIcon from '@/ui/icons/AppIcon.vue'"))
    .toBe(false)

  const violations = globSync('src/ui/**/*.vue').filter((file) =>
    hasIconBoundaryViolation(readFileSync(file, 'utf8')),
  )
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
