import { TEST_STORE } from '../presence/__fixtures__/testStore'
import type { DinnerSources } from './dinner'
import type { LagetData, LagetEvent } from './types'

// Test data for Läget: the anonymised presence fixture plus invented events/periods. Sample dates
// (resolved against TEST_STORE):
//   Mon 2026-11-09  barnvecka, Aktivitet E 18:20 (conflict day)
//   Tue 2026-11-10  vuxen B-vecka, no kids home
//   Wed 2026-11-11  barnvecka, Aktivitet F 19:05 (arriveBy 18:50)
//   Mon 2026-11-16  barnvecka, inside the test break (lov 9–20 Nov)

export const DENTIST: LagetEvent = {
  id: 'h-2026-11-11-tandlakare',
  title: 'Tandläkare',
  date: '2026-11-11',
  endDate: null,
  personIds: ['barn-a'],
  startTime: '14:50',
  arriveBy: '14:40',
  leaveBy: '14:25',
  endTime: '15:35',
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
      { id: 'ht', kind: 'termin', name: 'Hösttermin', from: '2026-08-24', to: null, personIds: ['barn-a', 'barn-b'] },
      { id: 'lov', kind: 'lov', name: 'Test-lov', from: '2026-11-16', to: '2026-11-20', personIds: ['barn-a', 'barn-b'] },
    ],
    events: [DENTIST],
    todos: [],
    klart: {},
    ...overrides,
  }
}

/** Matracet's plan as Läget reads it: Wed 11 Nov is planned in Planera (tacos), Mon 9 Nov comes from
 *  the week file, Tue 10 Nov is marked "no meal needed". */
export function makeDinner(over: Partial<DinnerSources> = {}): DinnerSources {
  return {
    weekplan: {
      '2026-11-11': { dinner: { mealSlug: 'tacos', receptSlug: null } },
      '2026-11-10': { dinnerAttendance: { skip: true } },
    },
    weeks: [{ vecka: '2026-W46', skapad: '2026-11-01', anteckningar: [], middagar: [{ dag: 'Måndag', datum: '2026-11-09', recept: 'Ugnsbakad lax' }, { dag: 'Fredag', datum: '2026-11-13', recept: null }] }],
    meals: [{ slug: 'tacos', namn: 'Tacos', alias: [], komponenter: [], receptSlug: null, taggar: [] }],
    recipeIndex: [],
    ...over,
  }
}
