#!/usr/bin/env node
'use strict'


const fetch = require(`node-fetch`)


const { database, auth } = require(`./database.js`)


/**
 * Cross reference the newly found animal ID's witht those that existed when we started 
 * and remove all the animals that have been removed since the last update.
 * @param {array} newKeys - a list of unique animal ID's we've acquired during the most recent scrap
 * @return {promise} - a promise to kill any animals in the old set not in the newest data set.
 */
const clear_expired = newKeys => {
  console.log(`
  starting to clear old entries
  
  `)
  return fetch(`https://humane-society-scrape.firebaseio.com/animals.json?shallow=true`)
    .then(response => response.json())
    .then(Object.keys)
    .then(keys => {console.log(keys); return keys})
    .then(oldKeys => oldKeys.filter(key => !newKeys.includes(key)))
    .then(keysToRemove => {
      return Promise.all(keysToRemove.map(key => {
        return database.ref(`animals/${ key }`).remove()
      }))
    })
}

module.exports = clear_expired