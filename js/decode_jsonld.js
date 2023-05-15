const { Buffer } = require('buffer')
const { v4: uuidv4, parse: uuidparse, stringify: uuidstr } = require('uuid')
const anchor = require('@coral-xyz/anchor')
const { PublicKey, SystemProgram } = require('@solana/web3.js')
const jsSHA = require('jssha')
const bs58 = require('bs58')
const BitSet = require('bitset')
//const { TOKEN_PROGRAM_ID } = require('@solana/spl-token')
//const { promisify } = require('util')
//const exec = promisify(require('child_process').exec)
//const fs = require('fs').promises

const { fetchJson, jsonldToGraph, ObjectBuilder, abstractDefinitionMap } = require('@atellix/catalog')

const { jsonFileRead } = require('../../js/atellix-common')

const builder = new ObjectBuilder(abstractDefinitionMap)

async function main() {
    const jsonData = await jsonFileRead('input.jsonld')
    console.log(jsonData)
    const jstxt = JSON.stringify(jsonData)
    //console.log(jstxt)
    const graph = await jsonldToGraph(jstxt)
    const mainId = 'http://example.com/events/123'
    const jsres = builder.decodeResource(graph, mainId, {})
    console.log(jsres)
}

console.log('Begin')
main().then(() => console.log('Success')).catch(error => {
    console.log(error)
})
