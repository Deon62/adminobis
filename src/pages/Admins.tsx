import { ShieldCheck, UserPlus, X } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { AskDialog, Button, cell, EmptyState, Loading, Notice, PageHeader, Panel, Table, useAdmin, useAdminData, useAdminPost } from '../components/ui'
import { ROLE_LABEL, type Role } from '../lib/api'
import { cn, when } from '../lib/format'

type Admin = { id: string; email: string; name: string; role: Role; active: boolean; createdAt: string; lastLoginAt: string | null }

const ROLES: Array<[Role, string]> = [
  ['support', 'Support: verifies IDs and payment methods'],
  ['finance', 'Finance: pays and rejects withdrawals'],
  ['admin', 'Admin: everything except managing admins'],
  ['superadmin', 'Super admin: everything'],
]

const box = 'mt-2 h-10 w-full border border-line bg-bg px-3 text-sm outline-none focus:border-text'

function NewAdmin({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const post = useAdminPost()
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [role, setRole] = useState<Role>('support')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await post('/admins', { email: email.trim(), name: name.trim(), role, password })
      onDone()
    } catch (e) {
      setError((e as Error).message)
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/50 sm:items-center sm:p-4" onClick={() => !busy && onClose()}>
      <form onSubmit={submit} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Add an admin" className="w-full max-w-md border border-line bg-surface">
        <header className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 className="text-sm font-semibold">Add an admin</h2>
          <button type="button" aria-label="Close" onClick={onClose} className="text-muted hover:text-text">
            <X size={16} aria-hidden="true" />
          </button>
        </header>
        <div className="space-y-4 p-5">
          <label className="block">
            <span className="text-sm font-medium">Email</span>
            <input type="email" autoFocus required value={email} onChange={(e) => setEmail(e.target.value)} className={box} />
          </label>
          <label className="block">
            <span className="text-sm font-medium">Name</span>
            <input value={name} onChange={(e) => setName(e.target.value)} className={box} />
          </label>
          <label className="block">
            <span className="text-sm font-medium">Role</span>
            <select value={role} onChange={(e) => setRole(e.target.value as Role)} className={box}>
              {ROLES.map(([r, label]) => (
                <option key={r} value={r}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-sm font-medium">Starting password, 10+ characters</span>
            <input type="text" required minLength={10} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="off" className={`${box} font-mono`} />
            <span className="mt-1 block text-xs text-muted">Give it to them privately. They can change it on their Account page.</span>
          </label>
          {error && <p className="text-sm text-bad">{error}</p>}
        </div>
        <footer className="flex justify-end gap-2 border-t border-line px-5 py-4">
          <Button onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" tone="primary" disabled={busy}>
            {busy ? 'Adding' : 'Add admin'}
          </Button>
        </footer>
      </form>
    </div>
  )
}

export default function Admins() {
  const { me } = useAdmin()
  const post = useAdminPost()
  const { data, error, loading, reload } = useAdminData<Admin[]>('/admins')
  const [adding, setAdding] = useState(false)
  const [resetting, setResetting] = useState<Admin | null>(null)
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null)

  const change = async (a: Admin, body: Record<string, unknown>, done: string) => {
    setNote(null)
    try {
      await post(`/admins/${a.id}`, body)
      setNote({ ok: true, text: done })
      void reload()
    } catch (e) {
      setNote({ ok: false, text: (e as Error).message })
    }
  }

  return (
    <>
      <PageHeader title="Admins" note="Who can sign in to this site, and what each can do. Only super admins see this page.">
        <Button tone="primary" onClick={() => setAdding(true)} className="h-9 px-4">
          <UserPlus size={14} aria-hidden="true" />
          Add admin
        </Button>
      </PageHeader>
      {error && <Notice>{error}</Notice>}
      {note && <Notice tone={note.ok ? 'good' : 'bad'}>{note.text}</Notice>}
      <Panel flush>
        {loading && !data ? (
          <Loading />
        ) : !data?.length ? (
          <EmptyState icon={ShieldCheck} title="No admin accounts yet" />
        ) : (
          <Table minWidth="56rem" columns={['Admin', 'Role', 'Status', 'Last sign-in', 'Added', '']}>
            {data.map((a) => {
              const self = a.id === me.id
              return (
                <tr key={a.id} className={cn(!a.active && 'text-muted')}>
                  <td className={cell}>
                    <p className="font-medium">
                      {a.name || '-'}
                      {self && <span className="ml-2 text-xs text-muted">you</span>}
                    </p>
                    <p className="text-xs text-muted">{a.email}</p>
                  </td>
                  <td className={cell}>
                    <select
                      value={a.role}
                      disabled={self}
                      aria-label={`Role for ${a.email}`}
                      onChange={(e) => void change(a, { role: e.target.value }, `${a.email} is now ${ROLE_LABEL[e.target.value as Role]}.`)}
                      className="h-8 border border-line bg-surface px-2 text-xs disabled:opacity-60"
                    >
                      {ROLES.map(([r]) => (
                        <option key={r} value={r}>
                          {ROLE_LABEL[r]}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className={cell}>
                    <span className={cn('font-mono text-xs', a.active ? 'text-good' : 'text-bad')}>{a.active ? 'active' : 'switched off'}</span>
                  </td>
                  <td className={`${cell} whitespace-nowrap text-muted`}>{when(a.lastLoginAt)}</td>
                  <td className={`${cell} whitespace-nowrap text-muted`}>{when(a.createdAt)}</td>
                  <td className={`${cell} whitespace-nowrap text-right`}>
                    {!self && (
                      <span className="inline-flex gap-2">
                        <Button
                          onClick={() => setResetting(a)}
                        >
                          Reset password
                        </Button>
                        <Button tone={a.active ? 'danger' : 'plain'} onClick={() => void change(a, { active: !a.active }, `${a.email} ${a.active ? 'switched off' : 'switched on'}.`)}>
                          {a.active ? 'Switch off' : 'Switch on'}
                        </Button>
                      </span>
                    )}
                  </td>
                </tr>
              )
            })}
          </Table>
        )}
      </Panel>
      {resetting && (
        <AskDialog
          title="Reset password"
          text={<>A new password for <b className="text-text">{resetting.email}</b>. They are signed out everywhere and use this to sign in.</>}
          label="New password, 10+ characters"
          confirm="Reset password"
          onClose={() => setResetting(null)}
          onSubmit={async (pw) => {
            if (pw.length < 10) throw new Error('Use 10 characters or more.')
            await change(resetting, { password: pw }, `Password reset for ${resetting.email}.`)
            setResetting(null)
          }}
        />
      )}
      {adding && (
        <NewAdmin
          onClose={() => setAdding(false)}
          onDone={() => {
            setAdding(false)
            setNote({ ok: true, text: 'Admin added.' })
            void reload()
          }}
        />
      )}
    </>
  )
}
