#!/usr/bin/env node
const fetch = require(`node-fetch`)
const osmosis = require(`osmosis`)
const { app, database } = require(`./database.js`)
const { log, error, info } = console

const parse = (dataField, parseFunction) => dataField ? parseFunction(dataField) : null

const normalize = data => new Promise(resolve => {
  const color = parse(data.color, color => color.split(`, `).map(color => color ? color.toUpperCase() : ``))
  const species = parse(data.species, species => {
    const uppercased = species.toUpperCase()
    if (uppercased === `PUPPY`) return `DOG`
    else if (uppercased === `KITTEN`) return `CAT`
    else return uppercased.replace(` `, `_`)
  })

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

  const normalizedData = Object.assign({}, data, {
    adopt_fee,    
    age,    
    color,    
    sex,
    species,
    weight
  })

  resolve(normalizedData)
})

const sendToDB = data => database.ref(`animals/${ data.id }`).set(data)

const clearOldEntries = (newKeys, data) => {
   log(`
  
  starting to clear old entries
  
  `)
  return fetch(`https://humane-society-scrape.firebaseio.com/animals.json?shallow=true`)
    .then(response => response.json())    
    .then(result => {
      try {
        const keys = Object.keys(result)
        return keys
      }
      catch(error) {
        return []
      }
    })
    .then(oldKeys => oldKeys.filter(key => !newKeys.includes(key)))
    .then(keysToRemove => {
      return Promise.all(keysToRemove.map(key => {
        return database.ref(`animals/${key}`).remove()
      }))
    })
    .then(() => data)
}


const scrape = type => {
  const url = `http://www.oregonhumane.org/adopt/?type=${type}`
  let results = []

  return new Promise((resolve, reject) => osmosis
  .get(url)
  .find(`div.result-item > a`)
  .follow(`@href`) // follow links to each indiviudal animal's listing page
  .find(`.animal-details`)
  .set({
    description: `.detail-desc p`,          
    image_url: `.detail-image img @src`
  })
  .find(`.detail-text`).set({ name: `h2` })
  .find(`.detail-stats table tbody`)
  .set({ /** @see below for explanation of this crazy xPath syntax */
    adopt_fee: `//*[text()[contains(., 'Adopt Fee')]]/parent::tr/*[last()]`,
    age: `//*[text()[contains(., 'Age')]]/parent::tr/*[last()]`,
    breed: `//*[text()[contains(., 'Breed')]]/parent::tr/*[last()]`,
    color: `//*[text()[contains(., 'Color')]]/parent::tr/*[last()]`,
    date_available: `//*[text()[contains(., 'Date Available')]]/parent::tr/*[last()]`,
    id: `tr[last()] td`,
    sex: `//*[text()[contains(., 'Sex')]]/parent::tr/*[last()]`,
    species: `//*[text()[contains(., 'Type')]]/parent::tr/*[last()]`,
    weight: `//*[text()[contains(., 'Weight')]]/parent::tr/*[last()]`
  })
  .then((context, data, next) => {
    results.push(normalize(data))
    next(context, data)
  })
  .done(() => resolve(Promise.all(results)))
  .error(reject)
)}


// const types = [`small`, `horsefarm`, `dogs`, `cats`]
const types = [`small`, `horsefarm`]
const promises = types.map(scrape)
const update = () => Promise.all(promises)
  .then(results => results.reduce((accumulator, part) => {
    return [...accumulator, ...part]
  }, []))  
  .then(results => clearOldEntries(results.map(result => result.id), results))
  .then(results => Promise.all(results.map(sendToDB)))
  .then(() => app.delete())
  .catch(error)

update()














/**
 * https://msdn.microsoft.com/en-us/library/ms256060(v=vs.110).aspx
 * The xPath pattern below translates to something like this in English:
 *  //                           current context
 *  *                            find all
 *  [text()]                     text nodes
 *  [contains(., someString)]    that contain someString exactly
 *  /parent::tr                  go up to the nearest parent <tr>
 *  /*[last()]                   find the last node in the hierarchy
 * 
 * the DOM structure looks like this:
 * 
 * <div class="detail-stats">
 *  <table>
 *      <tbody>
 *          <tr>
 *              <th>Date Available</th>
 *              <td>11/13/2016</td>             <---- The xPath gets this value
 *          </tr>
 *      </tbody>
 *  </table>
 * </div>
 */