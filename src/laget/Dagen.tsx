import type { DayView, TimelineItem } from './types'
import { dateLabel, dinnerHref, dinnerText, mealHref, windowLine } from './format'
import { NO_MEAL_NEEDED } from './dinner'
import { shieldRows } from './summary'

// The three day screens. Pure presentation over a DayView — buildDay does the thinking.

function who(view: DayView, t: TimelineItem): string {
  const names = new Map(view.presence.presentPersons.map(p => [p.id, p.name]))
  return t.personIds.map(id => names.get(id)).filter(Boolean).join(', ')
}

function TimelineRow({ view, t }: { view: DayView; t: TimelineItem }) {
  return (
    <li className="laget-tl">
      <span className="laget-tl-time">{t.startTime ?? '–'}</span>
      <span className="laget-tl-body">
        <span className="laget-tl-title">{t.title}</span>
        {(t.leaveBy || t.place || who(view, t)) && (
          <span className="laget-tl-sub">
            {[t.leaveBy ? `åk senast ${t.leaveBy}` : null, t.place, who(view, t) || null].filter(Boolean).join(' · ')}
          </span>
        )}
      </span>
    </li>
  )
}

export function Shield({ view, nowTime, onOpen }: { view: DayView; nowTime: string; onOpen: () => void }) {
  const rows = shieldRows(view, 3, nowTime)
  const window = windowLine(view.presence)
  const meals = [
    view.lunch ? { label: 'Lunch', text: view.lunch.title, note: null as string | null } : null,
    view.dinner && view.dinner.title !== NO_MEAL_NEEDED ? { label: 'Middag', text: view.dinner.title, note: window } : null,
  ].filter((m): m is { label: string; text: string; note: string | null } => m !== null)
  const empty = rows.length === 0 && meals.length === 0
  return (
    <button className="laget-shield" onClick={onOpen}>
      <span className="laget-shield-q">Idag</span>
      <span className="laget-shield-date">{dateLabel(view.date)}</span>
      <span className="laget-shield-sub">{view.isChildWeek ? 'Barnvecka' : 'Ej barnvecka'}</span>
      {empty && <span className="laget-shield-empty">Inget som styr dagen.</span>}
      {rows.length > 0 && (
        <ul className="laget-shield-rows">
          {rows.map((r, i) => (
            <li key={i}>
              <span className="laget-shield-time">{r.time ?? (r.kind === 'gora' ? '☐' : '')}</span>
              <span className="laget-shield-what">
                {r.title}
                {r.note && <small>{r.note}</small>}
              </span>
            </li>
          ))}
        </ul>
      )}
      {meals.length > 0 && (
        <ul className="laget-shield-rows laget-shield-meals">
          {meals.map(m => (
            <li key={m.label}>
              <span className="laget-shield-time">{m.label}</span>
              <span className="laget-shield-what">
                {m.text}
                {m.note && <small>{m.note}</small>}
              </span>
            </li>
          ))}
        </ul>
      )}
      <span className="laget-shield-more">Hela dagen →</span>
    </button>
  )
}

