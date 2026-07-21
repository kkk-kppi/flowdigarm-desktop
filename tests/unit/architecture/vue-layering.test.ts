import { readFileSync } from 'node:fs'
import { globSync } from 'node:fs'

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
