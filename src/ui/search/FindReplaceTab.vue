<template>
  <section class="find-replace" tabindex="-1" @keydown="onKeydown">
    <div class="find-heading">
      <button type="button" class="back" data-testid="find-back" @click="$emit('back')">返回属性</button>
      <button type="button" class="help" data-testid="find-help" aria-label="查找替换帮助" title="查找替换帮助。查看搜索范围、替换与撤销说明。" @click="$emit('help', 'find-replace')">?</button>
    </div>
    <label>查找<input v-model="query" data-testid="find-query" type="search" @input="refresh" /></label>
    <label>替换<input v-model="replacement" data-testid="find-replacement" type="text" /></label>
    <div class="find-options">
      <button type="button" data-testid="find-case" :aria-pressed="caseSensitive" title="区分大小写。开启后严格匹配字母大小写。" @click="caseSensitive = !caseSensitive; refresh()">Aa</button>
      <button type="button" data-testid="find-word" :aria-pressed="wholeWord" title="全词匹配。只查找 Unicode 完整词。" @click="wholeWord = !wholeWord; refresh()">Ab|</button>
      <select v-model="scope" data-testid="find-scope" aria-label="查找范围" @change="refresh">
        <option value="currentPage">当前页</option><option value="allPages">全部页面</option>
      </select>
    </div>
    <p class="result" role="status">{{ resultMessage }}</p>
    <div class="find-actions">
      <button type="button" data-testid="find-next" :disabled="!query" @click="controller.next()">查找下一个</button>
      <button type="button" :disabled="!query" @click="replaceCurrent">替换</button>
      <button type="button" data-testid="replace-all" :disabled="!query" @click="previewAll">全部替换</button>
    </div>
    <div v-if="preview" class="preview" aria-live="polite">
      <p>将替换 {{ preview.count }} 个匹配，预览前 20 项：</p>
      <ol><li v-for="match in preview.matches.slice(0, 20)" :key="`${match.pageId}:${match.cellId}:${match.labelIndex}:${match.start}`" data-testid="replace-preview-item">{{ match.value }}</li></ol>
      <button type="button" data-testid="confirm-replace-all" @click="confirmAll">确认全部替换</button>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import type { FindMatch, FindTextRequest } from '@/application/search/find-text'
interface Controller {
  search(request: FindTextRequest): FindMatch[]
  next(): FindMatch | null
  replaceCurrent(replacement: string): boolean
  replaceAll(replacement: string): { count: number; matches: FindMatch[] }
  confirmReplaceAll(): number
}
const props = defineProps<{ controller: Controller; currentPageId?: string }>()
const emit = defineEmits<{ back: []; help: [helpId: string] }>()
const query = ref('')
const replacement = ref('')
const caseSensitive = ref(false)
const wholeWord = ref(false)
const scope = ref<'currentPage' | 'allPages'>('currentPage')
const matches = ref<FindMatch[]>([])
const preview = ref<{ count: number; matches: FindMatch[] } | null>(null)
const resultMessage = computed(() => query.value.length === 0 ? '' : matches.value.length > 0 ? `找到 ${matches.value.length} 个匹配` : '未找到匹配文本。')
function refresh(): void {
  preview.value = null
  matches.value = props.controller.search({ query: query.value, scope: scope.value, currentPageId: props.currentPageId, caseSensitive: caseSensitive.value, wholeWord: wholeWord.value })
}
function replaceCurrent(): void { props.controller.replaceCurrent(replacement.value); refresh() }
function previewAll(): void { preview.value = props.controller.replaceAll(replacement.value) }
function confirmAll(): void { props.controller.confirmReplaceAll(); preview.value = null; refresh() }
function onKeydown(event: KeyboardEvent): void { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); emit('back') } }
</script>

<style scoped>
.find-replace { display: flex; flex-direction: column; gap: 10px; padding: 10px 12px 16px; color: var(--color-text); }
.find-heading { display: flex; justify-content: space-between; align-items: center; }
.back { border: 0; background: transparent; color: var(--color-primary); cursor: pointer; padding: 2px 0; }
.help { width: 26px; height: 26px; border: 1px solid var(--color-border); border-radius: 50%; background: transparent; cursor: pointer; }
label { display: grid; gap: 4px; color: var(--color-text-secondary); font-size: 11px; }
input, select { height: 30px; border: 1px solid var(--color-border); border-radius: 3px; padding: 0 7px; color: var(--color-text); background: var(--color-panel); }
.find-options, .find-actions { display: flex; gap: 6px; }
.find-options button, .find-actions button, .preview button { min-height: 28px; border: 1px solid var(--color-border); border-radius: 3px; background: #f8fafc; cursor: pointer; }
.find-options button[aria-pressed="true"] { border-color: var(--color-primary); background: #e9eef8; color: var(--color-primary); }
.result { min-height: 18px; margin: 0; color: var(--color-text-secondary); font-size: 12px; }
.preview { padding: 8px; border: 1px solid var(--color-border); border-radius: 4px; background: #f8fafc; font-size: 11px; }
.preview p { margin: 0 0 6px; }.preview ol { max-height: 180px; margin: 0 0 8px; padding-left: 22px; overflow: auto; }
button:focus-visible, input:focus-visible, select:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 1px; }
</style>
