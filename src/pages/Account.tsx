import { useState, type FormEvent } from 'react'
import { Button, Facts, Loading, Notice, PageHeader, Panel, useAdmin, useAdminData, useAdminPost } from '../components/ui'
import { ROLE_LABEL, type Me } from '../lib/api'
import { when } from '../lib/format'

type Detail = Me & { createdAt: string | null; lastLoginAt: string | null; sessions: Array<{ ip: string | null; device: string; createdAt: string; expiresAt: string }> }

const box = 'mt-2 h-10 w-full border border-line bg-bg px-3 text-sm outline-none focus:border-text'

const WHAT: Record<string, string> = {
  superadmin: 'Everything, including adding and changing admins.',
  admin: 'Everything except managing admins.',
  finance: 'Pays and rejects withdrawals. Reads everything else.',
  support: 'Verifies IDs and payment methods. Reads everything else.',
  marketer: 'Goes live and sees the money deposited during their own sessions. Nothing else.',
}

export default function Account() {
  const { me, setMe } = useAdmin()
  const post = useAdminPost()
  const { data, error, loading, reload } = useAdminData<Detail>('/me')
  const [name, setName] = useState(me.name)
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [again, setAgain] = useState('')
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const token = !me.id

  const act = async (fn: () => Promise<string>) => {
    setBusy(true)
    setNote(null)
    try {
      setNote({ ok: true, text: await fn() })
    } catch (e) {
      setNote({ ok: false, text: (e as Error).message })
    } finally {
      setBusy(false)
    }
  }

  const saveName = (event: FormEvent) => {
    event.preventDefault()
    void act(async () => {
      const out = await post<Me>('/me/profile', { name })
      setMe({ ...me, name: out.name })
      return 'Name saved.'
    })
  }

  const savePassword = (event: FormEvent) => {
    event.preventDefault()
    if (next !== again) {
      setNote({ ok: false, text: 'The new passwords do not match.' })
      return
    }
    void act(async () => {
      await post('/me/password', { current, new: next })
      setCurrent('')
      setNext('')
      setAgain('')
      void reload()
      return 'Password changed. Every other device was signed out.'
    })
  }

  return (
    <>
      <PageHeader title="Account" note="Your admin account on this site." />
      {error && <Notice>{error}</Notice>}
      {note && <Notice tone={note.ok ? 'good' : 'bad'}>{note.text}</Notice>}
      {token && <Notice>Signed in with ADMIN_TOKEN, which has no account. Create an admin account on the Admins page and sign in with it.</Notice>}
      {loading && !data && <Loading />}
      {data && (
        <>
          <Facts
            items={[
              ['Name', data.name || '-'],
              ['Email', data.email],
              ['Role', ROLE_LABEL[data.role]],
              ['What it can do', WHAT[data.role]],
              ['Account since', when(data.createdAt)],
              ['Last sign-in', when(data.lastLoginAt)],
            ]}
          />

          {!token && (
            <div className="grid gap-5 xl:grid-cols-3">
              <Panel title="Your name">
                <form onSubmit={saveName}>
                  <label className="block">
                    <span className="text-sm text-muted">Shown in the activity log next to your email.</span>
                    <input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} className={box} />
                  </label>
                  <Button type="submit" tone="primary" disabled={busy} className="mt-4">
                    Save name
                  </Button>
                </form>
              </Panel>

              <Panel title="Change password">
                <form onSubmit={savePassword} className="space-y-3">
                  <input type="password" placeholder="Current password" aria-label="Current password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} required className={box} />
                  <input type="password" placeholder="New password, 10+ characters" aria-label="New password" autoComplete="new-password" minLength={10} value={next} onChange={(e) => setNext(e.target.value)} required className={box} />
                  <input type="password" placeholder="New password again" aria-label="New password again" autoComplete="new-password" minLength={10} value={again} onChange={(e) => setAgain(e.target.value)} required className={box} />
                  <Button type="submit" tone="primary" disabled={busy}>
                    Change password
                  </Button>
                </form>
              </Panel>

              <Panel
                title={`Signed in on ${data.sessions.length} device${data.sessions.length === 1 ? '' : 's'}`}
                action={
                  data.sessions.length > 1 && (
                    <Button
                      disabled={busy}
                      onClick={() =>
                        void act(async () => {
                          const out = await post<{ ended: number }>('/me/sign-out-others')
                          void reload()
                          return `Signed out ${out.ended} other device${out.ended === 1 ? '' : 's'}.`
                        })
                      }
                    >
                      Sign out others
                    </Button>
                  )
                }
              >
                <ul className="divide-y divide-line text-sm">
                  {data.sessions.map((s) => (
                    <li key={s.createdAt} className="py-2 first:pt-0 last:pb-0">
                      <p className="truncate" title={s.device}>
                        {s.device || 'Unknown device'}
                      </p>
                      <p className="text-xs text-muted">
                        {s.ip ?? '-'} · since {when(s.createdAt)}
                      </p>
                    </li>
                  ))}
                </ul>
              </Panel>
            </div>
          )}
        </>
      )}
    </>
  )
}
