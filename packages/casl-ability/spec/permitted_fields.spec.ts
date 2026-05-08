import { defineAbility, createMongoAbility } from '../src'
import { permittedFieldsOf } from '../src/extra'
import { Post } from './fixtures'

describe(permittedFieldsOf.name, () => {
  const defaultOptions = {
    fieldsFrom: (rule: { fields?: string[] }) => rule.fields || ['title', 'description']
  }

  it('returns an empty array for `Ability` with empty rules', () => {
    const ability = createMongoAbility([])

    expect(permittedFieldsOf(ability, 'read', 'Post', defaultOptions)).toEqual([])
  })

  it('returns all fields if none of rules specify fields', () => {
    const ability = defineAbility(can => can('read', 'Post'))
    const fields = permittedFieldsOf(ability, 'read', 'Post', defaultOptions)

    expect(fields).toEqual(['title', 'description'])
  })

  it('returns a unique array of fields if there are duplicated fields across fields', () => {
    const ability = defineAbility((can) => {
      can('read', 'Post', ['title'])
      can('read', 'Post', ['title', 'description'], { id: 1 })
    })
    const fields = permittedFieldsOf(ability, 'read', 'Post', defaultOptions)

    expect(fields).toHaveLength(2)
    expect(fields).toEqual(expect.arrayContaining(['title', 'description']))
  })

  it('returns unique fields for array which contains direct and inverted rules', () => {
    const ability = defineAbility((can, cannot) => {
      can('read', 'Post', ['title', 'description'])
      cannot('read', 'Post', ['description'])
    })
    const fields = permittedFieldsOf(ability, 'read', 'Post', defaultOptions)

    expect(fields).toHaveLength(1)
    expect(fields).toEqual(['title'])
  })

  it('allows to provide an option `fieldsFrom` which extract fields from rule', () => {
    const ability = defineAbility(can => can('read', 'Post'))
    const fields = permittedFieldsOf(ability, 'read', 'Post', {
      fieldsFrom: (rule) => rule.fields || ['title']
    })

    expect(fields).toEqual(['title'])
  })

  describe('when `subject` is an instance', () => {
    it('allows to return fields for specific instance', () => {
      const { ability } = setup()
      const post = new Post({ title: 'does not match conditions' })
      const fields = permittedFieldsOf(ability, 'read', post, defaultOptions)

      expect(fields).toEqual(['title'])
    })

    it('allows to return fields for subject instance which matches specified rule conditions', () => {
      const { ability } = setup()
      const post = new Post({ id: 1, title: 'matches conditions' })
      const fields = permittedFieldsOf(ability, 'read', post, defaultOptions)

      expect(fields).toEqual(['title', 'description'])
    })

    function setup() {
      const ability = defineAbility((can, cannot) => {
        can('read', 'Post', ['title'])
        can('read', 'Post', ['title', 'description'], { id: 1 })
        cannot('read', 'Post', ['description'], { private: true })
      })

      return { ability }
    }
  })
})
