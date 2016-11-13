const osmosis = require(`osmosis`)
const database = require(`./database.js`)

/**
 * You need a safety function because the Humane Society data is sometimes missing fields.
 * This is used extensively in the data() structure call below to properly format untamed
 * data structures before sending them to the database.
 */ 
const parse = (dataField, parseFunction) => dataField ? parseFunction() : null 

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

    // For each individual animal...
    .data(data => {
        /**
         * Reformat all the results into well-structured data for the database.
         * Some of the values may be missing if the Humane Society hasn't been able
         * to determine the information yet, or if the species makes knowing
         * the answer too difficult / impossible (e.g. bird weight)
         */
        const color = parse(data.color, () => data.color.split(`, `).map(color => color ? color.toUpperCase() : ``))
        const sex = parse(data.sex, () => data.sex.toUpperCase())
        const species = parse(data.species, () => {
            const uppercased = data.species.toUpperCase()
            if (uppercased === `PUPPY`) return `DOG`
            else if (uppercased === `KITTEN`) return `CAT`
            else return uppercased.replace(` `, `_`)
        })


        /**
         * adopt_fee, age, and weight can all fail parseFloat, so they require a fallback return value. 
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


        /**
         * Get a new structure with the formated values updated
         */
        const improvedData = Object.assign({}, data, {
            adopt_fee,
            color,
            sex,
            species,
            age,
            weight 
        })

        return database.ref(`animals/${ improvedData.species }/${ improvedData.id }`).update(improvedData)  
    })
    // .done(process.exit)
    .log(console.log)
    .error(console.error)
    .debug(console.info)
}


const update = types => types.forEach(type => {
    scrape(type)
})

const types = [ `small`, `horsefarm`, `dogs`, `cats` ]  
update(types)