<template>
  <div
    class="text-editor-overlay"
    data-testid="text-editor-overlay"
    :style="overlayStyle"
  >
    <div
      class="text-editor-content"
      :style="contentOverflowStyle"
    >
      <div
        class="text-editor-mirror"
        data-testid="text-editor-mirror"
        :style="textareaStyle"
        aria-hidden="true"
      >{{ `${editorDraft} ` }}</div>
      <textarea
        ref="textareaRef"
        v-model="editorDraft"
        class="text-editor-textarea"
        data-testid="text-editor-textarea"
        :aria-label="targetLabel"
        :style="textareaStyle"
        @input="onInput"
        @compositionstart="session.compositionStart()"
        @compositionend="onCompositionEnd"
        @keydown="onKeydown"
        @blur="onBlur"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
// 覆盖式文本编辑器：打开时以 TextContent 镜像字体样式，位置尺寸经 ViewportTransform
// 一次换算（pt→屏幕 px，不叠乘 DOM scale）。
// 行为：Esc 取消（文档不变）；失焦或 Ctrl/Cmd+Enter 提交；IME 组合中失焦挂起，
// compositionend 后再提交；一次会话最多一条 EditTextCommand（未变更不产生）。
// Enter（无 Ctrl）在 textarea 内换行（默认行为，不拦截）。
import { computed, nextTick, onMounted, ref, type CSSProperties } from 'vue'
import type { TextContent } from '@/domain/diagram'
import { TextEditSession } from '@/application/text/text-session'
import type { TextTarget } from '@/application/text/text-target'
import { TextEditController } from '@/application/text/text-edit-controller'
import { ViewportTransform, type ViewportState } from '@/application/viewport/viewport-transform'
import { useDocumentStore } from '@/stores/document-store'

const props = defineProps<{
  pageId: string
  target: TextTarget
  /** 文本区 pt 矩形（文档坐标）。 */
  areaPt: { x: number; y: number; width: number; height: number }
  /** 当前文本内容（初始值 + 字体镜像）。 */
  content: TextContent
  viewport: ViewportState
  angle?: number
  rotationCenterPt?: { x: number; y: number }
}>()

const emit = defineEmits<{ (e: 'close', restoreCanvasFocus?: boolean): void }>()

const documentStore = useDocumentStore()
const textEditController = new TextEditController(
  () => documentStore.document,
  (command) => documentStore.executeCommand(command),
)

const documentAtOpen = documentStore.document
const VERTICAL_NEWLINE_PLACEHOLDER = '\u200B'
const draft = ref(props.content.value)
const editorDraft = ref(toEditorValue(props.content.value))
const session = new TextEditSession(props.content.value)
const textareaRef = ref<HTMLTextAreaElement | null>(null)
const targetLabel = computed(() => props.target.kind === 'node' ? '编辑节点文本' : '编辑连线标签')
const contentOverflowStyle = { maxHeight: 'none', overflow: 'visible' } as const
/** IME 组合中失焦挂起：compositionend 后再提交。 */
let blurPending = false
let closed = false

const overlayStyle = computed(() => {
  const transform = new ViewportTransform(props.viewport)
  const origin = transform.pointToScreen({ x: props.areaPt.x, y: props.areaPt.y })
  const alignItems = {
    top: 'flex-start',
    middle: 'center',
    bottom: 'flex-end',
  }[props.content.block.verticalAlign]
  return {
    left: `${origin.x}px`,
    top: `${origin.y}px`,
    width: `${transform.ptLengthToPx(props.areaPt.width)}px`,
    height: `${transform.ptLengthToPx(props.areaPt.height)}px`,
    alignItems,
    background: props.content.style.background ?? 'var(--color-panel)',
    overflow: 'visible',
    ...(props.angle && props.rotationCenterPt
      ? {
          transform: `rotate(${props.angle}deg)`,
          transformOrigin: `${transform.ptLengthToPx(props.rotationCenterPt.x - props.areaPt.x)}px ${transform.ptLengthToPx(props.rotationCenterPt.y - props.areaPt.y)}px`,
        }
      : {}),
  }
})

