import { describe, expect, it } from 'vitest'
import {
  buildLeaderboard,
  createEmptyData,
  importLocalEntries,
  normalizeImportedEntries,
  upsertUserFromOAuth,
} from './dataStore'

describe('normalizeImportedEntries', () => {
  it('accepts valid local pushup entries', () => {
    const entries = normalizeImportedEntries(
      [
        {
          id: 'local-1',
          movement: 'pushups',
          reps: 20,
          completedAt: '2026-05-27T17:00:00.000Z',
        },
      ],
      new Date('2026-05-28T17:00:00.000Z'),
    )

    expect(entries).toEqual([
      {
        id: 'local-1',
        movement: 'pushups',
        reps: 20,
        completedAt: '2026-05-27T17:00:00.000Z',
      },
    ])
  })

  it('rejects duplicate local ids', () => {
    expect(() =>
      normalizeImportedEntries(
        [
          {
            id: 'local-1',
            movement: 'pushups',
            reps: 20,
            completedAt: '2026-05-27T17:00:00.000Z',
          },
          {
            id: 'local-1',
            movement: 'pushups',
            reps: 5,
            completedAt: '2026-05-28T17:00:00.000Z',
          },
        ],
        new Date('2026-05-28T17:00:00.000Z'),
      ),
    ).toThrow('unique ids')
  })
})

describe('importLocalEntries', () => {
  it('only imports local entries once per user', () => {
    const data = createEmptyData()
    const user = upsertUserFromOAuth(data, {
      provider: 'github',
      providerUserId: '123',
      displayName: 'Kevin',
      avatarUrl: null,
      username: 'kevinferretti',
      email: null,
    })

    const firstImport = importLocalEntries(
      data,
      user.id,
      [
        {
          id: 'local-1',
          movement: 'pushups',
          reps: 100,
          completedAt: '2026-05-27T17:00:00.000Z',
        },
      ],
      new Date('2026-05-28T17:00:00.000Z'),
    )
    const secondImport = importLocalEntries(
      data,
      user.id,
      [
        {
          id: 'local-2',
          movement: 'pushups',
          reps: 500,
          completedAt: '2026-05-28T17:00:00.000Z',
        },
      ],
      new Date('2026-05-28T18:00:00.000Z'),
    )

    expect(firstImport).toMatchObject({
      imported: true,
      importedCount: 1,
    })
    expect(secondImport).toMatchObject({
      imported: false,
      importedCount: 0,
    })
    expect(buildLeaderboard(data, new Date('2026-05-28T18:00:00.000Z'))[0]).toMatchObject({
      displayName: 'Kevin',
      totalReps: 100,
      totalBreaks: 1,
    })
  })
})
