<template>
  <div ref="propertyRoot" class="property-tab" data-testid="property-tab">
    <div class="property-help-links" aria-label="属性功能帮助">
      <QuickHelpButton help-id="connect" label="连线" />
      <QuickHelpButton help-id="group-container" label="组合容器" />
    </div>
    <p v-if="noSelection" class="no-selection" data-testid="no-selection">未选择图元</p>

    <template v-else>
      <!-- 节点信息（单节点） -->
      <section v-if="singleNode" class="prop-section" data-testid="section-node-info">
        <button type="button" class="section-header" :aria-expanded="expanded.info" @click="expanded.info = !expanded.info">
          {{ expanded.info ? '▾' : '▸' }} 节点信息
        </button>
        <div v-if="expanded.info" class="section-body">
          <div class="prop-row">
            <span class="prop-label">类型</span>
            <span class="prop-readonly" data-testid="node-type">{{ shapeLabelOf(singleNode) }}</span>
          </div>
          <label class="prop-row">
            <span class="prop-label">名称</span>
            <input
              type="text"
              data-testid="node-name"
              title="名称（=节点文本，失焦提交）"
              :value="singleNode.text?.value ?? ''"
              @blur="commitNodeName"
            />
          </label>
          <div class="prop-row">
            <span class="prop-label">ID</span>
            <span class="prop-readonly prop-id" data-testid="node-id">{{ singleNode.id }}</span>
          </div>
          <label class="prop-row">
            <span class="prop-label">链接</span>
            <input
              type="text"
              data-testid="node-link"
              title="链接（http/https/mailto，失焦提交；留空清除；Ctrl/Cmd+点击画布节点打开）"
              placeholder="https://"
              :value="singleNode.link ?? ''"
              @blur="commitLink('node', $event)"
            />
          </label>
          <p v-if="linkError" class="link-error" data-testid="link-error">{{ linkError }}</p>
        </div>
      </section>

      <!-- 几何（单节点） -->
      <section v-if="singleNode" class="prop-section" data-testid="section-geometry">
        <button type="button" class="section-header" :aria-expanded="expanded.geometry" @click="expanded.geometry = !expanded.geometry">
          {{ expanded.geometry ? '▾' : '▸' }} 几何
        </button>
        <div v-if="expanded.geometry" class="section-body">
          <label v-for="field in geometryFields" :key="field.key" class="prop-row">
            <span class="prop-label">{{ field.label }}{{ field.angle ? '' : `（${pageUnit}）` }}</span>
            <input
              type="number"
              step="any"
              :data-testid="`geo-${field.key}`"
              :title="field.label"
              :value="geometryDisplay(field.key)"
              @change="commitGeometry(field.key, $event)"
            />
          </label>
        </div>
      </section>

      <section class="prop-section" data-testid="section-business-data">
        <button
          type="button"
          class="section-header"
          :aria-expanded="expanded.businessData"
          @click="expanded.businessData = !expanded.businessData"
        >
          {{ expanded.businessData ? '▾' : '▸' }} 业务数据
        </button>
        <div v-if="expanded.businessData" class="section-body">
          <textarea
            v-model="businessDataDraft"
            rows="8"
            class="business-data-json"
            data-testid="business-data-json"
            title="业务数据 JSON 对象"
            :disabled="!singleNode"
          />
          <p
            v-if="!singleNode"
            class="disabled-explanation"
            data-testid="business-data-disabled"
          >
            仅支持单个节点编辑业务数据。
          </p>
          <p
            v-if="businessDataError"
            class="business-data-error"
            data-testid="business-data-error"
          >
            {{ businessDataError }}
          </p>
          <div class="business-data-actions">
            <button
              type="button"
              data-testid="business-data-apply"
              :disabled="!singleNode"
              @click="applyBusinessData"
            >
              应用
            </button>
            <button
              type="button"
              data-testid="business-data-reset"
              :disabled="!singleNode"
              @click="resetBusinessDataDraft"
            >
              重置
            </button>
          </div>
        </div>
      </section>

      <!-- 样式（节点） -->
      <section v-if="selectedNodes.length > 0" class="prop-section" data-testid="section-style">
        <button type="button" class="section-header" :aria-expanded="expanded.style" @click="expanded.style = !expanded.style">
          {{ expanded.style ? '▾' : '▸' }} 样式
        </button>
        <div v-if="expanded.style" class="section-body">
          <div class="prop-row">
            <span class="prop-label">填充色</span>
            <input
              type="color"
              data-testid="style-fill"
              title="填充色"
              :value="colorValue(nodeAgg.fill)"
              @change="writeNodeStyle({ fill: colorOf($event) })"
            />
            <span v-if="nodeAgg.fill.kind === 'mixed'" class="mixed-mark" data-testid="style-fill-mixed">多个值</span>
          </div>
          <label class="prop-row">
            <span class="prop-label">填充透明度</span>
            <input
              type="number" min="0" max="1" step="0.1"
              data-testid="style-fill-opacity"
              title="填充透明度"
              :value="numberValue(nodeAgg.fillOpacity)"
              :placeholder="nodeAgg.fillOpacity.kind === 'mixed' ? '多个值' : ''"
              @change="numberCommit($event, (v) => writeNodeStyle({ fillOpacity: v }))"
            />
          </label>
          <div class="prop-row">
            <span class="prop-label">边框色</span>
            <input
              type="color"
              data-testid="style-stroke"
              title="边框色"
              :value="colorValue(nodeAgg.stroke)"
              @change="writeNodeStyle({ stroke: colorOf($event) })"
            />
            <span v-if="nodeAgg.stroke.kind === 'mixed'" class="mixed-mark" data-testid="style-stroke-mixed">多个值</span>
          </div>
          <label class="prop-row">
            <span class="prop-label">边框宽度</span>
            <input
              type="number" min="0" step="0.5"
              data-testid="style-stroke-width"
              title="边框宽度"
              :value="numberValue(nodeAgg.strokeWidth)"
              :placeholder="nodeAgg.strokeWidth.kind === 'mixed' ? '多个值' : ''"
              @change="numberCommit($event, (v) => writeNodeStyle({ strokeWidth: v }))"
            />
          </label>
          <label class="prop-row">
            <span class="prop-label">虚线</span>
            <select
              data-testid="style-dash"
              title="虚线样式"
              :value="dashValue"
              @change="writeNodeStyle({ strokeDash: selectOf($event) as NodeStyle['strokeDash'] })"
            >
              <option v-if="nodeAgg.strokeDash.kind === 'mixed'" value="__mixed__" disabled>多个值</option>
              <option value="solid">实线</option>
              <option value="dash">虚线</option>
              <option value="dot">点线</option>
              <option value="dashdot">点划线</option>
            </select>
          </label>
          <label class="prop-row">
            <span class="prop-label">圆角</span>
            <input
              type="number" min="0" step="1"
              data-testid="style-corner-radius"
              title="圆角"
              :value="numberValue(nodeAgg.cornerRadius)"
              :placeholder="nodeAgg.cornerRadius.kind === 'mixed' ? '多个值' : ''"
              @change="numberCommit($event, (v) => writeNodeStyle({ cornerRadius: v }))"
            />
          </label>
          <div class="prop-row">
            <span class="prop-label">阴影颜色</span>
            <input
              type="color"
              data-testid="shadow-color"
              title="阴影颜色"
              :value="shadowField('color') ?? '#000000'"
              @change="writeShadow({ color: colorOf($event) })"
            />
            <span v-if="nodeAgg.shadow.kind === 'mixed'" class="mixed-mark" data-testid="shadow-mixed">多个值</span>
          </div>
          <label class="prop-row">
            <span class="prop-label">阴影透明度</span>
            <input
              type="number" min="0" max="1" step="0.1"
              data-testid="shadow-opacity"
              title="阴影透明度"
              :value="shadowField('opacity') ?? ''"
              @change="numberCommit($event, (v) => writeShadow({ opacity: v }))"
            />
          </label>
          <label class="prop-row">
            <span class="prop-label">阴影 X 偏移</span>
            <input
              type="number" step="1"
              data-testid="shadow-offset-x"
              title="阴影 X 偏移"
              :value="shadowField('offsetX') ?? ''"
              @change="numberCommit($event, (v) => writeShadow({ offsetX: v }))"
            />
          </label>
          <label class="prop-row">
            <span class="prop-label">阴影 Y 偏移</span>
            <input
              type="number" step="1"
              data-testid="shadow-offset-y"
              title="阴影 Y 偏移"
              :value="shadowField('offsetY') ?? ''"
              @change="numberCommit($event, (v) => writeShadow({ offsetY: v }))"
            />
          </label>
          <label class="prop-row">
            <span class="prop-label">阴影模糊</span>
            <input
              type="number" min="0" step="1"
              data-testid="shadow-blur"
              title="阴影模糊"
              :value="shadowField('blur') ?? ''"
              @change="numberCommit($event, (v) => writeShadow({ blur: v }))"
            />
          </label>
        </div>
      </section>

      <!-- 文本（节点 + 混合选择时的边标签） -->
      <section v-if="selectedNodes.length > 0" class="prop-section" data-testid="section-text">
        <button type="button" class="section-header" :aria-expanded="expanded.text" @click="expanded.text = !expanded.text">
          {{ expanded.text ? '▾' : '▸' }} 文本
        </button>
        <div v-if="expanded.text" class="section-body">
          <label v-if="singleNode" class="prop-row prop-row-top">
            <span class="prop-label">内容</span>
            <textarea
              rows="3"
              data-testid="text-content"
              title="文本内容（失焦提交）"
              :value="singleNode.text?.value ?? ''"
              @blur="commitNodeName"
            />
          </label>
          <label class="prop-row">
            <span class="prop-label">字体</span>
            <select
              data-testid="font-family"
              title="字体"
              :value="textValue(textAgg.style.fontFamily) ?? '__mixed__'"
              :disabled="textAgg.style.fontFamily.kind === 'none'"
              @change="writeTextPatch({ style: { fontFamily: selectOf($event) } })"
            >
              <option v-if="textAgg.style.fontFamily.kind === 'mixed'" value="__mixed__" disabled>多个值</option>
              <option v-for="family in fontFamilies" :key="family" :value="family">{{ family }}</option>
            </select>
          </label>
          <label class="prop-row">
            <span class="prop-label">字号</span>
            <select
              data-testid="font-size"
              title="字号"
              :value="textValue(textAgg.style.fontSize) ?? '__mixed__'"
              :disabled="textAgg.style.fontSize.kind === 'none'"
              @change="writeTextPatch({ style: { fontSize: Number(selectOf($event)) } })"
            >
              <option v-if="textAgg.style.fontSize.kind === 'mixed'" value="__mixed__" disabled>多个值</option>
              <option v-for="size in fontSizes" :key="size" :value="String(size)">{{ size }}</option>
            </select>
          </label>
          <div class="prop-row">
            <span class="prop-label">字形</span>
            <div class="button-group" role="group" aria-label="字形">
              <button
                v-for="btn in styleButtons"
                :key="btn.key"
                type="button"
                :data-testid="`btn-${btn.key}`"
                :title="btn.title"
                :class="{ active: isTrue(textAgg.style[btn.key]), indeterminate: textAgg.style[btn.key].kind === 'mixed' }"
                :aria-pressed="boolPressed(textAgg.style[btn.key])"
                :disabled="textAgg.style[btn.key].kind === 'none'"
                @click="toggleStyleBool(btn.key)"
              >
                {{ btn.label }}
              </button>
            </div>
          </div>
          <div class="prop-row">
            <span class="prop-label">字体颜色</span>
            <input
              type="color"
              data-testid="text-color"
              title="字体颜色"
              :value="colorValue(textAgg.style.color)"
              :disabled="textAgg.style.color.kind === 'none'"
              @change="writeTextPatch({ style: { color: colorOf($event) } })"
            />
            <span v-if="textAgg.style.color.kind === 'mixed'" class="mixed-mark" data-testid="text-color-mixed">多个值</span>
          </div>
          <div class="prop-row">
            <span class="prop-label">字体背景色</span>
            <input
              type="color"
              data-testid="text-background"
              title="字体背景色"
              :value="colorValue(textAgg.style.background)"
              :disabled="textAgg.style.background.kind === 'none'"
              @change="writeTextPatch({ style: { background: colorOf($event) } })"
            />
            <span v-if="textAgg.style.background.kind === 'mixed'" class="mixed-mark">多个值</span>
          </div>
          <div class="prop-row">
            <span class="prop-label">水平对齐</span>
            <div class="button-group" role="group" aria-label="水平对齐">
              <button
                v-for="opt in horizontalOptions"
                :key="opt.value"
                type="button"
                :data-testid="`align-${opt.value}`"
                :title="opt.title"
                :class="{ active: textAgg.block.horizontalAlign.kind === 'value' && textAgg.block.horizontalAlign.value === opt.value, indeterminate: textAgg.block.horizontalAlign.kind === 'mixed' }"
                :aria-pressed="alignPressed(textAgg.block.horizontalAlign, opt.value)"
                :disabled="textAgg.block.horizontalAlign.kind === 'none'"
                @click="writeTextPatch({ block: { horizontalAlign: opt.value } })"
              >
                {{ opt.label }}
              </button>
            </div>
          </div>
          <div class="prop-row">
            <span class="prop-label">垂直对齐</span>
            <div class="button-group" role="group" aria-label="垂直对齐">
              <button
                v-for="opt in verticalOptions"
                :key="opt.value"
                type="button"
                :data-testid="`valign-${opt.value}`"
                :title="opt.title"
                :class="{ active: textAgg.block.verticalAlign.kind === 'value' && textAgg.block.verticalAlign.value === opt.value, indeterminate: textAgg.block.verticalAlign.kind === 'mixed' }"
                :aria-pressed="alignPressed(textAgg.block.verticalAlign, opt.value)"
                :disabled="textAgg.block.verticalAlign.kind === 'none'"
                @click="writeTextPatch({ block: { verticalAlign: opt.value } })"
              >
                {{ opt.label }}
              </button>
            </div>
          </div>
          <div class="prop-row">
            <span class="prop-label">方向</span>
            <div class="button-group" role="group" aria-label="文本方向">
              <button
                v-for="opt in directionOptions"
                :key="opt.value"
                type="button"
                :data-testid="`direction-${opt.value}`"
                :title="opt.title"
                :class="{ active: textAgg.block.direction.kind === 'value' && textAgg.block.direction.value === opt.value, indeterminate: textAgg.block.direction.kind === 'mixed' }"
                :aria-pressed="alignPressed(textAgg.block.direction, opt.value)"
                :disabled="textAgg.block.direction.kind === 'none'"
                @click="writeTextPatch({ block: { direction: opt.value } })"
              >
                {{ opt.label }}
              </button>
            </div>
          </div>
          <label v-for="margin in marginFields" :key="margin.key" class="prop-row">
            <span class="prop-label">{{ margin.label }}</span>
            <input
              type="number" step="1"
              :data-testid="`margin-${margin.key}`"
              :title="margin.label"
              :value="numberValue(textAgg.block[margin.key])"
              :placeholder="textAgg.block[margin.key].kind === 'mixed' ? '多个值' : ''"
              :disabled="textAgg.block[margin.key].kind === 'none'"
              @change="numberCommit($event, (v) => writeTextPatch({ block: { [margin.key]: v } }))"
            />
          </label>
          <label v-for="para in paragraphFields" :key="para.key" class="prop-row">
            <span class="prop-label">{{ para.label }}</span>
            <input
              type="number" step="any" min="0"
              :data-testid="`para-${para.key}`"
              :title="para.label"
              :value="numberValue(textAgg.paragraph[para.key])"
              :placeholder="textAgg.paragraph[para.key].kind === 'mixed' ? '多个值' : ''"
              :disabled="textAgg.paragraph[para.key].kind === 'none'"
              @change="numberCommit($event, (v) => writeTextPatch({ paragraph: { [para.key]: v } }))"
            />
          </label>
        </div>
      </section>

      <!-- 边属性 -->
      <section v-if="selectedEdges.length > 0" class="prop-section" data-testid="section-edge">
        <button type="button" class="section-header" :aria-expanded="expanded.edge" @click="expanded.edge = !expanded.edge">
          {{ expanded.edge ? '▾' : '▸' }} 边属性
        </button>
        <div v-if="expanded.edge" class="section-body">
          <div class="prop-row">
            <span class="prop-label">线条颜色</span>
            <input
              type="color"
              data-testid="edge-stroke"
              title="线条颜色"
              :value="colorValue(edgeAgg.stroke)"
              @change="writeEdgeStyle({ stroke: colorOf($event) })"
            />
            <span v-if="edgeAgg.stroke.kind === 'mixed'" class="mixed-mark">多个值</span>
          </div>
          <label class="prop-row">
            <span class="prop-label">线条宽度</span>
            <input
              type="number" min="0" step="0.5"
              data-testid="edge-stroke-width"
              title="线条宽度"
              :value="numberValue(edgeAgg.strokeWidth)"
              :placeholder="edgeAgg.strokeWidth.kind === 'mixed' ? '多个值' : ''"
              @change="numberCommit($event, (v) => writeEdgeStyle({ strokeWidth: v }))"
            />
          </label>
          <label class="prop-row">
            <span class="prop-label">线条透明度</span>
            <input
              type="number" min="0" max="1" step="0.1"
              data-testid="edge-opacity"
              title="线条透明度"
              :value="numberValue(edgeAgg.opacity)"
              :placeholder="edgeAgg.opacity.kind === 'mixed' ? '多个值' : ''"
              @change="numberCommit($event, (v) => writeEdgeStyle({ opacity: v }))"
            />
          </label>
          <label class="prop-row">
            <span class="prop-label">线型</span>
            <select
              data-testid="edge-dash"
              title="线型"
              :value="edgeDashValue"
              @change="writeEdgeStyle({ dash: selectOf($event) as EdgeStyle['dash'] })"
            >
              <option v-if="edgeAgg.dash.kind === 'mixed'" value="__mixed__" disabled>多个值</option>
              <option value="solid">实线</option>
              <option value="dash">虚线</option>
              <option value="dot">点线</option>
              <option value="dashdot">点划线</option>
            </select>
          </label>
          <label class="prop-row">
            <span class="prop-label">起始箭头</span>
            <select
              data-testid="edge-source-arrow"
              title="起始箭头"
              :value="arrowValue(edgeAgg.sourceArrow)"
              @change="writeEdgeStyle({ sourceArrow: selectOf($event) as EdgeStyle['sourceArrow'] })"
            >
              <option v-if="edgeAgg.sourceArrow.kind === 'mixed'" value="__mixed__" disabled>多个值</option>
              <option value="none">无</option>
              <option value="arrow">箭头</option>
            </select>
          </label>
          <label class="prop-row">
            <span class="prop-label">结束箭头</span>
            <select
              data-testid="edge-target-arrow"
              title="结束箭头"
              :value="arrowValue(edgeAgg.targetArrow)"
              @change="writeEdgeStyle({ targetArrow: selectOf($event) as EdgeStyle['targetArrow'] })"
            >
              <option v-if="edgeAgg.targetArrow.kind === 'mixed'" value="__mixed__" disabled>多个值</option>
              <option value="none">无</option>
              <option value="arrow">箭头</option>
            </select>
          </label>
          <label class="prop-row">
            <span class="prop-label">连接类型</span>
            <select
              data-testid="edge-connector"
              title="连接类型"
              :value="connectorValue"
              @change="writeConnector(selectOf($event) as ConnectorKind)"
            >
              <option v-if="connectorAgg.kind === 'mixed'" value="__mixed__" disabled>多个值</option>
              <option value="straight">直线</option>
              <option value="orthogonal">直角</option>
              <option value="curved">曲线</option>
            </select>
          </label>
          <label v-if="singleEdge" class="prop-row">
            <span class="prop-label">标签文本</span>
            <input
              type="text"
              data-testid="edge-label-text"
              title="标签文本（失焦提交）"
              :value="singleEdge.labels[0]?.text.value ?? ''"
              @blur="commitEdgeLabel"
            />
          </label>
          <label v-if="singleEdge" class="prop-row">
            <span class="prop-label">链接</span>
            <input
              type="text"
              data-testid="edge-link"
              title="链接（http/https/mailto，失焦提交；留空清除）"
              placeholder="https://"
              :value="singleEdge.link ?? ''"
              @blur="commitLink('edge', $event)"
            />
          </label>
          <p v-if="singleEdge && linkError" class="link-error" data-testid="link-error">{{ linkError }}</p>
        </div>
      </section>
    </template>
  </div>
