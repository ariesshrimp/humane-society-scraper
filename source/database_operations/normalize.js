#!/usr/bin/env node
'use strict'

/**
 * You need a safety function because the Humane Society data is sometimes missing fields.
 * This is used extensively in the data() structure call below to properly format untamed
 * data structures before sending them to the database.
 * @param {any} dataField - the result of an attempted property access on a data object.
 * @param {function} parseFunction - a function for deciding how to improve the given data field
 * @return {any} - the result of the given parse function, or else null (in case no such field exists)
 */
const parse = (dataField, parseFunction) => dataField ? parseFunction(dataField) : null

/**
 * Reformat all the results into well-structured data for the database.
 * Some of the values may be missing if the Humane Society hasn't been able
 * to determine the information yet, or if the species makes knowing
 * the answer too difficult / impossible (e.g. bird weight)
 * @param {object} data - an in memory representation of an animal from a scrape result
 * @return {object} newEntry - a reference to a Firebase object containing updated fields. 
 */
const normalize = data => {
  const color = parse(data.color, color => color.split(`, `).map(color => color ? color.toUpperCase() : ``))
  const species = parse(data.species, species => {
    const uppercased = species.toUpperCase()
    if (uppercased === `PUPPY`) return `DOG`
    else if (uppercased === `KITTEN`) return `CAT`
    else return uppercased.replace(` `, `_`)
  })

  // adopt_fee, age, and weight can all fail parseFloat, so they require a fallback return value.
  // sex can effectively fail if the humane soceity is unable to determine the sex easily (such as with birds) 
  // I've decided to use null
  const adopt_fee = parse(data.adopt_fee, fee => parseFloat(fee.substring(1) || null))

  const age = parse(data.age, age => age
    .split(` `)
    .map((number, index, array) => {
      if (array[index + 1] === `years`) return parseInt(number) * 12
      if (array[index + 1] === `months`) return parseInt(number)
      else return 0
    })
    .reduce((x, y) => x + y, 0) || null)

  const weight = parse(data.weight, weight => parseFloat(weight) || null)

  const sex = parse(data.sex, sex => {
    const uppercased = sex.toUpperCase()
    if (uppercased === `UNKNOWN`) return null
    else return uppercased
  })

  // Get a new structure with the normalized values updated
  const normalized = Object.assign({}, data, { 
    adopt_fee, 
    age,
    color, 
    sex, 
    species, 
    weight
  })

  return normalized
}

module.exports = normalize