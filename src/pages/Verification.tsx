import { BadgeCheck, ExternalLink, FileText, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button, cell, EmptyState, Facts, Filter, Filters, Loading, Notice, PageHeader, Panel, Status, Table, useAdmin, useAdminData, useAdminPost, useCan, UserLink, VipTag } from '../components/ui'
import { adminBlob } from '../lib/api'
import { ago, cn, day, when } from '../lib/format'

type Submission = {
  id: string
  userId: string
  email: string
  name: string
  phone: string
  country: string | null
  joined: string
  kind: 'identity' | 'address'
  docType: string
  docName: string
  status: 'pending' | 'approved' | 'rejected'
  reason: string | null
  createdAt: string
  decidedAt: string | null
  vip: boolean
  files: Array<{ id: string; side: string; mime: string; size: number }>
}

type Show = 'pending' | 'approved' | 'rejected' | 'all'
type Kind = 'all' | 'identity' | 'address'
const KIND = { identity: 'Proof of identity', address: 'Proof of address' }

/** One file, fetched with the admin token and shown from memory. */
function Doc({ path, mime, side }: { path: string; mime: string; side: string }) {
  const { token } = useAdmin()
  const [url, setUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let made: string | null = null
    let live = true
    adminBlob(path, token).then(
      (u) => {
        made = u
        if (live) setUrl(u)
        else URL.revokeObjectURL(u)
      },
      (e: Error) => live && setError(e.message),
    )
    return () => {
      live = false
      if (made) URL.revokeObjectURL(made)
    }
  }, [path, token])

  return (
    <figure className="border border-line bg-bg">
      <figcaption className="flex items-center justify-between border-b border-line px-3 py-2 text-xs">
        <span className="font-medium">{side}</span>
        {url && (
          <a href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-muted hover:text-text">
            Open <ExternalLink size={12} aria-hidden="true" />
          </a>
        )}
      </figcaption>
      <div className="flex min-h-56 items-center justify-center p-2">
        {error ? (
          <p className="text-sm text-bad">{error}</p>
        ) : !url ? (
          <p className="text-sm text-muted">Loading</p>
        ) : mime === 'application/pdf' ? (
          <a href={url} target="_blank" rel="noreferrer" className="flex flex-col items-center gap-2 text-sm text-muted hover:text-text">
            <FileText size={32} aria-hidden="true" />
            Open the PDF
          </a>
        ) : (
          <a href={url} target="_blank" rel="noreferrer">
            <img src={url} alt={side} className="max-h-[28rem] w-auto object-contain" />
          </a>
        )}
      </div>
    </figure>
  )
}

