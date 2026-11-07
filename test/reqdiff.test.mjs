import assert from 'node:assert/strict'
import test from 'node:test'
import { normalizeBlueprint, semanticDiff, wordDiff } from '../lib/blueprint.js'

test('stable requirement uid turns a text edit into one modified row', () => {
  const before = normalizeBlueprint({
    title: 'Stable IDs',
    sections: [{
      key: 'goals',
      title: 'Goals',
      items: [
        { id: 'i1', text: 'one', code: 'R1' },
        { id: 'i2', text: 'two', code: 'R2' },
      ],
    }],
  }, undefined, { sessionId: 's' })
  const after = normalizeBlueprint({
    sections: [{
      key: 'goals',
      title: 'Goals',
      items: [
        { id: 'i1', text: 'one', code: 'R1' },
        { id: 'i2', text: 'two updated', code: 'R2' },
      ],
    }],
  }, before, { sessionId: 's' })

  const diff = semanticDiff(before, after)
  const goals = diff.sections[0]
  assert.deepEqual(goals.added, [])
  assert.deepEqual(goals.removed, [])
  assert.equal(goals.modified.length, 1)
  assert.deepEqual(
    { uid: goals.modified[0].uid, id: goals.modified[0].id, code: goals.modified[0].code },
    { uid: 'goals:i2', id: 'i2', code: 'R2' },
  )
  assert.equal(goals.modified[0].before, 'two')
  assert.equal(goals.modified[0].after, 'two updated')
  assert.equal(diff.totals.modified, 1)
  assert.equal(diff.totals.added, 0)
  assert.equal(diff.totals.removed, 0)
})

test('falls back to sectionKey:id when a raw requirement has no uid', () => {
  const before = {
    sections: [{ key: 'goals', title: 'Goals', items: [{ id: 'x', text: 'hello world' }] }],
  }
  const after = {
    sections: [{ key: 'goals', title: 'Goals', items: [{ id: 'x', text: 'hello brave world' }] }],
  }

  const diff = semanticDiff(before, after)
  assert.equal(diff.sections[0].added.length, 0)
  assert.equal(diff.sections[0].removed.length, 0)
  assert.equal(diff.sections[0].modified[0].uid, 'goals:x')
  assert.deepEqual(wordDiff('hello world', 'hello brave world'), [
    { type: 'same', text: 'hello ' },
    { type: 'add', text: 'brave ' },
    { type: 'same', text: 'world' },
  ])
})

test('added and removed requirement rows keep id, uid and code', () => {
  const before = normalizeBlueprint({
    title: 'Rows',
    sections: [{
      key: 'functional',
      title: 'Functional',
      items: [
        { id: 'i1', text: 'keep', code: 'R1' },
        { id: 'i2', text: 'drop', code: 'R2' },
      ],
    }],
  }, undefined, { sessionId: 's' })
  const after = normalizeBlueprint({
    sections: [{
      key: 'functional',
      title: 'Functional',
      items: [
        { id: 'i1', text: 'keep', code: 'R1' },
        { id: 'i3', text: 'new item', code: 'R3' },
      ],
    }],
  }, before, { sessionId: 's' })

  const diff = semanticDiff(before, after)
  const section = diff.sections[0]
  assert.deepEqual(section.modified, [])
  assert.deepEqual(section.added, [{ id: 'i3', uid: 'functional:i3', code: 'R3', text: 'new item' }])
  assert.deepEqual(section.removed, [{ id: 'i2', uid: 'functional:i2', code: 'R2', text: 'drop' }])
  assert.deepEqual(
    { added: diff.totals.added, removed: diff.totals.removed, modified: diff.totals.modified },
    { added: 1, removed: 1, modified: 0 },
  )
})

test('word diff splits English by words and Chinese by character and punctuation', () => {
  assert.deepEqual(wordDiff('支持用户登录。', '支持用户扫码登录。'), [
    { type: 'same', text: '支持用户' },
    { type: 'add', text: '扫码' },
    { type: 'same', text: '登录。' },
  ])
  assert.deepEqual(wordDiff('Build the API, now.', 'Build the REST API, now.'), [
    { type: 'same', text: 'Build the ' },
    { type: 'add', text: 'REST ' },
    { type: 'same', text: 'API, now.' },
  ])
  assert.deepEqual(wordDiff('删除旧入口', '删除入口'), [
    { type: 'same', text: '删除' },
    { type: 'remove', text: '旧' },
    { type: 'same', text: '入口' },
  ])
})

test('modified-only requirement changes are not reported as added plus removed', () => {
  const before = normalizeBlueprint({
    title: 'Totals',
    sections: [{ key: 'risks', title: 'Risks', items: [{ id: 'r1', text: 'latency', code: 'R1' }] }],
  }, undefined, { sessionId: 's' })
  const after = normalizeBlueprint({
    sections: [{ key: 'risks', title: 'Risks', items: [{ id: 'r1', text: 'high latency', code: 'R1' }] }],
  }, before, { sessionId: 's' })

  const diff = semanticDiff(before, after)
  assert.equal(diff.sections.length, 1)
  assert.equal(diff.sections[0].added.length, 0)
  assert.equal(diff.sections[0].removed.length, 0)
  assert.equal(diff.sections[0].modified.length, 1)
  assert.equal(diff.totals.modified, 1)
  assert.equal(diff.totals.added, 0)
  assert.equal(diff.totals.removed, 0)
  assert.equal(diff.totals.changed, 0)
})