</template>

<script setup lang="ts">
// 属性标签页：按选择显示节点信息/几何/样式/文本/边属性五个手风琴区（PRD §5.9）。
// 全部写入经 document-store 命令：几何（移动/缩放/旋转）、样式（应用样式）、
// 文本样式（文本样式）、文本值与名称（编辑文本）、连线类型（连线类型）。
// 多选聚合：一致显示值、不一致显示「多个值」（颜色混合标记、布尔按钮不定态）、无文本禁用；
// 任何控件写入 = 全部选中目标一条命令（before 逐目标从文档实读）。
// 颜色控件用 @change（取色器关闭/确认时一次提交一条记录；拖动过程的 input 事件不入栈）。
import { computed, nextTick, reactive, ref, watch } from 'vue'
import QuickHelpButton from '@/ui/help/QuickHelpButton.vue'
import {
  type ConnectorKind,
  type DiagramNode,
  type EdgeStyle,
  type NodeStyle,
  type TextBlock,
  type TextParagraph,
  type TextStyle,
} from '@/domain/diagram'
import { formatMeasure, unitToPt } from '@/domain/measurement'
import { ApplyStyleCommand, type StyleTarget } from '@/application/commands/apply-style'
import { EditTextCommand } from '@/application/commands/edit-text'
import { MoveCellsCommand } from '@/application/commands/move-cells'
import { ResizeCellsCommand } from '@/application/commands/resize-cells'
import { RotateCellsCommand } from '@/application/commands/rotate-cells'
import { SetLinkCommand } from '@/application/commands/set-link'
import { SetBusinessDataCommand } from '@/application/commands/set-business-data'
import { validateHyperlink } from '@/application/links/hyperlink-validator'
import {
  TextStyleCommand,
  type TextStylePatch,
} from '@/application/commands/text-style-command'
import { UpdateEdgeConnectorCommand } from '@/application/commands/update-edge-connector'
import {
  aggregateField,
  aggregateNodeStyles,
  aggregateTextStyles,
  type Aggregate,
} from '@/application/inspector/aggregate-style'
import {
  alignPressed,
  boolPressed,
  colorValue,
  numberValue,
  toggledStyleBool,
} from '@/application/inspector/aggregate-display'
import { fontFamilies, fontSizes } from '@/application/inspector/font-presets'
import {
  hasBusinessDataChanged,
  parseBusinessDataJson,
} from '@/application/inspector/business-data-json'
import {
  buildTextStyleTargets,
  pickPatch,
  textContentsForSelection,
} from '@/application/inspector/text-style-targets'
import { shapeRegistry } from '@/application/shapes/shape-registry'
import '@/application/shapes/common-shapes' // 模块副作用：注册内置形状
import { useDocumentStore } from '@/stores/document-store'
import { useSelectionStore } from '@/stores/selection-store'

