import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const profile = readFileSync(new URL('../ProfileView.tsx', import.meta.url), 'utf8')
const css = readFileSync(new URL('../profile-form-aurora-v71.css', import.meta.url), 'utf8')
const viewportCss = readFileSync(new URL('../viewport-background-v60.css', import.meta.url), 'utf8')

const sectionClasses = profile.match(/<section className="([^"]+)"/)?.[1]?.split(/\s+/) ?? []
const profileBlock = css.match(/\.profile-editor-surface,\s*[\s\S]*?\{([\s\S]*?)\}/)?.[1] ?? ''

test('birth profile is detached from the shared form-card surface in markup', () => {
  assert.ok(sectionClasses.includes('profile-editor-surface'))
  assert.ok(sectionClasses.includes('profile-form-card'))
  assert.ok(!sectionClasses.includes('form-card'))
})

test('dedicated profile editor wrapper owns only transparent layout, not a composited card', () => {
  assert.ok(profileBlock, 'expected profile-editor-surface owner')
  assert.match(profileBlock, /background:\s*transparent\s*!important/)
  assert.match(profileBlock, /background-image:\s*none\s*!important/)
  assert.match(profileBlock, /background-color:\s*transparent\s*!important/)
  assert.match(profileBlock, /border:\s*0\s*!important/)
  assert.match(profileBlock, /box-shadow:\s*none\s*!important/)
  assert.match(profileBlock, /-webkit-backdrop-filter:\s*none\s*!important/)
  assert.match(profileBlock, /backdrop-filter:\s*none\s*!important/)
  assert.match(profileBlock, /contain:\s*none\s*!important/)
  assert.doesNotMatch(css, /\.form-card\.profile-form-card/)
})

test('birth inputs stay opaque white independently of the transparent wrapper', () => {
  assert.match(viewportCss, /\.app-shell \.field input,[\s\S]*\.app-shell \.stable-choice-trigger[\s\S]*background:\s*#fff\s*!important/)
})
