#!/usr/bin/env node
const fetch = require(`node-fetch`)
const osmosis = require(`osmosis`)
const { app, database } = require(`./database.js`)


/**
 * You need a safety function because the Humane Society data is sometimes missing fields.
 * This is used extensively in the data() structure call below to properly format untamed
 * data structures before sending them to the database.
 */ 
const parse = (dataField, parseFunction) => dataField ? parseFunction() : null 

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
 */
const updateDB = data => {
    const color = parse(data.color, () => data.color.split(`, `).map(color => color ? color.toUpperCase() : ``))
    const species = parse(data.species, () => {
        const uppercased = data.species.toUpperCase()
        if (uppercased === `PUPPY`) return `DOG`
        else if (uppercased === `KITTEN`) return `CAT`
        else return uppercased.replace(` `, `_`)
    })

    /**
     * adopt_fee, age, and weight can all fail parseFloat, so they require a fallback return value.
     * sex can effectively fail if the humane soceity is unable to determine the sex easily (such as with birds) 
     * I've decided to use null
     */
    const adopt_fee = parse(data.adopt_fee, () => parseFloat(data.adopt_fee.substring(1) || null))        
    const age = parse(data.age, () => data.age
        .split(` `)
        .map((number, index, array) => {
            if (array[index + 1] === `years`) return parseInt(number) * 12
            if (array[index + 1] === `months`) return parseInt(number)
            else return 0
        })
        .reduce((x, y) => x + y, 0) || null)
    const weight = parse(data.weight, () => parseFloat(data.weight) || null)

    const sex = parse(data.sex, () => {
        const uppercase = data.sex.toUpperCase()
        if (uppercase === `UNKNOWN`) return null 
        else return uppercase
    })

    /**
     * Get a new structure with the formated values updated
     */
    const improvedData = Object.assign({}, data, {
        adopt_fee,
        color,
        sex,
        species,
        age,
        weight,
        friends: [] // TODO:jmf implement this. It doesn't look like there's a well-structured dataset for friend connections.
    })

    /**
     * Index the new id to cross check for clearing old entries
     */
    newEntries.push(improvedData.id)
    return database.ref(`animals/${ improvedData.id }`).update(improvedData)
}

/**
 * Cross reference the newly found animal ID's witht those that existed when we started 
 * and remove all the animals that have been removed since the last update
 */
const clearOldEntries = newKeys => {
    // 
    return fetch(`https://humane-society-scrape.firebaseio.com/animals.json?shallow=true`)
        .then(response => response.json())
        .then(Object.keys)
        .then(oldKeys => oldKeys.filter(key => !newKeys.includes(key)))
        .then(keysToRemove => {
            return Promise.all(keysToRemove.map(key => {
                return database.ref(`animals/${ key }`).remove()
            }))
        })
        // app.delete() tells firebase to close open sockets and clear the resources,
        // allowing the node process to properly exit when finished.
        .then(() => app.delete())
        
}


const scrape = type => {
    const url = `http://www.oregonhumane.org/adopt/?type=${ type }`
    
    osmosis
    .get(url)
    .find(`div.result-item > a`)
    .follow(`@href`) // follow links to each indiviudal animal's listing page

    .find(`.animal-details`)
    .set({
        image: `.detail-image img @src`,
        description: `.detail-desc p`,
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
        date_available: `//*[text()[contains(., 'Date Available')]]/parent::tr/*[last()]`,
        adopt_fee: `//*[text()[contains(., 'Adopt Fee')]]/parent::tr/*[last()]`,
        species: `//*[text()[contains(., 'Type')]]/parent::tr/*[last()]`,
        breed: `//*[text()[contains(., 'Breed')]]/parent::tr/*[last()]`,
        sex: `//*[text()[contains(., 'Sex')]]/parent::tr/*[last()]`,
        color: `//*[text()[contains(., 'Color')]]/parent::tr/*[last()]`,
        age: `//*[text()[contains(., 'Age')]]/parent::tr/*[last()]`,
        weight: `//*[text()[contains(., 'Weight')]]/parent::tr/*[last()]`,
        id: `tr[last()] td`
    })
    .data(updateDB) // Send each individual animal to the DB 

    .done(() => clearOldEntries(newEntries))
    .log(console.log)
    .error(console.error)
    .debug(console.info)
}


const update = types => types.forEach(type => {
    scrape(type)
})

const types = [ `small`, `horsefarm`, `dogs`, `cats` ]  
update(types)