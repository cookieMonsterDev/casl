import { AbilityBuilder, defineAbility, Ability, createMongoAbility } from '../src'
import { Post, ruleToObject } from './fixtures'

describe(AbilityBuilder.name, () => {
  describe('by default', () => {
    it('allows to construct rules using helper `can` and `cannot` functions', () => {
      const b = new AbilityBuilder(createMongoAbility)
      b.can('read', 'Post')
      b.cannot('read', 'User')

      expect(b.rules).toEqual([
        { action: 'read', subject: 'Post' },
        { action: 'read', subject: 'User', inverted: true },
      ])
    })

    it('allows to specify multiple actions', () => {
      const b = new AbilityBuilder(createMongoAbility)
      b.can(['read', 'update'], 'Post')

      expect(b.rules).toEqual([
        { action: ['read', 'update'], subject: 'Post' }
      ])
    })

    it('allows to specify multiple subjects', () => {
      const b = new AbilityBuilder(createMongoAbility)
      b.can('read', ['Post', 'User'])

      expect(b.rules).toEqual([
        { action: 'read', subject: ['Post', 'User'] }
      ])
    })

    it('allows to pass class or constructor function as a subject parameter to `can` and `cannot`', () => {
      const b = new AbilityBuilder(createMongoAbility)
      b.can('read', Post)
      b.cannot('read', Post, { published: false })

      expect(b.rules).toEqual([
        { action: 'read', subject: Post },
        { inverted: true, action: 'read', subject: Post, conditions: { published: false } }
      ])
    })

    it('allows to build claim based rules (without subjects)', () => {
      const b = new AbilityBuilder(Ability)
      b.can('read')
      b.can('write')
      b.cannot('delete')

      expect(b.rules).toEqual([
        { action: 'read' },
        { action: 'write' },
        { action: 'delete', inverted: true }
      ])
    })

    it('allows to define rules with conditions', () => {
      const b = new AbilityBuilder(createMongoAbility)
      b.can('read', 'Post', { author: 'me' })
      b.cannot('read', 'Post', { private: true })

      expect(b.rules).toEqual([
        { action: 'read', subject: 'Post', conditions: { author: 'me' } },
        { action: 'read', subject: 'Post', conditions: { private: true }, inverted: true },
      ])
    })

    it('allows to define rules with fields', () => {
      const b = new AbilityBuilder(createMongoAbility)
      b.can('read', 'Post', ['title', 'id'])

      expect(b.rules).toEqual([
        { action: 'read', subject: 'Post', fields: ['title', 'id'] }
      ])
    })

    it('allows to define rules with fields and conditions', () => {
      const b = new AbilityBuilder(createMongoAbility)
      b.can('read', 'Post', ['title'], { private: true })

      expect(b.rules).toEqual([
        { action: 'read', subject: 'Post', fields: ['title'], conditions: { private: true } }
      ])
    })

    it('allows to define forbidden rule with the reason', () => {
      const reason = 'is private'
      const b = new AbilityBuilder(createMongoAbility)
      b.can('read', 'Book')
      b.cannot('read', 'Book', { private: true }).because(reason)

      expect(b.rules).toEqual([
        {
          action: 'read',
          subject: 'Book'
        },
        {
          inverted: true,
          action: 'read',
          subject: 'Book',
          conditions: { private: true },
          reason
        }
      ])
    })
  })

  it('can create Ability instance from a factory function', () => {
    const factory = jest.fn(createMongoAbility)
    const { can, build, rules } = new AbilityBuilder(factory)
    const options = {}
    can('read', 'Post')
    build(options)

    expect(factory).toHaveBeenCalledWith(rules, options)
  })

  it('can create Ability instance from a factory arrow function', () => {
    const factorySpy = jest.fn()
    const factory = (...args: Parameters<typeof createMongoAbility>) => {
      factorySpy(...args)
      return createMongoAbility(...args)
    }
    const { can, build, rules } = new AbilityBuilder(factory)
    const options = {}
    can('read', 'Post')
    build(options)

    expect(factorySpy).toHaveBeenCalledWith(rules, options)
  })

  describe(defineAbility.name, () => {
    it('defines `Ability` instance using DSL', () => {
      const ability = defineAbility((can, cannot) => {
        can('read', 'Book')
        cannot('read', 'Book', { private: true })
      })

      expect(ability).toBeInstanceOf(Ability)
      expect(ability.rules.map(ruleToObject)).toEqual([
        { action: 'read', subject: 'Book' },
        { inverted: true, action: 'read', subject: 'Book', conditions: { private: true } }
      ])
    })

    it('returns `Promise<Ability>` when used async DSL', async () => {
      const ability = await defineAbility(async (can, cannot) => {
        can('read', 'Book')
        cannot('read', 'Book', { private: true })
      })

      expect(ability).toBeInstanceOf(Ability)
      expect(ability.rules.map(ruleToObject)).toEqual([
        { action: 'read', subject: 'Book' },
        { inverted: true, action: 'read', subject: 'Book', conditions: { private: true } }
      ])
    })

    it('accepts options for `Ability` instance as the 2nd parameter', () => {
      const detectSubjectType = (subject: string | Record<string, unknown>) => (
        typeof subject === 'string' ? subject : String(subject.ModelName)
      )
      const ability = defineAbility((can) => {
        can('read', 'Book')
      }, { detectSubjectType })

      expect(ability.can('read', { ModelName: 'Book' })).toBe(true)
    })
  })
})
