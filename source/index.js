#!/usr/bin/env node
'use strict'


const CONFIG = require(`./database_operations/config.firebase.json`)
const scrape = require(`./scrape_operations`)
const { auth } = require(`./database_operations`).firebase
const { expire, format, update } = require(`./database_operations`)


const login = () => auth.signInWithEmailAndPassword(CONFIG.email, CONFIG.password)
  .then(user => console.log(`signed in as ${ user.uid }: ${ user.email }`))
  .catch(console.error)


// const types = [`dogs`, `cats`, `horsefarm`, `small`]
// const types = [`horsefarm`, `small`]
// const types = [`all`]
const types = [`horsefarm`]

const run = (types) => login()
  .then(() => Promise.all(types.map(type => {
    return scrape(type).then(results => results.map(format))
  })))  
  .then(results => results.reduce((accumulator, result) => { 
    return [...accumulator, ...result]
  }, []))
  .then(results => {
    return Promise.all(results.map(update))
  })
  .then(results => results.map(result => result.id))
  .then(() => auth.signOut())
  .then(() => console.log(`
  signed out!
`))
  .then(process.exit)
  .catch(error => {
    console.error(`Oops! Looks like you goofed: ${ error }`)
    process.exit()
  })

module.exports = run