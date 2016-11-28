#!/usr/bin/env node
'use strict'

const admin = require(`firebase-admin`)
const path = require(`path`)
const CONFIG = path.resolve(__dirname, `config.firebase.json`)

const app = admin.initializeApp({
  credential: admin.credential.cert(CONFIG),
  databaseURL: `https://humane-society-scrape.firebaseio.com`
})

const auth = app.auth()
const database = app.database()

module.exports = { 
  app,
  auth,
  database 
}