function Review({ s, onClose, onDone }: { s: Submission; onClose: () => void; onDone: () => void }) {
  const post = useAdminPost()
  const can = useCan()
  const allowed = can('admin', 'support')
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const key = (event: KeyboardEvent) => event.key === 'Escape' && !busy && onClose()
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [busy, onClose])

  const decide = async (action: 'approve' | 'reject') => {
    if (action === 'reject' && reason.trim().length < 3) {
      setError('Say why, so the user knows what to send instead.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      await post(`/verifications/${s.id}/${action}`, { reason: action === 'reject' ? reason.trim() : null })
      onDone()
    } catch (e) {
      setError((e as Error).message)
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-ink/50" onClick={() => !busy && onClose()}>
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={`Review ${s.email}`}
        onClick={(event) => event.stopPropagation()}
        className="flex h-full w-full max-w-3xl flex-col border-l border-line bg-surface"
      >
        <header className="flex items-start justify-between gap-4 border-b border-line px-6 py-5">
          <div>
            <h2 className="flex items-center text-lg font-semibold">
              {s.name || s.email}
              {s.vip && <VipTag />}
            </h2>
            <p className="mt-0.5 text-sm text-muted">
              {KIND[s.kind]} · {s.docName} · sent {when(s.createdAt)}
            </p>
          </div>
          <button type="button" aria-label="Close" onClick={onClose} className="text-muted hover:text-text">
            <X size={18} aria-hidden="true" />
          </button>
        </header>

        <div className="flex-1 space-y-5 overflow-y-auto p-6">
          <div className={cn('grid gap-3', s.files.length > 1 && 'sm:grid-cols-2')}>
            {s.files.map((f) => (
              <Doc key={f.id} path={`/verifications/${s.id}/files/${f.id}`} mime={f.mime} side={f.side} />
            ))}
          </div>
          <Facts
            items={[
              ['Name on account', s.name || '-'],
              ['Email', <UserLink key="u" id={s.userId} email={s.email} />],
              ['Phone', s.phone || '-'],
              ['Country', s.country || '-'],
              ['Joined', day(s.joined)],
              ['Status', <Status key="s" value={s.status} />],
            ]}
          />
          <p className="text-xs text-muted">
            Check the name and photo match the account, the document is in date and all four corners are in view. Approving a proof of identity
            opens withdrawals for this user. The user is emailed either way.
          </p>
          {s.status === 'rejected' && s.reason && <Notice>Rejected: {s.reason}</Notice>}
          {s.status === 'pending' && allowed && (
            <label className="block">
              <span className="text-sm font-medium">Reason, if you reject</span>
              <input
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="e.g. The photo is blurred: send a sharper one"
                className="mt-2 h-10 w-full border border-line bg-bg px-3 text-sm outline-none focus:border-text"
              />
              <span className="mt-1 block text-xs text-muted">Sent to the user, so they know what to send instead.</span>
            </label>
          )}
          {error && <p className="text-sm text-bad">{error}</p>}
        </div>

        {s.status === 'pending' && allowed && (
          <footer className="flex justify-end gap-2 border-t border-line px-6 py-4">
            <Button tone="danger" disabled={busy} onClick={() => void decide('reject')}>
              Reject
            </Button>
            <Button tone="primary" disabled={busy} onClick={() => void decide('approve')}>
              {busy ? 'Saving' : 'Approve'}
            </Button>
          </footer>
        )}
      </aside>
    </div>
  )
}

export default function Verification() {
  const [show, setShow] = useState<Show>('pending')
  const [kind, setKind] = useState<Kind>('all')
  const { data, error, loading, reload } = useAdminData<Submission[]>(`/verifications?status=${show}&kind=${kind}`)
  const [open, setOpen] = useState<Submission | null>(null)

  return (
    <>
      <PageHeader title="Verification" note="Users must have a proof of identity approved before they can withdraw. Oldest first while waiting.">
        <Filters>
          <Filter<Show>
            label="Status"
            value={show}
            onChange={setShow}
            options={[
              ['pending', 'Waiting'],
              ['approved', 'Approved'],
              ['rejected', 'Rejected'],
              ['all', 'All'],
            ]}
          />
          <Filter<Kind>
            label="Document"
            value={kind}
            onChange={setKind}
            options={[
              ['all', 'All documents'],
              ['identity', 'Identity'],
              ['address', 'Address'],
            ]}
          />
        </Filters>
      </PageHeader>
      {error && <Notice>{error}</Notice>}
      <Panel flush>
        {loading && !data ? (
          <Loading />
        ) : !data?.length ? (
          <EmptyState icon={BadgeCheck} title={show === 'pending' ? 'Nothing waiting' : 'Nothing here'}>
            {show === 'pending' ? 'Documents users send from the Verification page land here.' : undefined}
          </EmptyState>
        ) : (
          <Table minWidth="52rem" columns={['User', 'Contact', 'Document', 'Files', 'Status', 'Sent', '']}>
            {data.map((s) => (
              <tr key={s.id} onClick={() => setOpen(s)} className="cursor-pointer transition-colors hover:bg-hover">
                <td className={cell}>
                  <p className="font-medium">
                    {s.name || '-'}
                    {s.vip && <VipTag />}
                  </p>
                  <p className="text-xs text-muted">{s.email}</p>
                </td>
                <td className={cell}>
                  <p className="font-mono text-xs">{s.phone || '-'}</p>
                  <p className="text-xs text-muted">{s.country || ''}</p>
                </td>
                <td className={cell}>
                  {s.docName}
                  <p className="text-xs text-muted">{KIND[s.kind]}</p>
                </td>
                <td className={`${cell} text-muted`}>{s.files.map((f) => f.side).join(', ')}</td>
                <td className={cell}>
                  <Status value={s.status === 'pending' ? 'review' : s.status} />
                </td>
                <td className={`${cell} whitespace-nowrap text-muted`} title={when(s.createdAt)}>
                  {ago(s.createdAt)}
                </td>
                <td className={`${cell} text-right`}>
                  <span className="text-xs text-muted">{s.status === 'pending' ? 'Review' : 'View'}</span>
                </td>
              </tr>
            ))}
          </Table>
        )}
      </Panel>
      {open && (
        <Review
          s={open}
          onClose={() => setOpen(null)}
          onDone={() => {
            setOpen(null)
            void reload()
          }}
        />
      )}
    </>
  )
}
