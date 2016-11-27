#!/usr/bin/env node
'use strict'


const osmosis = require(`osmosis`)


/**
 * The human society divides its site up into a few pages storing different general groups of animals.
 * @see http://www.oregonhumane.org/adopt/?type=small or
 * @see http://www.oregonhumane.org/adopt/?type=dog
 * So a function is needed to repeat the scrape process on any given page (or for a given animal type).
 * @param {string} type - a string representing the kind of animal being scraped for.
 * @return {object} osmosis - the scraper instance. not very useful for returning.
 */
const scrape = type => {
  const url = `http://www.oregonhumane.org/adopt/?type=${ type }`
  const results = []
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
    .set({
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
    .data(data => results.push(data))
    .done(() => resolve(results))  // pass the data off to then() somewhere else
    .error(reject)  // pass errors off to catch() somewhere else
)} 


/**
 * Explanation of weird xPath shit in the set() block above ^
 * @see https://msdn.microsoft.com/en-us/library/ms256060(v=vs.110).aspx
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

module.exports = scrape