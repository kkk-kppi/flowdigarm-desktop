<template>
  <div
    class="text-editor-overlay"
    data-testid="text-editor-overlay"
    :style="overlayStyle"
  >
    <textarea
      ref="textareaRef"
      v-model="draft"
      class="text-editor-textarea"
      data-testid="text-editor-textarea"
      :style="textareaStyle"
      @input="onInput"
      @compositionstart="session.compositionStart()"
      @compositionend="onCompositionEnd"
      @keydown="onKeydown"
      @blur="onBlur"
    />
  </div>
</template>

<script setup lang="ts">
// 覆盖式文本编辑器：打开时以 TextContent 镜像字体样式，位置尺寸经 ViewportTransform
// 一次换算（pt→屏幕 px，不叠乘 DOM scale）。
// 行为：Esc 取消（文档不变）；失焦或 Ctrl/Cmd+Enter 提交；IME 组合中失焦挂起，
// compositionend 后再提交；一次会话最多一条 EditTextCommand（未变更不产生）。
// Enter（无 Ctrl）在 textarea 内换行（默认行为，不拦截）。
import { computed, nextTick, onMounted, ref } from 'vue'
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
}>()

const emit = defineEmits<{ (e: 'close'): void }>()

const documentStore = useDocumentStore()
const textEditController = new TextEditController(
  () => documentStore.document,
  (command) => documentStore.executeCommand(command),
)

const draft = ref(props.content.value)
const session = new TextEditSession(props.content.value)
const textareaRef = ref<HTMLTextAreaElement | null>(null)
/** IME 组合中失焦挂起：compositionend 后再提交。 */
let blurPending = false
let closed = false

const overlayStyle = computed(() => {
  const transform = new ViewportTransform(props.viewport)
  const origin = transform.pointToScreen({ x: props.areaPt.x, y: props.areaPt.y })
  return {
    left: `${origin.x}px`,
    top: `${origin.y}px`,
    width: `${transform.ptLengthToPx(props.areaPt.width)}px`,
    height: `${transform.ptLengthToPx(props.areaPt.height)}px`,
  }
})

const textareaStyle = computed(() => {
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
  session.update(draft.value)
}

function onCompositionEnd(event: CompositionEvent): void {
  session.compositionEnd((event.target as HTMLTextAreaElement).value)
  if (blurPending) {
    commitAndClose()
  }
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') {
    event.preventDefault()
    cancelAndClose()
    return
  }
  if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
    event.preventDefault()
    if (!session.isComposing) {
      commitAndClose()
    }
  }
}

function onBlur(): void {
  if (closed) return
  if (session.isComposing) {
    blurPending = true
    return
  }
  commitAndClose()
}

/** 提交：有变更才执行 EditTextCommand；超长等命令错误经通知提示。 */
function commitAndClose(): void {
  if (closed) return
  closed = true
  const result = session.commit()
  if (result) {
    try {
      textEditController.commit(props.pageId, props.target, session.originalValue, result.value)
    } catch (error) {
      documentStore.setNotice(error instanceof Error ? error.message : String(error))
    }
  }
  emit('close')
}

function cancelAndClose(): void {
  if (closed) return
  closed = true
  session.cancel()
  emit('close')
}
</script>

<style scoped>
.text-editor-overlay {
  position: absolute;
  z-index: 10;
  overflow: hidden;
}

.text-editor-textarea {
  display: block;
  width: 100%;
  height: 100%;
  box-sizing: border-box;
  padding: 0 2px;
  margin: 0;
  border: 1px solid var(--color-primary);
  border-radius: 2px;
  outline: none;
  resize: none;
  overflow: hidden;
  white-space: pre-wrap;
  background: var(--color-panel);
}
</style>
