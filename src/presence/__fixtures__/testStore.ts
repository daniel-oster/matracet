import type { PresenceStore } from '../types'

// Synthetic, anonymised schedule with the same *structure* as the real one (same kinds of rules,
// handovers and activities; invented ids/labels). Every date is shifted one week and every clock
// time 20 minutes (2026-11) so it no longer matches the household's real calendar. The real schedule lives in the private repo
// daniel-oster/livet-data (data/schema.json) — never commit it here. Generated once from the
// old seed.ts; edit by hand from now on.
export const TEST_STORE: PresenceStore = {
  "persons": [
    {
      "id": "vuxen-a",
      "name": "Vuxen A",
      "minRepeatGapDays": 0
    },
    {
      "id": "barn-a",
      "name": "Barn A",
      "minRepeatGapDays": 1
    },
    {
      "id": "barn-b",
      "name": "Barn B",
      "minRepeatGapDays": 1
    },
    {
      "id": "vuxen-b",
      "name": "Vuxen B",
      "minRepeatGapDays": 0
    }
  ],
  "groups": [
    {
      "id": "grupp-barn",
      "name": "Vuxen A + barn",
      "memberPersonIds": [
        "vuxen-a",
        "barn-a",
        "barn-b"
      ]
    },
    {
      "id": "grupp-vuxen-b",
      "name": "Vuxen A + vuxen B",
      "memberPersonIds": [
        "vuxen-a",
        "vuxen-b"
      ]
    },
    {
      "id": "grupp-solo",
      "name": "Vuxen A",
      "memberPersonIds": [
        "vuxen-a"
      ]
    }
  ],
  "rules": [
    {
      "id": "mon-weekly",
      "groupId": "grupp-barn",
      "cadence": "WEEKLY",
      "weekdays": [
        1
      ],
      "anchorDate": null,
      "validFrom": "2026-01-08",
      "validUntil": "2026-06-08",
      "priority": 2,
      "handoverByWeekday": {
        "1": "19:20"
      }
    },
    {
      "id": "wed-biweekly",
      "groupId": "grupp-barn",
      "cadence": "BIWEEKLY",
      "weekdays": [
        3
      ],
      "anchorDate": "2026-05-29",
      "validFrom": "2026-01-08",
      "validUntil": "2026-06-08",
      "priority": 2,
      "handoverByWeekday": {
        "3": "19:20"
      }
    },
    {
      "id": "mon-weekly-summer",
      "groupId": "grupp-barn",
      "cadence": "WEEKLY",
      "weekdays": [
        1
      ],
      "anchorDate": null,
      "validFrom": "2026-06-09",
      "validUntil": "2026-08-23",
      "priority": 2
    },
    {
      "id": "wed-biweekly-summer",
      "groupId": "grupp-barn",
      "cadence": "BIWEEKLY",
      "weekdays": [
        3
      ],
      "anchorDate": "2026-05-29",
      "validFrom": "2026-06-09",
      "validUntil": "2026-08-23",
      "priority": 2
    },
    {
      "id": "mon-weekly-autumn2026",
      "groupId": "grupp-barn",
      "cadence": "WEEKLY",
      "weekdays": [
        1
      ],
      "anchorDate": null,
      "validFrom": "2026-08-24",
      "validUntil": null,
      "priority": 2,
      "handoverByWeekday": {
        "1": "19:20"
      }
    },
    {
      "id": "wed-biweekly-autumn2026",
      "groupId": "grupp-barn",
      "cadence": "BIWEEKLY",
      "weekdays": [
        3
      ],
      "anchorDate": "2026-05-29",
      "validFrom": "2026-08-24",
      "validUntil": null,
      "priority": 2,
      "handoverByWeekday": {
        "3": "19:20"
      }
    },
    {
      "id": "weekend-biweekly",
      "groupId": "grupp-barn",
      "cadence": "BIWEEKLY",
      "weekdays": [
        5,
        6,
        7
      ],
      "anchorDate": "2026-05-29",
      "validFrom": "2026-01-08",
      "validUntil": null,
      "priority": 2
    },
    {
      "id": "a-week-midweek",
      "groupId": "grupp-barn",
      "cadence": "BIWEEKLY",
      "weekdays": [
        1,
        2,
        3,
        4
      ],
      "anchorDate": "2026-06-01",
      "validFrom": "2026-01-08",
      "validUntil": null,
      "priority": 2
    },
    {
      "id": "b-week-biweekly",
      "groupId": "grupp-vuxen-b",
      "cadence": "BIWEEKLY",
      "weekdays": [
        5,
        6,
        7
      ],
      "anchorDate": "2026-06-05",
      "validFrom": "2026-01-08",
      "validUntil": null,
      "priority": 1
    },
    {
      "id": "mother-week-midweek",
      "groupId": "grupp-vuxen-b",
      "cadence": "BIWEEKLY",
      "weekdays": [
        1,
        2,
        3,
        4
      ],
      "anchorDate": "2026-06-08",
      "validFrom": "2026-01-08",
      "validUntil": null,
      "priority": 1
    },
    {
      "id": "solo-baseline",
      "groupId": "grupp-solo",
      "cadence": "WEEKLY",
      "weekdays": [
        1,
        2,
        3,
        4,
        5,
        6,
        7
      ],
      "anchorDate": null,
      "validFrom": "2026-01-08",
      "validUntil": null,
      "priority": 0
    }
  ],
  "overrides": [],
  "activities": [
    {
      "id": "barn-a-fri-a1",
      "personId": "barn-a",
      "label": "Skola: Ämne 1",
      "weekday": 5,
      "startTime": null,
      "arriveBy": null,
      "leaveBy": null,
      "endTime": null,
      "affectsWindow": false,
      "validFrom": "2026-01-08",
      "validUntil": "2026-06-08",
      "notes": null
    },
    {
      "id": "barn-a-fri-a2",
      "personId": "barn-a",
      "label": "Aktivitet B",
      "weekday": 5,
      "startTime": "17:50",
      "arriveBy": "17:35",
      "leaveBy": null,
      "endTime": "19:05",
      "affectsWindow": true,
      "validFrom": "2026-01-08",
      "validUntil": "2026-06-08",
      "notes": null
    },
    {
      "id": "barn-a-sun-a3",
      "personId": "barn-a",
      "label": "Aktivitet C",
      "weekday": 7,
      "startTime": "12:20",
      "arriveBy": "12:05",
      "leaveBy": null,
      "endTime": "13:50",
      "affectsWindow": true,
      "validFrom": "2026-01-08",
      "validUntil": "2026-06-08",
      "notes": null
    },
    {
      "id": "barn-a-sun-a4",
      "personId": "barn-a",
      "label": "Aktivitet D",
      "weekday": 7,
      "startTime": "18:05",
      "arriveBy": "17:50",
      "leaveBy": null,
      "endTime": "19:35",
      "affectsWindow": true,
      "validFrom": "2026-01-08",
      "validUntil": "2026-06-08",
      "notes": null
    },
    {
      "id": "barn-a-mon-a1",
      "personId": "barn-a",
      "label": "Skola: Ämne 1",
      "weekday": 1,
      "startTime": null,
      "arriveBy": null,
      "leaveBy": null,
      "endTime": null,
      "affectsWindow": false,
      "validFrom": "2026-01-08",
      "validUntil": "2026-06-08",
      "notes": null
    },
    {
      "id": "barn-a-mon-a5",
      "personId": "barn-a",
      "label": "Aktivitet E",
      "weekday": 1,
      "startTime": "18:20",
      "arriveBy": null,
      "leaveBy": null,
      "endTime": "20:20",
      "affectsWindow": true,
      "validFrom": "2026-01-08",
      "validUntil": "2026-06-08",
      "notes": null
    },
    {
      "id": "barn-a-wed-a6",
      "personId": "barn-a",
      "label": "Aktivitet F",
      "weekday": 3,
      "startTime": "19:05",
      "arriveBy": "18:50",
      "leaveBy": null,
      "endTime": "20:35",
      "affectsWindow": true,
      "validFrom": "2026-01-08",
      "validUntil": "2026-06-08",
      "notes": null
    },
    {
      "id": "barn-b-fri-a1",
      "personId": "barn-b",
      "label": "Skola: Ämne 1",
      "weekday": 5,
      "startTime": null,
      "arriveBy": null,
      "leaveBy": null,
      "endTime": null,
      "affectsWindow": false,
      "validFrom": "2026-01-08",
      "validUntil": "2026-06-08",
      "notes": null
    },
    {
      "id": "barn-b-fri-a7",
      "personId": "barn-b",
      "label": "Aktivitet G",
      "weekday": 5,
      "startTime": "16:20",
      "arriveBy": "15:50",
      "leaveBy": null,
      "endTime": "17:20",
      "affectsWindow": true,
      "validFrom": "2026-01-08",
      "validUntil": "2026-06-08",
      "notes": null
    },
    {
      "id": "barn-b-sun-a8",
      "personId": "barn-b",
      "label": "Aktivitet H",
      "weekday": 7,
      "startTime": "14:35",
      "arriveBy": null,
      "leaveBy": null,
      "endTime": "16:35",
      "affectsWindow": true,
      "validFrom": "2026-01-08",
      "validUntil": "2026-06-08",
      "notes": null
    },
    {
      "id": "barn-b-mon-a9",
      "personId": "barn-b",
      "label": "Skola: Ämne 2",
      "weekday": 1,
      "startTime": null,
      "arriveBy": null,
      "leaveBy": null,
      "endTime": null,
      "affectsWindow": false,
      "validFrom": "2026-01-08",
      "validUntil": "2026-06-08",
      "notes": null
    },
    {
      "id": "barn-b-mon-a1",
      "personId": "barn-b",
      "label": "Skola: Ämne 1",
      "weekday": 1,
      "startTime": null,
      "arriveBy": null,
      "leaveBy": null,
      "endTime": null,
      "affectsWindow": false,
      "validFrom": "2026-01-08",
      "validUntil": "2026-06-08",
      "notes": null
    },
    {
      "id": "barn-b-mon-a10",
      "personId": "barn-b",
      "label": "Aktivitet I",
      "weekday": 1,
      "startTime": "17:50",
      "arriveBy": "17:35",
      "leaveBy": null,
      "endTime": "18:50",
      "affectsWindow": true,
      "validFrom": "2026-01-08",
      "validUntil": "2026-06-08",
      "notes": null
    },
    {
      "id": "barn-a-fri-a1-ht26",
      "personId": "barn-a",
      "label": "Skola: Ämne 1",
      "weekday": 5,
      "startTime": null,
      "arriveBy": null,
      "leaveBy": null,
      "endTime": null,
      "affectsWindow": false,
      "validFrom": "2026-08-24",
      "validUntil": null,
      "notes": null
    },
    {
      "id": "barn-a-fri-a2-ht26",
      "personId": "barn-a",
      "label": "Aktivitet B",
      "weekday": 5,
      "startTime": "17:50",
      "arriveBy": "17:35",
      "leaveBy": null,
      "endTime": "19:05",
      "affectsWindow": true,
      "validFrom": "2026-08-24",
      "validUntil": null,
      "notes": null
    },
    {
      "id": "barn-a-sun-a3-ht26",
      "personId": "barn-a",
      "label": "Aktivitet C",
      "weekday": 7,
      "startTime": "12:20",
      "arriveBy": "12:05",
      "leaveBy": null,
      "endTime": "13:50",
      "affectsWindow": true,
      "validFrom": "2026-08-24",
      "validUntil": null,
      "notes": null
    },
    {
      "id": "barn-a-sun-a4-ht26",
      "personId": "barn-a",
      "label": "Aktivitet D",
      "weekday": 7,
      "startTime": "18:05",
      "arriveBy": "17:50",
      "leaveBy": null,
      "endTime": "19:35",
      "affectsWindow": true,
      "validFrom": "2026-08-24",
      "validUntil": null,
      "notes": null
    },
    {
      "id": "barn-a-mon-a1-ht26",
      "personId": "barn-a",
      "label": "Skola: Ämne 1",
      "weekday": 1,
      "startTime": null,
      "arriveBy": null,
      "leaveBy": null,
      "endTime": null,
      "affectsWindow": false,
      "validFrom": "2026-08-24",
      "validUntil": null,
      "notes": null
    },
    {
      "id": "barn-a-mon-a5-ht26",
      "personId": "barn-a",
      "label": "Aktivitet E",
      "weekday": 1,
      "startTime": "18:20",
      "arriveBy": null,
      "leaveBy": null,
      "endTime": "20:20",
      "affectsWindow": true,
      "validFrom": "2026-08-24",
      "validUntil": null,
      "notes": null
    },
    {
      "id": "barn-a-wed-a6-ht26",
      "personId": "barn-a",
      "label": "Aktivitet F",
      "weekday": 3,
      "startTime": "19:05",
      "arriveBy": "18:50",
      "leaveBy": null,
      "endTime": "20:35",
      "affectsWindow": true,
      "validFrom": "2026-08-24",
      "validUntil": null,
      "notes": null
    },
    {
      "id": "barn-b-fri-a1-ht26",
      "personId": "barn-b",
      "label": "Skola: Ämne 1",
      "weekday": 5,
      "startTime": null,
      "arriveBy": null,
      "leaveBy": null,
      "endTime": null,
      "affectsWindow": false,
      "validFrom": "2026-08-24",
      "validUntil": null,
      "notes": null
    },
    {
      "id": "barn-b-fri-a7-ht26",
      "personId": "barn-b",
      "label": "Aktivitet G",
      "weekday": 5,
      "startTime": "16:20",
      "arriveBy": "15:50",
      "leaveBy": null,
      "endTime": "17:20",
      "affectsWindow": true,
      "validFrom": "2026-08-24",
      "validUntil": null,
      "notes": null
    },
    {
      "id": "barn-b-sun-a8-ht26",
      "personId": "barn-b",
      "label": "Aktivitet H",
      "weekday": 7,
      "startTime": "14:35",
      "arriveBy": null,
      "leaveBy": null,
      "endTime": "16:35",
      "affectsWindow": true,
      "validFrom": "2026-08-24",
      "validUntil": null,
      "notes": null
    },
    {
      "id": "barn-b-mon-a9-ht26",
      "personId": "barn-b",
      "label": "Skola: Ämne 2",
      "weekday": 1,
      "startTime": null,
      "arriveBy": null,
      "leaveBy": null,
      "endTime": null,
      "affectsWindow": false,
      "validFrom": "2026-08-24",
      "validUntil": null,
      "notes": null
    },
    {
      "id": "barn-b-mon-a1-ht26",
      "personId": "barn-b",
      "label": "Skola: Ämne 1",
      "weekday": 1,
      "startTime": null,
      "arriveBy": null,
      "leaveBy": null,
      "endTime": null,
      "affectsWindow": false,
      "validFrom": "2026-08-24",
      "validUntil": null,
      "notes": null
    },
    {
      "id": "barn-b-mon-a10-ht26",
      "personId": "barn-b",
      "label": "Aktivitet I",
      "weekday": 1,
      "startTime": "17:50",
      "arriveBy": "17:35",
      "leaveBy": null,
      "endTime": "18:50",
      "affectsWindow": true,
      "validFrom": "2026-08-24",
      "validUntil": null,
      "notes": null
    }
  ]
}
