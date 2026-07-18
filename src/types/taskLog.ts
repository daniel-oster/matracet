/**
 * Shape of the git-tracked public/data/task-log.json — the device's acknowledgment channel
 * for the intelligence-queue tasks it appends to matracet:synctasks:v1 (see
 * src/hooks/useSyncTasks.ts and CLAUDE.md's "GitHub-backed auto-sync" Phase 5). Written by an
 * interactive Claude Code session running the .claude/skills/run-sync-tasks/ skill, read by
 * every device on its next static-data fetch (the same mechanism as feedback.json, not routed
 * through device-sync — see src/lib/syncTaskOutcomes.ts for why that matters).
 */
export interface TaskLogEntry {
  id: string
  type: string
  processedAt: string
  outcome: 'applied' | 'skipped' | 'not-found'
  /** Type-specific payload a device applies locally — e.g. resolve-manual-item's result is
   * `{ vara: string, offerRef: { store: string, week: string } }`. Absent for a 'skipped' or
   * 'not-found' outcome. */
  result?: unknown
}

export interface TaskLogFile {
  app?: 'matracet'
  version?: number
  entries: TaskLogEntry[]
}
