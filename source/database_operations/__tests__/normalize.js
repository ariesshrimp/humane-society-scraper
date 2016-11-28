const normalize = require(`../normalize`)

describe(`normalize`, () => {
  it(`should properly handle empty fields`, () => {
    const actual = normalize({})
    const expected = {
      adopt_fee: null,
      age: null,
      color: null,
      sex: null,
      species: null,
      weight: null
    }
    expect(actual).toEqual(expected)
  })
})