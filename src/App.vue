<template>
  <AppShell>
    <CanvasArea :page="demoPage" />
  </AppShell>
</template>

<script setup lang="ts">
// 应用外壳：AppShell 包裹画布区。
// TODO(后续任务): demoPage 为临时可视化冒烟数据（A4、两个矩形一条边），将由文档 store 替换。
import AppShell from '@/ui/shell/AppShell.vue'
import CanvasArea from '@/ui/canvas/CanvasArea.vue'
import {
  createDefaultEdgeStyle,
  createDefaultNodeStyle,
  createDefaultTextContent,
  createEmptyPage,
  type DiagramPage,
} from '@/domain/diagram'

const demoPage: DiagramPage = createEmptyPage({
  name: '演示页',
  nodes: [
    {
      id: 'demo-node-1',
      shape: 'rect',
      x: 72,
      y: 72,
      width: 120,
      height: 72,
      angle: 0,
      zIndex: 1,
      text: createDefaultTextContent('开始'),
      style: createDefaultNodeStyle(),
    },
    {
      id: 'demo-node-2',
      shape: 'rect',
      x: 288,
      y: 216,
      width: 120,
      height: 72,
      angle: 0,
      zIndex: 2,
      text: createDefaultTextContent('处理'),
      style: { ...createDefaultNodeStyle(), fill: '#E8F0FE', cornerRadius: 8 },
    },
  ],
  edges: [
    {
      id: 'demo-edge-1',
      source: { nodeId: 'demo-node-1' },
      target: { nodeId: 'demo-node-2' },
      connector: 'orthogonal',
      vertices: [],
      labels: [],
      style: createDefaultEdgeStyle(),
      zIndex: 3,
    },
  ],
})
</script>