export function Idag({
  view,
  tomorrow,
  onTomorrow,
  onTickTodo,
  error,
}: {
  view: DayView
  tomorrow: DayView
  onTomorrow: () => void
  onTickTodo: (id: string) => void
  error: string | null
}) {
  const dinner = dinnerText(view)
  return (
    <>
      <h2 className="laget-h">{dateLabel(view.date)}</h2>
      <p className="laget-sub">{view.isChildWeek ? 'Barnvecka' : 'Ej barnvecka'} · {view.presence.presentPersons.map(p => p.name).join(', ') || 'ingen hemma'}</p>

      <section className="laget-card">
        <h3>Tider</h3>
        {view.timeline.length === 0 ? (
          <p className="laget-muted">Inga tider idag.</p>
        ) : (
          <ul className="laget-list">
            {view.timeline.map(t => <TimelineRow key={t.id} view={view} t={t} />)}
          </ul>
        )}
      </section>

      {view.todos.length > 0 && (
        <section className="laget-card">
          <h3>Att göra</h3>
          <ul className="laget-list">
            {view.todos.map(t => (
              <li key={t.id}>
                <label className="laget-check">
                  <input type="checkbox" checked={false} onChange={() => onTickTodo(t.id)} />
                  <span>
                    {t.title}
                    <span className="laget-tl-sub">
                      {t.due < view.date ? `försenad sedan ${dateLabel(t.due)}` : t.dueTime ? `kl ${t.dueTime}` : 'idag'}
                    </span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
          {error && <p className="laget-status laget-status--unauthorized">{error}</p>}
        </section>
      )}

      {view.lunch && (
        <section className="laget-card">
          <h3>Lunch</h3>
          <p><MealText href={mealHref(view.lunch, import.meta.env.BASE_URL)}>{view.lunch.title}</MealText></p>
        </section>
      )}

      <section className="laget-card">
        <h3>Middag</h3>
        <p>
          {dinner
            ? <MealText href={dinnerHref(view, import.meta.env.BASE_URL)}>{dinner}</MealText>
            : (view.presence.presentPersons.length ? 'Inget planerat. Ätfönstret är öppet.' : 'Ingen hemma.')}
        </p>
      </section>

      <button className="laget-link" onClick={onTomorrow}>
        Imorgon: {tomorrow.timeline.length === 0 ? 'inget inplanerat' : `${tomorrow.timeline.length} ${tomorrow.timeline.length === 1 ? 'sak' : 'saker'}`}
        {view.tomorrowTeaser ? ` · ${view.tomorrowTeaser}` : ''} →
      </button>
    </>
  )
}

export function Imorgon({
  today,
  tomorrow,
  onTick,
  error,
}: {
  today: DayView
  tomorrow: DayView
  onTick: (key: string, on: boolean) => void
  error: string | null
}) {
  return (
    <>
      <h2 className="laget-h">Imorgon · {dateLabel(tomorrow.date)}</h2>
      <p className="laget-sub">{tomorrow.isChildWeek ? 'Barnvecka' : 'Ej barnvecka'}</p>

      <section className="laget-card">
        <h3>Förbered idag</h3>
        {today.prepareTonight.length === 0 ? (
          <p className="laget-muted">Inget att förbereda.</p>
        ) : (
          <ul className="laget-list">
            {today.prepareTonight.map(p => (
              <li key={p.key}>
                <label className={`laget-check${p.done ? ' laget-check--done' : ''}`}>
                  <input type="checkbox" checked={p.done} onChange={e => onTick(p.key, e.target.checked)} />
                  <span>
                    {p.text}
                    <span className="laget-tl-sub">{p.sourceTitle}{p.forDate !== tomorrow.date ? ` · ${dateLabel(p.forDate)}` : ''}</span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
        )}
        {error && <p className="laget-status laget-status--unauthorized">{error}</p>}
      </section>

      <section className="laget-card">
        <h3>Det som händer imorgon</h3>
        {tomorrow.timeline.length === 0 ? (
          <p className="laget-muted">Inget inplanerat.</p>
        ) : (
          <ul className="laget-list">
            {tomorrow.timeline.map(t => <TimelineRow key={t.id} view={tomorrow} t={t} />)}
          </ul>
        )}
        {tomorrow.lunch && (
          <p className="laget-sub">Lunch: <MealText href={mealHref(tomorrow.lunch, import.meta.env.BASE_URL)}>{tomorrow.lunch.title}</MealText></p>
        )}
        {dinnerText(tomorrow) && (
          <p className="laget-sub">Middag: <MealText href={dinnerHref(tomorrow, import.meta.env.BASE_URL)}>{dinnerText(tomorrow)}</MealText></p>
        )}
      </section>
    </>
  )
}

/** A planned meal's name, as a link to its recipe in a new window when there is one. A new window
 *  (target _blank) keeps Läget where it is instead of replacing it with the recipe. */
function MealText({ href, children }: { href: string | null; children: React.ReactNode }) {
  if (!href) return <>{children}</>
  return <a className="laget-dinner-link" href={href} target="_blank" rel="noopener noreferrer">{children} →</a>
}
