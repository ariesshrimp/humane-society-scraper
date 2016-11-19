#!/usr/bin/env node
const fetch = require(`node-fetch`)
const osmosis = require(`osmosis`)
const { app, database } = require(`./database.js`)


/**
 * You need a safety function because the Humane Society data is sometimes missing fields.
 * This is used extensively in the data() structure call below to properly format untamed
 * data structures before sending them to the database.
 * 
 * @param {any} dataField - the result of an attempted property access on a data object.
 * @param {function} parseFunction - a function for deciding how to improve the given data field
 * 
 * @return {any} - the result of the given parse function, or else null (in case no such field exists)
 */
const parse = (dataField, parseFunction) => dataField ? parseFunction(dataField) : null

/** 
 * A simple store for comparing the keys of yesterday's entries with todays.
 * This is used to decide whether an animal should be removed from the database:
 * if it has 'disappeard' from the website.
 */
const newEntries = []

/**
 * Reformat all the results into well-structured data for the database.
 * Some of the values may be missing if the Humane Society hasn't been able
 * to determine the information yet, or if the species makes knowing
 * the answer too difficult / impossible (e.g. bird weight)
 * 
 * @param {object} data - an in memory representation of an animal from a scrape result
 * 
 * @return {object} newEntry - a reference to a Firebase object containing updated fields. 
 */
const updateDB = data => {
  const color = parse(data.color, color => color.split(`, `).map(color => color ? color.toUpperCase() : ``))
  const species = parse(data.species, species => {
    const uppercased = species.toUpperCase()
    if (uppercased === `PUPPY`) return `DOG`
    else if (uppercased === `KITTEN`) return `CAT`
    else return uppercased.replace(` `, `_`)
  })

    /**
     * adopt_fee, age, and weight can all fail parseFloat, so they require a fallback return value.
     * sex can effectively fail if the humane soceity is unable to determine the sex easily (such as with birds) 
     * I've decided to use null
     */
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

    /**
     * Get a new structure with the formated values updated
     */
  const improvedData = Object.assign({}, data, {
    adopt_fee,    
    age,    
    color,
    friends: [], // TODO:jmf implement this. It doesn't look like there's a well-structured dataset for friend connections.    
    sex,
    species,
    weight
  })

    /**
     * Index the new id to cross check for clearing old entries
     */
  newEntries.push(improvedData.id)
  const newEntry = database.ref(`animals/${ improvedData.id }`).update(improvedData)
  return newEntry
}

/**
 * Cross reference the newly found animal ID's witht those that existed when we started 
 * and remove all the animals that have been removed since the last update
 * 
 * @param {array} newKeys - a list of unique animal ID's we've acquired during the most recent scrap
 * 
 * @return {promise} - a promise to kill any animals in the old set not in the newest data set.
 */
const clearOldEntries = newKeys => {
  console.log(`
  
  starting to clear old entries
  
  `)
  return fetch(`https://humane-society-scrape.firebaseio.com/animals.json?shallow=true`)
    .then(response => response.json())
    .then(Object.keys)
    .then(oldKeys => oldKeys.filter(key => !newKeys.includes(key)))
    .then(keysToRemove => {
      return Promise.all(keysToRemove.map(key => {
        return database.ref(`animals/${key}`).remove()
      }))
    })
}


/**
 * The human society divides its site up into a few pages storing different general groups of animals.
 * @see http://www.oregonhumane.org/adopt/?type=small or
 * @see @see http://www.oregonhumane.org/adopt/?type=dog
 * 
 * So a function is needed to repeat the scrape process on any given page (or for a given animal type).
 * 
 * @param {string} type - a string representing the kind of animal being scraped for.
 * 
 * @return {object} osmosis - the scraper instance. not very useful for returning.
 */
const scrape = type => {
  const url = `http://www.oregonhumane.org/adopt/?type=${type}`

  return new Promise((resolve, reject) => osmosis
  .get(url)
  .find(`div.result-item > a`)
  .follow(`@href`) // follow links to each indiviudal animal's listing page

  .find(`.animal-details`)
  .set({
    description: `.detail-desc p`,          
    image: `.detail-image img @src`
  })

  .find(`.detail-text`).set({ name: `h2` })

  .find(`.detail-stats table tbody`)
  .set({
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
  .data(updateDB) // Send each individual animal to the DB 
  .log(console.log)
  .debug(console.info)  
  .done(resolve)  
  .error(reject)
)}


const types = [`small`, `horsefarm`, `dogs`, `cats`]
const promises = types.map(scrape)
const update = () => Promise.all(promises)
  .then(() => {
    console.log(`

  All the promises are done!

`)
    return app.delete()
  })
// ^ app.delete() tells firebase to close open sockets and clear the resources,
// allowing the node process to properly exit when finished.
  .catch(error => console.error(`

  Something weird happened...
  ${ error }
`))

update()