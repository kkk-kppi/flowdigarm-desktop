import { iconUrls, type IconName } from '@/ui/icons/icon-registry'

const required: IconName[] = [
  'appGraph', 'minimize', 'maximize', 'restore', 'close', 'check',
  'chevronLeft', 'chevronRight', 'chevronDown', 'chevronUp',
  'undo', 'redo', 'copy', 'cut', 'paste', 'formatPaint',
  'bold', 'italic', 'underline', 'strikethrough', 'font', 'fontSize',
  'textColor', 'fillColor', 'alignLeft', 'alignCenter', 'alignRight',
  'alignTop', 'alignMiddle', 'alignBottom', 'add', 'search', 'help',
  'delete', 'minus', 'arrowRight', 'arrowLeftRight', 'fitToScreen',
  'gridOn', 'gridOff', 'magnet',
]

describe('icon registry', () => {
  it('maps every approved shell semantic to a bundled SVG URL', () => {
    expect(Object.keys(iconUrls).sort()).toEqual([...required].sort())
    for (const name of required) {
      expect(iconUrls[name]).toMatch(/^(?:data:image\/svg\+xml|.*\.svg(?:\?|$))/)
    }
  })
})
