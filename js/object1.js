const { Buffer } = require('buffer')
const { v4: uuidv4, parse: uuidparse } = require('uuid')
const anchor = require('@project-serum/anchor')
const { Keypair, PublicKey, Transaction, Ed25519Program, SYSVAR_INSTRUCTIONS_PUBKEY, SystemProgram } = require('@solana/web3.js')
const { TOKEN_PROGRAM_ID } = require('@solana/spl-token')
const jsSHA = require('jssha')
const bs58 = require('bs58')
const BitSet = require('bitset')
const borsh = require('borsh')
const bufLayout = require('buffer-layout')
const base64js = require('base64-js')
const fetch = require('node-fetch')
const N3 = require('N3')
const { namedNode, literal, quad } = N3.DataFactory

const { ObjectBuilder, abstractDefinitionMap, getBeginningOfDay } = require('@atellix/catalog')
const builder = new ObjectBuilder(abstractDefinitionMap)

//const { promisify } = require('util')
//const exec = promisify(require('child_process').exec)
//const fs = require('fs').promises

const { programAddress, associatedTokenAddress, jsonFileRead, importSecretKey } = require('../../js/atellix-common')

const provider = anchor.AnchorProvider.env()
anchor.setProvider(provider)
const catalogProgram = anchor.workspace.Catalog
const catalogProgramPK = catalogProgram.programId

async function main() {
    console.log('Main')
    const type = 'IEvent'
    const obj = {
        id: 'http://example.com/event/1',
        name: 'Birthday Party',
        description: 'Mikes Birthday Party',
        duration: '1 Hour',
        startDate: getBeginningOfDay(new Date()),
        image: [
            {
                url: 'https://www.gravatar.com/avatar/c9cb338a29d608d33e16ff3f2e7f9635?s=64&d=identicon&r=PG',
                image: [
                    { url: 'https://www.gravatar.com/avatar/c9cb338a29d608d33e16ff3f2e7f9635?s=64&d=identicon&r=PG' },
                ],
            }
        ],
    }
    console.log(obj)
    const store = new N3.Store()
    builder.buildResource(store, type, obj.id, obj, {})
    const writer = new N3.Writer({
        prefixes: {
            'rdf': 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
            'schema': 'http://schema.org/',
            'catalog': 'http://rdf.atellix.com/schema/catalog/',
        }
    })
    store.forEach((q) => {
        writer.addQuad(q)
    })
    writer.end((error, result) => console.log(result))
    const rsrc = builder.decodeResource(store, type, obj.id, {})
    console.log(JSON.stringify(rsrc, null, 4))
}

console.log('Begin')
main().then(() => console.log('Success')).catch(error => {
    console.log(error)
})
