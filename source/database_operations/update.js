#!/usr/bin/env node
'use strict'


const { database } = require(`./database.js`)


const update = record => database.ref(`animals/${ record.id }`)
    .update(record)
    .then(() => record) // pass the original record back through because update returns undefined


module.exports = update