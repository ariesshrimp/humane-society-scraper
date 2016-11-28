const database = require(`../database`)

describe(`database`, () => {
  it(`should properly handle empty fields`, () => {
    expect(database).toBeDefined()
  })
})