const documentStore = useDocumentStore()
const selectionStore = useSelectionStore()
const propertyRoot = ref<HTMLElement | null>(null)

const expanded = reactive({
  info: true,
  geometry: true,
  businessData: true,
  style: true,
  text: true,
  edge: true,
})

async function focusSection(section: 'link' | 'text' | 'line'): Promise<void> {
  if (section === 'text') expanded.text = true
  else if (section === 'line') expanded.edge = true
  else if (selectedEdges.value.length > 0) expanded.edge = true
  else expanded.info = true
  await nextTick()
  const selector = section === 'text'
    ? '[data-testid="font-family"]'
    : section === 'line'
      ? '[data-testid="edge-stroke"]'
      : '[data-testid="node-link"], [data-testid="edge-link"]'
  propertyRoot.value?.querySelector<HTMLElement>(selector)?.focus()
}
defineExpose({ focusSection })

const page = computed(() => documentStore.activePage)
const pageUnit = computed(() => page.value?.unit ?? 'mm')
const selectedNodes = computed(
  () => page.value?.nodes.filter((node) => selectionStore.selectedIds.includes(node.id)) ?? [],
)
const selectedEdges = computed(
  () => page.value?.edges.filter((edge) => selectionStore.selectedIds.includes(edge.id)) ?? [],
)
const noSelection = computed(
  () => selectedNodes.value.length === 0 && selectedEdges.value.length === 0,
)
const singleNode = computed(() =>
  selectedNodes.value.length === 1 && selectedEdges.value.length === 0
    ? selectedNodes.value[0]
    : undefined,
)
const singleEdge = computed(() =>
  selectedEdges.value.length === 1 && selectedNodes.value.length === 0
    ? selectedEdges.value[0]
    : undefined,
)

