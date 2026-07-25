import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

describe('root layout', () => {
  it('removes browser spacing from the full-window application mount', () => {
    const css = readFileSync(resolve('src/styles/tokens.css'), 'utf8')

    expect(css).toMatch(/html,\s*body,\s*#app\s*{[^}]*width:\s*100%;[^}]*height:\s*100%;[^}]*margin:\s*0;/s)
    expect(css).toMatch(/body\s*{[^}]*overflow:\s*hidden;/s)
  })
})
