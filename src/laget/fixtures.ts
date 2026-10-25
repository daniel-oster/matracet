import { TEST_STORE } from '../presence/__fixtures__/testStore'
import type { DinnerSources } from './dinner'
import type { LagetData, LagetEvent } from './types'

// Test data for Läget: the anonymised presence fixture plus invented events/periods. Sample dates
// (resolved against TEST_STORE):
//   Mon 2026-11-02  barnvecka, Aktivitet E 18:00 (conflict day)
//   Tue 2026-11-03  vuxen B-vecka, no kids home
//   Wed 2026-11-04  barnvecka, Aktivitet F 18:45 (arriveBy 18:30)
//   Mon 2026-11-09  barnvecka, inside the test break (lov 9–13 Nov)

export const DENTIST: LagetEvent = {
  id: 'h-2026-11-04-tandlakare',
  title: 'Tandläkare',
  date: '2026-11-04',
  endDate: null,
  personIds: ['barn-a'],
  startTime: '14:30',
  arriveBy: '14:20',
  leaveBy: '14:05',
  endTime: '15:15',
  affectsWindow: false,
  place: 'Folktandvården',
  prepare: [{ text: 'Ta med kallelsen', daysBefore: 1 }],
}

export function makeData(overrides: Partial<LagetData> = {}): LagetData {
  const schema = JSON.parse(JSON.stringify(TEST_STORE)) as LagetData['schema']
  for (const a of schema.activities!) {
    if (a.id === 'barn-a-mon-a5-ht26') a.prepare = [{ text: 'Packa väskan', daysBefore: 1 }]
    if (a.id === 'barn-a-mon-a1-ht26') {
      a.pausedOnBreak = true
      a.prepare = [{ text: 'Packa gympapåsen', daysBefore: 1 }]
    }
  }
  return {
    schema,
    periods: [
      { id: 'ht', kind: 'termin', name: 'Hösttermin', from: '2026-08-17', to: null, personIds: ['barn-a', 'barn-b'] },
      { id: 'lov', kind: 'lov', name: 'Test-lov', from: '2026-11-09', to: '2026-11-13', personIds: ['barn-a', 'barn-b'] },
    ],
    events: [DENTIST],
    todos: [],
    klart: {},
    ...overrides,
  }
}

/** Matracet's plan as Läget reads it: Wed 4 Nov is planned in Planera (tacos), Mon 2 Nov comes from
 *  the week file, Tue 3 Nov is marked "no meal needed". */
export function makeDinner(over: Partial<DinnerSources> = {}): DinnerSources {
  return {
    weekplan: {
      '2026-11-04': { dinner: { mealSlug: 'tacos', receptSlug: null } },
      '2026-11-03': { dinnerAttendance: { skip: true } },
    },
    weeks: [{ vecka: '2026-W45', skapad: '2026-10-25', anteckningar: [], middagar: [{ dag: 'Måndag', datum: '2026-11-02', recept: 'Ugnsbakad lax' }, { dag: 'Fredag', datum: '2026-11-06', recept: null }] }],
    meals: [{ slug: 'tacos', namn: 'Tacos', alias: [], komponenter: [], receptSlug: null, taggar: [] }],
    recipeIndex: [],
    ...over,
  }
}
