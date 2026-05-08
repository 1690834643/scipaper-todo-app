import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const buttonsCss = readFileSync('src/styles/buttons-forms.css', 'utf8')
const homeCss = readFileSync('src/styles/home.css', 'utf8')
const navCss = readFileSync('src/styles/nav.css', 'utf8')
const aiDrawerCss = readFileSync('src/styles/ai-drawer.css', 'utf8')
const sidebarSource = readFileSync('src/components/AppSidebar.tsx', 'utf8')
const aiSource = readFileSync('src/components/AIAssistantPanel.tsx', 'utf8')

describe('global design alignment contract', () => {
  it('aliases legacy button classes to the design-pack btn system', () => {
    expect(buttonsCss).toContain('.btn,')
    expect(buttonsCss).toContain('.primary-button,')
    expect(buttonsCss).toContain('.ghost-button')
    expect(buttonsCss).toContain('.btn.primary,')
    expect(buttonsCss).toContain('.btn.ghost,')
    expect(buttonsCss).toContain('.btn.subtle')
    expect(buttonsCss).toContain('.btn.icon-only')
  })

  it('keeps the app sidebar compact mode icon-only and design-token sized', () => {
    expect(homeCss).toContain('--sidebar-collapsed-width')
    expect(homeCss).toContain('.home-sidebar.is-collapsed .home-nav-label')
    expect(homeCss).toContain('.home-sidebar.is-collapsed .home-nav-aside')
    expect(navCss).toContain('--section-nav-collapsed-width')
    expect(navCss).toContain('width: var(--section-nav-collapsed-width)')
    expect(sidebarSource).toContain("className='btn ghost icon-only home-sidebar-collapse'")
    expect(sidebarSource).toContain("className='btn ghost sm full-width'")
  })

  it('aligns the AI drawer context controls with the design pack', () => {
    expect(aiSource).toContain('provider-row')
    expect(aiSource).toContain('tools-toggle')
    expect(aiSource).toContain('article-row')
    expect(aiSource).toContain('scope-row')
    expect(aiSource).toContain('tools-toggle-dot')
    expect(aiDrawerCss).toContain('.provider-row')
    expect(aiDrawerCss).toContain('.tools-toggle')
    expect(aiDrawerCss).toContain('.article-row')
    expect(aiDrawerCss).toContain('.scope-row')
    expect(aiDrawerCss).toContain('.seg-btn')
  })

  it('persists AI drawer resize only at the end of a drag', () => {
    expect(aiSource).toContain('persistWidth')
    expect(aiSource).toContain('persistWidth(widthRef.current)')
    expect(aiSource).not.toContain(`useEffect(() => {
    if (typeof window === 'undefined') return
    try { window.localStorage.setItem(WIDTH_KEY, String(width)) }`)
  })
})
