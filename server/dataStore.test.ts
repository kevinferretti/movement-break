import { describe, expect, it } from 'vitest'
import {
  createEmptyData,
  importLocalEntries,
  normalizeImportedEntries,
  upsertUserFromOAuth,
} from './dataStore'

describe('normalizeImportedEntries', () => {
  it('accepts valid local movement entries', () => {
    const entries = normalizeImportedEntries(
      [
        {
          id: 'local-1',
          movement: 'pushups',
          reps: 20,
          completedAt: '2026-05-27T17:00:00.000Z',
        },
        {
          id: 'local-2',
          movement: 'pullups',
          reps: 5,
          completedAt: '2026-05-27T18:00:00.000Z',
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
      {
        id: 'local-2',
        movement: 'pullups',
        reps: 5,
        completedAt: '2026-05-27T18:00:00.000Z',
      },
    ])
  })

  it('rejects deadlift entries', () => {
    expect(() =>
      normalizeImportedEntries(
        [
          {
            id: 'local-1',
            movement: 'deadlifts',
            reps: 8,
            completedAt: '2026-05-27T19:00:00.000Z',
          },
        ],
        new Date('2026-05-28T17:00:00.000Z'),
      ),
    ).toThrow('Movement must be pushups or pullups')
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
    expect(data.entries).toHaveLength(1)
    expect(data.entries[0]).toMatchObject({
      userId: user.id,
      reps: 100,
      source: 'local_import',
    })
  })
})
