#!/usr/bin/env node
'use strict'

const osmosis = require(`osmosis`)

const scrape = type => {
  const url = `http://www.oregonhumane.org/adopt/?type=${ type }`
  const results = []

  return new Promise((resolve, reject) => osmosis
    .get(url)
    .find(`div.result-item > a`)
    .follow(`@href`) // follow links to each indiviudal animal's listing page
    .find(`.animal-details`).set({
      description: `.detail-desc p`,          
      image_url: `.detail-image img @src`
    })
    .find(`.detail-text`).set({ name: `h2` })
    .find(`.detail-stats table tbody`).set({
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
      results.push(data)
      next(context, data)
    })
    .done(() => resolve(Promise.all(results)))
    .error(reject)
)} 

module.exports = scrape