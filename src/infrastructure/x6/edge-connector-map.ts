// src/infrastructure/x6/edge-connector-map.ts
// 领域连接类型 → X6 连接器名称的纯函数映射。
// 跳线（jumpover）是 X6 内置连接器：仅视觉跨越，不改文档拓扑（边 data 不写任何跳线信息）。
import type { ConnectorKind } from '@/domain/diagram'

/**
 * X6 连接器名称：straight→normal、orthogonal→orth、curved→smooth；
 * 页面开启跳线且非曲线时改用 jumpover（曲线不跳线）。
 * 'orth' 由 graph-adapter 落为 X6 router（直角路径），其余落为 connector。
 */
export function x6ConnectorName(connector: ConnectorKind, showLineJumps: boolean): string {
  if (connector === 'curved') {
    return 'smooth'
  }
  if (showLineJumps) {
    return 'jumpover'
  }
  return connector === 'orthogonal' ? 'orth' : 'normal'
}