const textareaStyle = computed<CSSProperties>(() => {
  const transform = new ViewportTransform(props.viewport)
  const { style, block, paragraph } = props.content
  const decorations: string[] = []
  if (style.underline) decorations.push('underline')
  if (style.strikethrough) decorations.push('line-through')
  return {
    // 字体名加引号：CJK/含空格字体名未加引号时 jsdom（cssstyle）拒绝解析
    fontFamily: `"${style.fontFamily}"`,
    fontSize: `${transform.ptLengthToPx(style.fontSize)}px`,
    fontWeight: style.bold ? '700' : '400',
    fontStyle: style.italic ? 'italic' : 'normal',
    textDecoration: decorations.length > 0 ? decorations.join(' ') : 'none',
    color: style.color,
    background: style.background ?? 'transparent',
    textAlign: block.horizontalAlign,
    lineHeight: String(paragraph.lineHeight),
  }
})

onMounted(async () => {
  await nextTick()
  textareaRef.value?.focus()
  textareaRef.value?.select()
})

function onInput(): void {
  draft.value = fromEditorValue(editorDraft.value)
  session.update(draft.value)
  if (!session.isComposing) normalizeEditorDraft()
}

function onCompositionEnd(event: CompositionEvent): void {
  editorDraft.value = (event.target as HTMLTextAreaElement).value
  draft.value = fromEditorValue(editorDraft.value)
  session.compositionEnd(draft.value)
  normalizeEditorDraft()
  if (blurPending) {
    commitAndClose(false)
  }
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') {
    if (event.isComposing || session.isComposing || event.keyCode === 229) {
      return
    }
    event.preventDefault()
    cancelAndClose(true)
    return
  }
  if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
    event.preventDefault()
    if (!session.isComposing) {
      commitAndClose(true)
    }
  }
}

function onBlur(): void {
  if (closed) return
  if (session.isComposing) {
    blurPending = true
    return
  }
  commitAndClose(false)
}

/** 提交：有变更才执行 EditTextCommand；超长等命令错误经通知提示。 */
function commitAndClose(restoreCanvasFocus: boolean): void {
  if (closed) return
  const result = session.commit()
  if (result) {
    try {
      textEditController.commit(
        props.pageId,
        props.target,
        session.originalValue,
        result.value,
        documentAtOpen,
      )
    } catch (error) {
      documentStore.setNotice(error instanceof Error ? error.message : String(error))
      void nextTick(() => textareaRef.value?.focus())
      return
    }
  }
  closed = true
  emit('close', restoreCanvasFocus)
}

function cancelAndClose(restoreCanvasFocus: boolean): void {
  if (closed) return
  closed = true
  session.cancel()
  emit('close', restoreCanvasFocus)
}

function toEditorValue(value: string): string {
  return props.content.block.direction === 'vertical'
    ? [...value].map((character) => {
        if (character === '\n') return VERTICAL_NEWLINE_PLACEHOLDER
        if (character === VERTICAL_NEWLINE_PLACEHOLDER) {
          return VERTICAL_NEWLINE_PLACEHOLDER.repeat(2)
        }
        return character
      }).join('\n')
    : value
}

function fromEditorValue(value: string): string {
  if (props.content.block.direction !== 'vertical' || value === '') return value
  return value.split('\n')
    .map((line) => {
      if (line === '' || line === VERTICAL_NEWLINE_PLACEHOLDER) return '\n'
      return line.replaceAll(VERTICAL_NEWLINE_PLACEHOLDER.repeat(2), VERTICAL_NEWLINE_PLACEHOLDER)
    })
    .join('')
}

function normalizeEditorDraft(): void {
  if (props.content.block.direction !== 'vertical') return
  const textarea = textareaRef.value
  const selectionStart = textarea?.selectionStart ?? editorDraft.value.length
  const sourceBeforeCaret = fromEditorValue(editorDraft.value.slice(0, selectionStart))
  const normalized = toEditorValue(draft.value)
  if (normalized === editorDraft.value) return
  editorDraft.value = normalized
  const normalizedCaret = toEditorValue(sourceBeforeCaret).length
  void nextTick(() => textareaRef.value?.setSelectionRange(normalizedCaret, normalizedCaret))
}
</script>

<style scoped>
.text-editor-overlay {
  position: absolute;
  z-index: 10;
  display: flex;
  box-sizing: border-box;
  border: 1px solid var(--color-primary);
  border-radius: 2px;
}

.text-editor-content {
  position: relative;
  width: 100%;
  min-height: 0;
}

.text-editor-mirror,
.text-editor-textarea {
  box-sizing: border-box;
  width: 100%;
  padding: 0 2px;
  margin: 0;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.text-editor-mirror {
  visibility: hidden;
}

.text-editor-textarea {
  position: absolute;
  inset: 0;
  height: 100%;
  border: 0;
  outline: none;
  resize: none;
  overflow: hidden;
}
</style>