const businessDataDraft = ref('')
const businessDataError = ref<string | null>(null)

function formattedBusinessData(data: Record<string, unknown> | undefined): string {
  return JSON.stringify(data ?? {}, null, 2)
}

function resetBusinessDataDraft(): void {
  businessDataDraft.value = formattedBusinessData(singleNode.value?.data)
  businessDataError.value = null
}

function applyBusinessData(): void {
  const node = singleNode.value
  const pageId = page.value?.id
  if (!node || !pageId) return
  const result = parseBusinessDataJson(businessDataDraft.value)
  if (!result.ok) {
    businessDataError.value = result.error
    return
  }
  businessDataError.value = null
  const formatted = formattedBusinessData(result.data)
  if (!hasBusinessDataChanged(node.data, result.data)) {
    businessDataDraft.value = formatted
    return
  }
  documentStore.executeCommand(
    new SetBusinessDataCommand({
      pageId,
      nodeId: node.id,
      before: node.data,
      after: result.data,
    }),
  )
  businessDataDraft.value = formatted
}

watch(singleNode, resetBusinessDataDraft, { immediate: true })

// ---------- 聚合 ----------

/** 文本聚合对象：选中节点文本 + 选中边首标签文本（经共享模块，与工具栏一致）。 */
const textAgg = computed(() => {
  const current = page.value
  if (!current) return aggregateTextStyles([])
  return aggregateTextStyles(textContentsForSelection(current, selectionStore.selectedIds))
})
const nodeAgg = computed(() => aggregateNodeStyles(selectedNodes.value))
const edgeAgg = computed(() => ({
  stroke: aggregateField(selectedEdges.value.map((e) => e.style.stroke)),
  strokeWidth: aggregateField(selectedEdges.value.map((e) => e.style.strokeWidth)),
  opacity: aggregateField(selectedEdges.value.map((e) => e.style.opacity)),
  dash: aggregateField(selectedEdges.value.map((e) => e.style.dash)),
  sourceArrow: aggregateField(selectedEdges.value.map((e) => e.style.sourceArrow)),
  targetArrow: aggregateField(selectedEdges.value.map((e) => e.style.targetArrow)),
}))
const connectorAgg = computed(() => aggregateField(selectedEdges.value.map((e) => e.connector)))

