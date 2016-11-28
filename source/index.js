#!/usr/bin/env node
'use strict'

const scrape = require(`./scrape_operations`)
const { firebase, expire, normalize, update } = require(`./database_operations`)
const { app } = firebase

const run = types => Promise.all(types.map(scrape))
  .then(results => results.reduce((accumulator, result) => [...accumulator, ...result], []))
  .then(results => results.map(normalize))    
  .then(results => Promise.all(results.map(update)))
  .then(results => results.map(result => result.id))
  .then(results => expire(results))
  .then(() => console.log(`
  
  Finished scrape and DB update!

  `))  
  .catch(console.error)
  .then(() => app.delete())  

module.exports = run