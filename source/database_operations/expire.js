#!/usr/bin/env node
'use strict'

const fetch = require(`node-fetch`)

const { database } = require(`./database.js`)

const expire = newKeys => {
  console.log(`
  
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
        return database.ref(`animals/${key}`).remove().then(() => key)
      }))
    })
}

module.exports = expire