// ---------- 显示辅助 ----------

function textValue(agg: Aggregate<unknown>): string | null {
  return agg.kind === 'value' && agg.value !== null ? String(agg.value) : null
}

function isTrue(agg: Aggregate<unknown>): boolean {
  return agg.kind === 'value' && agg.value === true
}

const dashValue = computed(() =>
  nodeAgg.value.strokeDash.kind === 'mixed'
    ? '__mixed__'
    : (textValue(nodeAgg.value.strokeDash) ?? 'solid'),
)
const edgeDashValue = computed(() =>
  edgeAgg.value.dash.kind === 'mixed' ? '__mixed__' : (textValue(edgeAgg.value.dash) ?? 'solid'),
)
function arrowValue(agg: Aggregate<unknown>): string {
  return agg.kind === 'mixed' ? '__mixed__' : (textValue(agg) ?? 'none')
}
const connectorValue = computed(() =>
  connectorAgg.value.kind === 'mixed'
    ? '__mixed__'
    : (textValue(connectorAgg.value) ?? 'orthogonal'),
)

function colorOf(event: Event): string {
  return (event.target as HTMLInputElement).value
}

/** 聚合阴影字段值：mixed/无阴影 → null（输入框留空）。 */
function shadowField(field: keyof NonNullable<NodeStyle['shadow']>): string | number | null {
  const agg = nodeAgg.value.shadow
  if (agg.kind !== 'value' || agg.value === null) return null
  return (agg.value as NonNullable<NodeStyle['shadow']>)[field]
}

