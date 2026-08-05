import { describe, it, expect } from 'vitest'
import { buildRecipeUrl, parseRecipeHash, parseRecipePath, recipeHash, recipePath } from './recipeLink'

describe('buildRecipeUrl', () => {
  it('builds an absolute link on the app base path, with a trailing slash', () => {
    expect(buildRecipeUrl('ugnsbakad-lax', 'https://daniel-oster.github.io', '/matracet/'))
      .toBe('https://daniel-oster.github.io/matracet/recept/ugnsbakad-lax/')
  })

  it('tolerates a base without a trailing slash', () => {
    expect(buildRecipeUrl('tacos', 'http://localhost:4321', '/matracet'))
      .toBe('http://localhost:4321/matracet/recept/tacos/')
  })

  it('encodes a slug so it survives being pasted anywhere', () => {
    expect(buildRecipeUrl('a b', 'https://x.test', '/')).toBe('https://x.test/recept/a%20b/')
  })
})

describe('recipePath', () => {
  it('builds a path for an open recipe', () => {
    expect(recipePath('tacos', '/matracet/')).toBe('/matracet/recept/tacos/')
  })

  it('tolerates a base without a trailing slash', () => {
    expect(recipePath('tacos', '/matracet')).toBe('/matracet/recept/tacos/')
  })

  it('is just the base path when no recipe is open', () => {
    expect(recipePath(null, '/matracet/')).toBe('/matracet/')
  })
})

describe('parseRecipePath', () => {
  it('reads the slug out of a recipe path', () => {
    expect(parseRecipePath('/matracet/recept/ugnsbakad-lax/', '/matracet/')).toBe('ugnsbakad-lax')
  })

  it('tolerates a missing trailing slash', () => {
    expect(parseRecipePath('/matracet/recept/tacos', '/matracet/')).toBe('tacos')
  })

  it('decodes an encoded slug', () => {
    expect(parseRecipePath('/matracet/recept/a%20b/', '/matracet/')).toBe('a b')
  })

  it('round-trips with recipePath', () => {
    expect(parseRecipePath(recipePath('korv-stroganoff', '/matracet/'), '/matracet/')).toBe('korv-stroganoff')
  })

  it('ignores a path outside the app base, or with no slug', () => {
    expect(parseRecipePath('/other/recept/tacos/', '/matracet/')).toBeNull()
    expect(parseRecipePath('/matracet/', '/matracet/')).toBeNull()
    expect(parseRecipePath('/matracet/veckan', '/matracet/')).toBeNull()
    expect(parseRecipePath('/matracet/recept/', '/matracet/')).toBeNull()
  })
})

describe('parseRecipeHash', () => {
  it('reads the slug out of a recipe hash', () => {
    expect(parseRecipeHash('#recept/ugnsbakad-lax')).toBe('ugnsbakad-lax')
  })

  it('works without the leading #', () => {
    expect(parseRecipeHash('recept/tacos')).toBe('tacos')
  })

  it('decodes an encoded slug', () => {
    expect(parseRecipeHash('#recept/a%20b')).toBe('a b')
  })

  it('ignores an empty, unrelated or slug-less hash', () => {
    expect(parseRecipeHash('')).toBeNull()
    expect(parseRecipeHash('#')).toBeNull()
    expect(parseRecipeHash('#veckan')).toBeNull()
    expect(parseRecipeHash('#recept/')).toBeNull()
    expect(parseRecipeHash('#recept/   ')).toBeNull()
  })
})

describe('recipeHash', () => {
  it('round-trips with parseRecipeHash', () => {
    expect(parseRecipeHash(recipeHash('korv-stroganoff'))).toBe('korv-stroganoff')
  })

  it('is empty when no recipe is open', () => {
    expect(recipeHash(null)).toBe('')
  })
})
