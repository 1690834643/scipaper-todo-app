import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const focusModeSource = readFileSync('src/components/FocusModeEditor.tsx', 'utf8')
const appSource = readFileSync('src/App.tsx', 'utf8')
const focusModeCss = readFileSync('src/styles/focus-mode.css', 'utf8')
const autocompleteSource = readFileSync('src/components/AutocompleteList.tsx', 'utf8')
const autocompleteExtensionSource = readFileSync('src/utils/autocompleteExtension.ts', 'utf8')
const focusToolbarSource = readFileSync('src/components/FocusFormatToolbar.tsx', 'utf8')
const focusOutlineSource = readFileSync('src/components/FocusOutlineRail.tsx', 'utf8')

describe('focus writing page design contract', () => {
  it('exposes the design-pack AI entry from the writing overlay', () => {
    expect(focusModeSource).toContain('onOpenAi')
    expect(focusModeSource).toContain('aria-label="AI 助手"')
    expect(appSource).toContain('onOpenAi={() => setAiOpen(true)}')
  })

  it('keeps pomodoro controls inside the writing topbar without rerendering the editor each second', () => {
    expect(focusModeSource).toContain('FocusPomodoroControls')
    expect(focusModeSource).toContain('onAddPomodoro')
    expect(appSource).toContain('onAddPomodoro={handleAddPomodoro}')
    expect(focusModeSource).not.toContain("window.addEventListener('scipaper:pomodoro'")
  })

  it('opens the format toolbar by default instead of inheriting a hidden drawer from storage', () => {
    expect(focusModeSource).not.toContain('scipaper.focusToolbarCollapsed')
    expect(focusModeSource).toContain('useState<boolean>(false)')
  })

  it('matches the design drawer heading controls from H1 through H3', () => {
    expect(focusModeSource).toContain('heading: { levels: [1, 2, 3] }')
    expect(focusModeSource).toContain('link: false')
    expect(focusToolbarSource).toContain('label="H1"')
  })

  it('renders the toolbar shell even before TipTap finishes initializing', () => {
    expect(focusToolbarSource).not.toContain('if (!editor) return null')
    expect(focusToolbarSource).toContain('data-editor-ready="false"')
  })

  it('keeps annotation creation and review controls in the writing overlay', () => {
    expect(focusModeSource).toContain('onAddAnnotation')
    expect(focusModeSource).toContain('onUpdateAnnotation')
    expect(focusModeSource).toContain('onDeleteAnnotation')
    expect(focusModeSource).toContain('让 AI 批注')
  })

  it('keeps the design single-scroll writing canvas instead of a two-column rail stage', () => {
    expect(focusModeSource).toContain('className="focus-mode-stage"')
    expect(focusModeSource).not.toContain('focus-mode-stage is-rail-open')
    expect(focusModeSource).toContain('focus-mode-annotation-dock')
    expect(focusModeCss).toContain('.focus-mode-stage {')
    expect(focusModeCss).toContain('min-height: 0;')
    expect(focusModeCss).toContain('.focus-mode-annotation-dock')
  })

  it('pins the writing overlay above the dashboard and hides the underlying app shell', () => {
    expect(focusModeCss).toContain('.focus-mode-overlay[data-focus-mode]')
    expect(focusModeCss).toContain('position: fixed !important;')
    expect(focusModeCss).toContain('z-index: 1000;')
    expect(focusModeCss).toContain('body.focus-mode-active .app-shell')
    expect(focusModeCss).toContain('visibility: hidden;')
    expect(focusModeCss).toContain('overscroll-behavior: contain;')
  })

  it('keeps autocomplete visible when the cursor is near the viewport bottom', () => {
    expect(autocompleteSource).toContain('computeAutocompletePosition')
    expect(autocompleteSource).toContain('window.innerHeight')
    expect(autocompleteSource).toContain('placement')
  })

  it('does not use unsupported modal prompt APIs from toolbar actions', () => {
    expect(focusToolbarSource).not.toContain('window.prompt')
    expect(focusToolbarSource).toContain('insertLinkPlaceholder')
  })

  it('avoids expensive editor scans and redundant selection rerenders', () => {
    expect(focusModeSource).toContain('updateEditorStats')
    expect(focusModeSource).not.toContain('const wordCount = editor')
    expect(focusModeSource).not.toContain('setSelection({ text, empty })')
    expect(focusModeSource).toContain('prev.empty === empty && prev.text === text ? prev')
  })

  it('disables expensive visual effects while the writing overlay is active', () => {
    expect(focusModeCss).toContain('body.focus-mode-active .workspace::before')
    expect(focusModeCss).toContain('background-image: none;')
    expect(focusModeCss).toContain('.focus-mode-overlay[data-focus-mode] .focus-mode-header')
    expect(focusModeCss).toContain('backdrop-filter: none;')
  })

  it('throttles scroll and outline recomputation work in long writing sessions', () => {
    expect(focusModeSource).toContain('scrollFrameRef')
    expect(focusModeSource).toContain('scrolledRef.current')
    expect(focusOutlineSource).toContain('requestAnimationFrame')
    expect(focusOutlineSource).toContain('sameOutlineEntries')
    expect(focusOutlineSource).toContain('activeIndexRef.current')
  })

  it('does not reapply annotation highlights when annotation content is unchanged', () => {
    expect(focusModeSource).toContain('annotationSignature')
    expect(focusModeSource).toContain('[editor, annotationSignature]')
    expect(focusModeSource).toContain('openAnnotationCount')
    expect(focusModeSource).not.toContain('annotations.filter((a) => a.status ===')
  })

  it('pre-indexes autocomplete dictionaries outside the keystroke hot path', () => {
    expect(autocompleteExtensionSource).toContain('buildAutocompleteIndex')
    expect(autocompleteExtensionSource).toContain('autocompleteIndex')
    expect(autocompleteExtensionSource).toContain('triggerLower')
    expect(autocompleteExtensionSource).toContain('word.lower.startsWith(query)')
    expect(autocompleteExtensionSource).not.toContain('phrase.trigger.toLowerCase().startsWith(query)')
    expect(autocompleteExtensionSource).not.toContain('const lower = word.toLowerCase()')
  })

  it('keeps focus overlay props stable across unrelated App rerenders', () => {
    expect(focusModeSource).toContain('memo(function FocusModeEditor')
    expect(appSource).toContain('useCallback')
    expect(appSource).toContain('handleOpenFocusAi')
    expect(appSource).toContain('handleExitFocusMode')
    expect(appSource).toContain('handleRecordFocusVersion')
    expect(appSource).toContain('onOpenAi={handleOpenFocusAi}')
    expect(appSource).toContain('onExit={handleExitFocusMode}')
    expect(appSource).toContain('onRecordVersion={handleRecordFocusVersion}')
  })
})
