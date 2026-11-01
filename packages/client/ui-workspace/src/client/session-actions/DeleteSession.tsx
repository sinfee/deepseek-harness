import { useState } from 'react'
import { Button, Modal } from '@deepseek-ai/dsh-client-ui-primitives'
import type { ObservableSnapshot } from '@deepseek-ai/dsh-client-store'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import css from '../rows/WorkspaceBrowser.module.css'

/** 删除确认由全局覆盖层持有，菜单关闭后仍可报告失败。 */
export interface DeleteSessionInjected {
  hooks: { deleteRequest: ObservableSnapshot<{ sessionId: SessionId; displayTitle: string } | null> }
  settleDelete: () => void
  deleteSession: (sessionId: SessionId) => Promise<void>
}

/**
 * 显示永久删除确认，执行期间禁止重复提交和关闭。
 * @param props - 确认请求、删除动作和本地化文本。
 * @returns 删除确认对话框，或空内容。
 */
export function DeleteSessionDialog({ useDeleteRequest, settleDelete, deleteSession, t }:
  PropsRuntime<'shell.overlay'> & PropsLocale<'workspace'> & InjectFace<DeleteSessionInjected>) {
  const request = useDeleteRequest(value => value)
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  if (request === null) return null
  const close = () => { if (!busy) { setFailed(false); settleDelete() } }
  const confirm = () => {
    setBusy(true)
    setFailed(false)
    void deleteSession(request.sessionId).then(() => {
      setBusy(false)
      settleDelete()
    }).catch(() => { setBusy(false); setFailed(true) })
  }
  return <Modal open onClose={close} closeLabel={t('close')} title={t('delete.session')}
    description={t('delete.session.desc', { name: request.displayTitle })}
    footer={<>
      <Button variant="outline" disabled={busy} onClick={close}>{t('cancel')}</Button>
      <Button variant="outline" className={css.deleteAction} disabled={busy} onClick={confirm}>{t('delete.session')}</Button>
    </>}>
    {busy && <div role="status">{t('delete.session.pending')}</div>}
    {failed && <div role="alert" className={css.renameError}>{t('delete.session.failed')}</div>}
  </Modal>
}
