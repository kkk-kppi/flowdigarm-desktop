import { featureHelpRegistry, getFeatureHelp } from '@/ui/help/feature-help-registry'
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

describe('功能帮助注册表', () => {
  it('至少包含 undo 与 redo 两条首批条目', () => {
    expect(featureHelpRegistry.has('undo')).toBe(true)
    expect(featureHelpRegistry.has('redo')).toBe(true)
  })

  it('每个条目的 8 个必填字段均非空', () => {
    const requiredFields = [
      'id',
      'title',
      'purpose',
      'operation',
      'scope',
      'undoBoundary',
      'limits',
      'docAnchor',
    ] as const
    for (const entry of featureHelpRegistry.values()) {
      for (const field of requiredFields) {
        expect(entry[field]).toBeTruthy()
      }
    }
  })

  it('getFeatureHelp 命中返回条目，未命中返回 undefined', () => {
    expect(getFeatureHelp('undo')?.id).toBe('undo')
    expect(getFeatureHelp('不存在')).toBeUndefined()
  })

  it('画布与视图条目（rulers/grid/zoom/fit-view）均可取出且 8 字段非空', () => {
    const requiredFields = [
      'id',
      'title',
      'purpose',
      'operation',
      'scope',
      'undoBoundary',
      'limits',
      'docAnchor',
    ] as const
    for (const id of ['rulers', 'grid', 'zoom', 'fit-view']) {
      const entry = getFeatureHelp(id)
      expect(entry, `条目 ${id} 应已注册`).toBeTruthy()
      for (const field of requiredFields) {
        expect(entry?.[field], `条目 ${id} 字段 ${field}`).toBeTruthy()
      }
      // 视图操作的撤销边界必须写明不进入撤销历史
      expect(entry?.undoBoundary).toContain('不进入撤销历史')
      expect(entry?.docAnchor).toBe('docs/user-guide.md#画布与视图')
    }
  })

  it('页面管理条目（page-setup/page-breaks/background-page/page-tabs）均已注册且 8 字段非空', () => {
    const requiredFields = [
      'id',
      'title',
      'purpose',
      'operation',
      'scope',
      'undoBoundary',
      'limits',
      'docAnchor',
    ] as const
    for (const id of ['page-setup', 'page-breaks', 'background-page', 'page-tabs']) {
      const entry = getFeatureHelp(id)
      expect(entry, `条目 ${id} 应已注册`).toBeTruthy()
      for (const field of requiredFields) {
        expect(entry?.[field], `条目 ${id} 字段 ${field}`).toBeTruthy()
      }
    }
  })

  it('page-setup 撤销边界写明「一次应用一条记录」', () => {
    expect(getFeatureHelp('page-setup')?.undoBoundary).toContain('一次应用一条记录')
  })

  it('page-breaks 撤销边界写明视图开关不进入撤销历史', () => {
    expect(getFeatureHelp('page-breaks')?.undoBoundary).toContain('不进入撤销历史')
  })

  it('page-tabs 撤销边界写明切换页不产生命令', () => {
    expect(getFeatureHelp('page-tabs')?.undoBoundary).toContain('不产生命令')
  })

  it('background-page 限制条件写明背景页内容不可在前景页选择', () => {
    expect(getFeatureHelp('background-page')?.limits).toContain('不可在前景页直接选择')
  })

  it('图元/连接/剪贴板/删除条目（shape-library/connect/clipboard/delete-cells）均已注册且 8 字段非空', () => {
    const requiredFields = [
      'id',
      'title',
      'purpose',
      'operation',
      'scope',
      'undoBoundary',
      'limits',
      'docAnchor',
    ] as const
    for (const id of ['shape-library', 'connect', 'clipboard', 'delete-cells']) {
      const entry = getFeatureHelp(id)
      expect(entry, `条目 ${id} 应已注册`).toBeTruthy()
      for (const field of requiredFields) {
        expect(entry?.[field], `条目 ${id} 字段 ${field}`).toBeTruthy()
      }
    }
  })

  it('clipboard 撤销边界写明一次粘贴只产生一条记录', () => {
    expect(getFeatureHelp('clipboard')?.undoBoundary).toContain('一次粘贴')
    expect(getFeatureHelp('clipboard')?.undoBoundary).toContain('一条记录')
  })

  it('delete-cells 撤销边界写明一次删除多个图元只产生一条记录', () => {
    expect(getFeatureHelp('delete-cells')?.undoBoundary).toContain('一条记录')
  })

  it('文本与样式条目（text-edit/text-style/property-panel/edge-style）均已注册且 8 字段非空', () => {
    const requiredFields = [
      'id',
      'title',
      'purpose',
      'operation',
      'scope',
      'undoBoundary',
      'limits',
      'docAnchor',
    ] as const
    for (const id of ['text-edit', 'text-style', 'property-panel', 'edge-style']) {
      const entry = getFeatureHelp(id)
      expect(entry, `条目 ${id} 应已注册`).toBeTruthy()
      for (const field of requiredFields) {
        expect(entry?.[field], `条目 ${id} 字段 ${field}`).toBeTruthy()
      }
    }
  })

  it('text-edit 撤销边界写明一次编辑会话一条记录；限制写明 IME 组合过程不入栈', () => {
    expect(getFeatureHelp('text-edit')?.undoBoundary).toContain('一次编辑会话一条记录')
    expect(getFeatureHelp('text-edit')?.limits).toContain('IME')
  })

  it('text-style 撤销边界写明一次控件变更一条记录；操作写明 mixed 多值态', () => {
    expect(getFeatureHelp('text-style')?.undoBoundary).toContain('一次控件变更一条记录')
    expect(getFeatureHelp('text-style')?.operation).toContain('多个值')
  })

  it('Task 7 八条目（format-paint/align/distribute/z-order/auto-connect/group-container/hyperlink/top-shapes）均注册且 8 字段非空', () => {
    const requiredFields = [
      'id',
      'title',
      'purpose',
      'operation',
      'scope',
      'undoBoundary',
      'limits',
      'docAnchor',
    ] as const
    for (const id of [
      'format-paint',
      'align',
      'distribute',
      'z-order',
      'auto-connect',
      'group-container',
      'hyperlink',
      'top-shapes',
    ]) {
      const entry = getFeatureHelp(id)
      expect(entry, `条目 ${id} 应已注册`).toBeTruthy()
      for (const field of requiredFields) {
        expect(entry?.[field], `条目 ${id} 字段 ${field}`).toBeTruthy()
      }
    }
  })

  it('format-paint 写明单次/连续/Esc 与复制范围（不复制位置/内容/链接）', () => {
    const entry = getFeatureHelp('format-paint')
    expect(entry?.operation).toContain('单击')
    expect(entry?.operation).toContain('双击')
    expect(entry?.operation).toContain('Esc')
    expect(entry?.limits).toContain('位置')
    expect(entry?.limits).toContain('内容')
    expect(entry?.limits).toContain('链接')
  })

  it('align 写明锚点=选择序列第一个图元', () => {
    expect(getFeatureHelp('align')?.operation).toContain('选择序列第一个')
  })

  it('hyperlink 写明普通点击=选择、Ctrl/Cmd+点击=打开与白名单限制', () => {
    const entry = getFeatureHelp('hyperlink')
    expect(entry?.operation).toContain('Ctrl')
    expect(entry?.limits).toContain('http')
    expect(entry?.limits).toContain('mailto')
  })

  it('每个文档锚点都解析到现有 Markdown 标题', () => {
    const slug = (heading: string) => heading
      .toLocaleLowerCase()
      .replace(/[^\p{L}\p{N}\s-]/gu, '')
      .trim()
      .replace(/\s+/g, '-')
    for (const entry of featureHelpRegistry.values()) {
      const [relativePath, anchor, extra] = entry.docAnchor.split('#')
      expect(extra, entry.id).toBeUndefined()
      expect(relativePath, entry.id).toMatch(/^docs\/.+\.md$/)
      const filePath = resolve(process.cwd(), relativePath)
      expect(existsSync(filePath), entry.docAnchor).toBe(true)
      const headings = readFileSync(filePath, 'utf8')
        .split(/\r?\n/)
        .filter((line) => /^#+\s/.test(line))
        .map((line) => slug(line.replace(/^#+\s+/, '')))
      expect(headings, entry.docAnchor).toContain(anchor)
    }
  })
})
