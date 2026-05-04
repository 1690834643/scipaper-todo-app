import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

export interface ApprovalRequest {
  callId: string
  toolName: string
  summary: string
  args: Record<string, unknown>
}

export interface ApprovalDialogProps {
  request: ApprovalRequest | null
  onApprove: (callId: string, alwaysAllow: boolean) => void
  onReject: (callId: string) => void
}

export function ApprovalDialog({ request, onApprove, onReject }: ApprovalDialogProps) {
  const [alwaysAllow, setAlwaysAllow] = useState(false)

  useEffect(() => {
    if (!request) {
      return
    }
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [request])

  useEffect(() => {
    if (!request) {
      setAlwaysAllow(false)
    }
  }, [request])

  // Esc rejects the request. Without this, the FocusModeEditor's modal-overlay
  // guard would defer to us but we'd swallow the keystroke silently — a
  // keyboard dead-end while the dialog is open.
  useEffect(() => {
    if (!request) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      if (event.isComposing || event.keyCode === 229) return
      event.preventDefault()
      onReject(request.callId)
      setAlwaysAllow(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [request, onReject])

  if (!request) {
    return null
  }

  function handleApprove() {
    onApprove(request!.callId, alwaysAllow)
    setAlwaysAllow(false)
  }

  function handleReject() {
    onReject(request!.callId)
    setAlwaysAllow(false)
  }

  return createPortal(
    <div className="modal-overlay" role="presentation">
      <div className="modal-dialog">
        <div className="modal-header">
          <div>
            <p className="eyebrow">Tool Use Request</p>
            <h2>工具调用确认</h2>
          </div>
          <button className="ghost-button" onClick={handleReject} type="button">
            关闭
          </button>
        </div>

        <div className="field">
          <h3 className="approval-summary">{request.summary}</h3>
          <p style={{ fontFamily: 'monospace', marginTop: '0.5rem' }}>
            工具: {request.toolName}
          </p>
          <details style={{ marginTop: '0.75rem' }}>
            <summary>查看完整参数</summary>
            <pre className="approval-args-pre">
              {JSON.stringify(request.args, null, 2)}
            </pre>
          </details>
        </div>

        <div className="modal-footer">
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={alwaysAllow}
              onChange={(e) => setAlwaysAllow(e.target.checked)}
            />
            <span>本次会话内一直允许此工具</span>
          </label>
          <button className="ghost-button" onClick={handleReject} type="button">
            拒绝
          </button>
          <button className="primary-button" onClick={handleApprove} type="button">
            批准
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