function selectOf(event: Event): string {
  return (event.target as HTMLSelectElement).value
}

function numberCommit(event: Event, write: (value: number) => void): void {
  const value = Number((event.target as HTMLInputElement).value)
  if (!Number.isFinite(value)) return
  write(value)
}

// ---------- 静态选项 ----------

const styleButtons: { key: 'bold' | 'italic' | 'underline' | 'strikethrough'; label: string; title: string }[] = [
  { key: 'bold', label: 'B', title: '加粗' },
  { key: 'italic', label: 'I', title: '斜体' },
  { key: 'underline', label: 'U', title: '下划线' },
  { key: 'strikethrough', label: 'S', title: '删除线' },
]

const horizontalOptions: { value: TextBlock['horizontalAlign']; label: string; title: string }[] = [
  { value: 'left', label: '左', title: '左对齐' },
  { value: 'center', label: '中', title: '居中对齐' },
  { value: 'right', label: '右', title: '右对齐' },
]
const verticalOptions: { value: TextBlock['verticalAlign']; label: string; title: string }[] = [
  { value: 'top', label: '上', title: '顶端对齐' },
  { value: 'middle', label: '中', title: '垂直居中' },
  { value: 'bottom', label: '下', title: '底端对齐' },
]
const directionOptions: { value: TextBlock['direction']; label: string; title: string }[] = [
  { value: 'horizontal', label: '横排', title: '横排文本' },
  { value: 'vertical', label: '竖排', title: '竖排文本（逐字排版）' },
]

const marginFields: { key: 'marginTop' | 'marginRight' | 'marginBottom' | 'marginLeft'; label: string }[] = [
  { key: 'marginTop', label: '上边距' },
  { key: 'marginRight', label: '右边距' },
  { key: 'marginBottom', label: '下边距' },
  { key: 'marginLeft', label: '左边距' },
]
const paragraphFields: { key: keyof TextParagraph; label: string }[] = [
  { key: 'before', label: '段前' },
  { key: 'after', label: '段后' },
  { key: 'lineHeight', label: '行距' },
]

const geometryFields: { key: 'x' | 'y' | 'width' | 'height' | 'angle'; label: string; angle?: boolean }[] = [
  { key: 'x', label: 'X' },
  { key: 'y', label: 'Y' },
  { key: 'width', label: '宽' },
  { key: 'height', label: '高' },
  { key: 'angle', label: '角度', angle: true },
]

// ---------- 节点信息/几何 ----------

function shapeLabelOf(node: DiagramNode): string {
  return shapeRegistry.get(node.shape).label
}

