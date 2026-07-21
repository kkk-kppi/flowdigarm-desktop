export type TextTarget =
  | { kind: 'node'; nodeId: string }
  | { kind: 'edgeLabel'; edgeId: string; labelIndex: number }
