#!/usr/bin/env node
'use strict'

module.exports = { 
  expire: require(`./expire.js`),
  firebase: require(`./database.js`),
  normalize: require(`./normalize.js`),
  update: require(`./update.js`)  
}