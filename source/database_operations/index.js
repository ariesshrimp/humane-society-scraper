#!/usr/bin/env node
'use strict'


// Allows const {format, clear_expired, database} = require(`./scrape_operations`)
module.exports = 
    { format: require(`./format.js`)
    , update: require(`./update.js`)
    , expire: require(`./expire.js`)
    , firebase: require(`./database.js`)
    }