function geometryDisplay(field: 'x' | 'y' | 'width' | 'height' | 'angle'): string {
  const node = singleNode.value
  if (!node) return ''
  if (field === 'angle') {
    return String(Math.round(node.angle * 10) / 10)
  }
  return formatMeasure(node[field], pageUnit.value)
}

function commitGeometry(field: 'x' | 'y' | 'width' | 'height' | 'angle', event: Event): void {
  const node = singleNode.value
  const pageId = page.value?.id
  if (!node || !pageId) return
  const raw = Number((event.target as HTMLInputElement).value)
  if (!Number.isFinite(raw)) return
  if (field === 'angle') {
    if (raw === node.angle) return
    documentStore.executeCommand(
      new RotateCellsCommand([{ pageId, nodeId: node.id, before: node.angle, after: raw }]),
    )
    return
  }
  const pt = unitToPt(raw, pageUnit.value)
  if (field === 'x' || field === 'y') {
    if (pt === node[field]) return
    documentStore.executeCommand(
      new MoveCellsCommand([
        {
          pageId,
          nodeId: node.id,
          before: { x: node.x, y: node.y },
          after: { x: field === 'x' ? pt : node.x, y: field === 'y' ? pt : node.y },
        },
      ]),
    )
    return
  }
  // 宽/高：按形状 minSize 钳制
  const min = shapeRegistry.get(node.shape).minSize
  const clamped = Math.max(pt, field === 'width' ? min.width : min.height)
  if (clamped === node[field]) return
  documentStore.executeCommand(
    new ResizeCellsCommand([
      {
        pageId,
        nodeId: node.id,
        before: { x: node.x, y: node.y, width: node.width, height: node.height },
        after: {
          x: node.x,
          y: node.y,
          width: field === 'width' ? clamped : node.width,
          height: field === 'height' ? clamped : node.height,
        },
      },
    ]),
  )
}

/** 名称/内容失焦提交：有变更才产生 EditTextCommand。 */
function commitNodeName(event: Event): void {
  const node = singleNode.value
  const pageId = page.value?.id
  if (!node || !pageId) return
  const value = (event.target as HTMLInputElement | HTMLTextAreaElement).value
  const before = node.text?.value ?? ''
  if (value === before) return
  documentStore.executeCommand(
    new EditTextCommand({
      pageId,
      target: { kind: 'node', nodeId: node.id },
      before,
      after: value,
    }),
  )
}

// ---------- 样式写入（节点/边） ----------

function writeNodeStyle(patch: Partial<NodeStyle>): void {
  const pageId = page.value?.id
  if (!pageId || selectedNodes.value.length === 0) return
  const targets: StyleTarget[] = selectedNodes.value.map((node) => ({
    kind: 'node',
    pageId,
    cellId: node.id,
    before: pickPatch(node.style, patch),
    after: patch,
  }))
  documentStore.executeCommand(new ApplyStyleCommand(targets))
}

function writeEdgeStyle(patch: Partial<EdgeStyle>): void {
  const pageId = page.value?.id
  if (!pageId || selectedEdges.value.length === 0) return
  const targets: StyleTarget[] = selectedEdges.value.map((edge) => ({
    kind: 'edge',
    pageId,
    cellId: edge.id,
    before: pickPatch(edge.style, patch),
    after: patch,
  }))
  documentStore.executeCommand(new ApplyStyleCommand(targets))
}

const DEFAULT_SHADOW = { color: '#000000', opacity: 0.3, offsetX: 2, offsetY: 2, blur: 4 }

/** 阴影写入：无阴影节点先以默认值补齐再覆盖单字段（before 为原 shadow 或 undefined）。 */
function writeShadow(patch: Partial<NonNullable<NodeStyle['shadow']>>): void {
  const pageId = page.value?.id
  if (!pageId || selectedNodes.value.length === 0) return
  const targets: StyleTarget[] = selectedNodes.value.map((node) => ({
    kind: 'node',
    pageId,
    cellId: node.id,
    before: { shadow: node.style.shadow ? { ...node.style.shadow } : undefined },
    after: { shadow: { ...DEFAULT_SHADOW, ...node.style.shadow, ...patch } },
  }))
  documentStore.executeCommand(new ApplyStyleCommand(targets))
}

// ---------- 文本样式写入 ----------

/** 文本样式写入：全部选中节点 + 选中边首标签，一次控件变更一条记录。 */
function writeTextPatch(patch: TextStylePatch): void {
  const current = page.value
  if (!current) return
  const targets = buildTextStyleTargets(current, selectionStore.selectedIds, patch)
  if (targets.length === 0) return
  documentStore.executeCommand(new TextStyleCommand({ pageId: current.id, targets }))
}

/** 字形布尔切换：下一值经共享纯函数（mixed 或不全 true → true；全 true → false）。 */
function toggleStyleBool(key: 'bold' | 'italic' | 'underline' | 'strikethrough'): void {
  const next = toggledStyleBool(textAgg.value.style[key])
  writeTextPatch({ style: { [key]: next } as Partial<TextStyle> })
}

// ---------- 边属性写入 ----------

