import { MAX_PT } from '@/domain/limits'
import { geometryDisplayValue, parseGeometryInput } from '@/application/inspector/property-view-model'

it('formats geometry and clamps signed positions and nonnegative lengths to domain limits', () => {
  expect(geometryDisplayValue(28.3464567, 'mm')).toBe('10.0')
  expect(parseGeometryInput('400000', 'mm', 'position')).toBe(MAX_PT)
  expect(parseGeometryInput('-400000', 'mm', 'position')).toBe(-MAX_PT)
  expect(parseGeometryInput('-5', 'pt', 'length')).toBe(0)
  expect(parseGeometryInput('2000000', 'pt', 'length')).toBe(MAX_PT)
})
