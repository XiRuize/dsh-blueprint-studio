import assert from 'node:assert/strict'
import test from 'node:test'
import {
  CHECK_ISSUE_LIMIT,
  decodeSnapshotLabel,
  parseExportScope,
  truncateCheckIssues,
} from '../index.js'

test('parseExportScope defaults to the root layer A', () => {
  assert.deepEqual(parseExportScope(''), { ok: true, global: false, layerId: 'A' })
  assert.deepEqual(parseExportScope('   '), { ok: true, global: false, layerId: 'A' })
  assert.deepEqual(parseExportScope(undefined), { ok: true, global: false, layerId: 'A' })
})

test('parseExportScope accepts all and normalizes layer letters', () => {
  assert.deepEqual(parseExportScope('all'), { ok: true, global: true, layerId: 'A' })
  assert.deepEqual(parseExportScope('ALL'), { ok: true, global: true, layerId: 'A' })
  assert.deepEqual(parseExportScope('a'), { ok: true, global: false, layerId: 'A' })
  assert.deepEqual(parseExportScope(' b '), { ok: true, global: false, layerId: 'B' })
  assert.deepEqual(parseExportScope('aa'), { ok: true, global: false, layerId: 'AA' })
})

test('parseExportScope rejects malformed scopes with a readable message', () => {
  for (const value of ['A1', '1', 'A B', 'all layers', 'A-B', '中文']) {
    const parsed = parseExportScope(value)
    assert.equal(parsed.ok, false)
    assert.match(parsed.message, /无效的导出范围/u)
    assert.match(parsed.message, /export md\|html/u)
  }
})

test('truncateCheckIssues caps the issue list at 200 and marks truncated', () => {
  assert.equal(CHECK_ISSUE_LIMIT, 200)
  const issues = Array.from({ length: 205 }, (_, index) => ({ code: `c${index}` }))
  const result = truncateCheckIssues(issues)
  assert.equal(result.truncated, true)
  assert.equal(result.issues.length, CHECK_ISSUE_LIMIT)
  assert.equal(result.issues[0].code, 'c0')
  assert.equal(result.issues[199].code, 'c199')
  assert.equal(result.issues.at(-1).code, 'c199')
})

test('truncateCheckIssues keeps a list at the limit intact', () => {
  const issues = Array.from({ length: CHECK_ISSUE_LIMIT }, (_, index) => ({ code: `c${index}` }))
  const result = truncateCheckIssues(issues)
  assert.equal(result.truncated, false)
  assert.equal(result.issues, issues)
})

test('truncateCheckIssues tolerates bad input and honors a custom limit', () => {
  assert.deepEqual(truncateCheckIssues(undefined), { issues: [], truncated: false })
  assert.deepEqual(truncateCheckIssues(null), { issues: [], truncated: false })
  assert.deepEqual(truncateCheckIssues('nope'), { issues: [], truncated: false })

  const limited = truncateCheckIssues([1, 2, 3], 2)
  assert.deepEqual(limited, { issues: [1, 2], truncated: true })
  assert.equal(truncateCheckIssues([1, 2, 3], -1).issues.length, 3)
})

 test('snapshot labels survive malformed percent encoding', () => {
  assert.equal(decodeSnapshotLabel('%E0%A4%A'), '%E0%A4%A')
  assert.equal(decodeSnapshotLabel('release%20one'), 'release one')
  assert.equal(decodeSnapshotLabel(''), '')
})