function writeConnector(connector: ConnectorKind): void {
  const pageId = page.value?.id
  if (!pageId || selectedEdges.value.length === 0) return
  if (selectedEdges.value.every((edge) => edge.connector === connector)) return
  documentStore.executeCommand(
    new UpdateEdgeConnectorCommand({
      pageId,
      edgeIds: selectedEdges.value.map((edge) => edge.id),
      before: selectedEdges.value.map((edge) => edge.connector),
      after: connector,
    }),
  )
}

function commitEdgeLabel(event: Event): void {
  const edge = singleEdge.value
  const pageId = page.value?.id
  if (!edge || !pageId) return
  const value = (event.target as HTMLInputElement).value
  const before = edge.labels[0]?.text.value ?? ''
  if (value === before) return
  documentStore.executeCommand(
    new EditTextCommand({
      pageId,
      target: { kind: 'edgeLabel', edgeId: edge.id, labelIndex: 0 },
      before,
      after: value,
    }),
  )
}

// ---------- 链接 ----------

/** 链接校验错误（null=无错误）；切换选择时清零。 */
const linkError = ref<string | null>(null)

watch(
  () => selectionStore.selectedIds,
  () => {
    linkError.value = null
  },
)

/** 链接失焦提交：非法协议显示中文错误（不执行命令）；空串 = 清除。 */
function commitLink(kind: 'node' | 'edge', event: Event): void {
  const pageId = page.value?.id
  const cell = kind === 'node' ? singleNode.value : singleEdge.value
  if (!cell || !pageId) return
  const value = (event.target as HTMLInputElement).value
  const before = cell.link ?? ''
  if (value === before) {
    linkError.value = null
    return
  }
  const error = validateHyperlink(value)
  if (error) {
    linkError.value = error
    return
  }
  linkError.value = null
  documentStore.executeCommand(
    new SetLinkCommand({
      pageId,
      target: { kind, cellId: cell.id },
      before: cell.link,
      after: value === '' ? undefined : value,
    }),
  )
}
</script>

<style scoped>
.property-help-links { display: flex; justify-content: flex-end; gap: 4px; padding: 5px 12px 0; }
.property-tab {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
  font-size: 12px;
  color: var(--color-text);
  overflow-y: auto;
}

.no-selection {
  margin: 24px 0;
  text-align: center;
  color: var(--color-text-secondary);
}

.prop-section {
  border: 1px solid var(--color-border);
  border-radius: 4px;
  overflow: hidden;
}

.section-header {
  width: 100%;
  border: none;
  background: var(--color-bg);
  padding: 6px 10px;
  font-size: 12px;
  font-weight: 600;
  text-align: left;
  cursor: pointer;
  color: var(--color-text);
}

.section-body {
  padding: 4px 10px 10px;
}

.prop-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
}

.prop-row-top {
  align-items: flex-start;
}

.prop-label {
  width: 64px;
  flex-shrink: 0;
  color: var(--color-text-secondary);
}

.prop-readonly {
  color: var(--color-text);
}

.prop-id {
  font-size: 11px;
  color: var(--color-text-secondary);
  word-break: break-all;
}

.prop-row input[type='text'],
.prop-row input[type='number'],
.prop-row select,
.prop-row textarea {
  flex: 1;
  min-width: 0;
  font-size: 12px;
  padding: 3px 6px;
  border: 1px solid var(--color-border);
  border-radius: 3px;
  background: var(--color-panel);
  color: var(--color-text);
}

.business-data-json {
  box-sizing: border-box;
  width: 100%;
  resize: vertical;
  padding: 6px;
  border: 1px solid var(--color-border);
  border-radius: 3px;
  background: var(--color-panel);
  color: var(--color-text);
  font: 12px/1.5 ui-monospace, SFMono-Regular, Consolas, monospace;
}

.business-data-actions {
  display: flex;
  gap: 6px;
  margin-top: 8px;
}

.business-data-actions button {
  padding: 3px 10px;
  border: 1px solid var(--color-border);
  border-radius: 3px;
  background: var(--color-panel);
  color: var(--color-text);
  cursor: pointer;
}

.business-data-actions button:disabled,
.business-data-json:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.business-data-error,
.disabled-explanation {
  margin: 6px 0 0;
  font-size: 11px;
}

.business-data-error {
  color: #d4380d;
}

.disabled-explanation {
  color: var(--color-text-secondary);
}

.prop-row textarea {
  resize: vertical;
}

.prop-row input[type='color'] {
  width: 36px;
  height: 24px;
  padding: 0;
  border: 1px solid var(--color-border);
  border-radius: 3px;
  background: none;
}

.mixed-mark {
  font-size: 11px;
  color: var(--color-text-secondary);
  border: 1px dashed var(--color-border);
  border-radius: 3px;
  padding: 1px 4px;
}

.link-error {
  margin: 6px 0 0 72px;
  font-size: 11px;
  color: #d4380d;
}

.button-group {
  display: flex;
  gap: 4px;
}

.button-group button {
  min-width: 26px;
  font-size: 12px;
  padding: 3px 8px;
  border: 1px solid var(--color-border);
  border-radius: 3px;
  background: var(--color-panel);
  color: var(--color-text-secondary);
  cursor: pointer;
}

.button-group button.active {
  border-color: var(--color-primary);
  color: var(--color-primary);
  background: rgba(47, 111, 237, 0.08);
}

.button-group button.indeterminate {
  border-style: dashed;
  color: var(--color-text);
}

.button-group button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
