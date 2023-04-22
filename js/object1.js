import { Buffer } from 'buffer'
import { v4 as uuidv4, parse as uuidparse } from 'uuid'
import * as anchor from '@coral-xyz/anchor'
import { Keypair, PublicKey, Transaction, Ed25519Program, SYSVAR_INSTRUCTIONS_PUBKEY, SystemProgram } from '@solana/web3.js'
import { TOKEN_PROGRAM_ID } from '@solana/spl-token'
import jsSHA from 'jssha'
import bs58 from 'bs58'
import BitSet from 'bitset'
import borsh from 'borsh'
import bufLayout from 'buffer-layout'
import base64js from 'base64-js'
import fetch from 'node-fetch'
import N3 from 'N3'
const { namedNode, literal, quad } = N3.DataFactory
import { Readable } from 'readable-stream'
import SerializerJsonld from '@rdfjs/serializer-jsonld-ext'

import { ListingClient, ObjectBuilder, abstractDefinitionMap, getBeginningOfDay, associatedTokenAddress } from '@atellix/catalog'
const builder = new ObjectBuilder(abstractDefinitionMap)

const provider = anchor.AnchorProvider.env()
anchor.setProvider(provider)
const catalogProgram = anchor.workspace.Catalog
const catalogProgramPK = catalogProgram.programId

async function main() {
    console.log('Main')
    const url = 'http://127.0.0.1:7501/api/catalog/listing'
    const feeMint = new PublicKey('USDVXgXZcQWycX4PAu2CZbGaSG1Ft5rNjo4ARpoqw7w')
    const type = 'IEvent'
    const obj = {
        id: 'http://example.com/event/1',
        name: 'Birthday Party',
        description: 'Mikes Birthday Party',
        duration: '1 Hour',
        startDate: getBeginningOfDay(new Date()),
        image: [
            { url: 'https://www.gravatar.com/avatar/c9cb338a29d608d33e16ff3f2e7f9635?s=64&d=identicon&r=PG' },
        ],
        isAccessibleForFree: true,
    }
    //console.log(obj)
    const store = new N3.Store()
    builder.buildResource(store, type, obj.id, obj, {})

    const writer = new SerializerJsonld({
        baseIRI: 'http://example.com/event/',
        context: {
            '@vocab': 'http://schema.org/',
        },
        compact: true,
        encoding: 'object',
        prettyPrint: true,
    })
    const input = new Readable({
        objectMode: true,
        read: () => {
            store.forEach((q) => {
                input.push(q)
            })
            input.push(null)
        }
    })
    const op = new Promise((resolve, reject) => {
        const output = writer.import(input)
        output.on('data', jsonld => {
            resolve(JSON.stringify(jsonld, null, 0))
        })
    })
    const objText = await op
    console.log(objText)

    const walletToken = await associatedTokenAddress(provider.wallet.publicKey, feeMint)
    const walletTokenPK = new PublicKey(walletToken.pubkey)

    const lc = new ListingClient(provider, catalogProgram)
    const listingUrl = 'http://127.0.0.1:7501/api/catalog/listing'
    const listingSpec = lc.getListingSpec({
        catalog: 'commerce',
        base: 'http://173.234.24.74:9500/api/catalog/listing/',
        category: 'http://schema.org/Event',
        label: obj.name,
        detail: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Event",
        }),
        attributes: [
            'InPerson',
        ],
        locality: [
            'https://www.geonames.org/6252001/', // United States
            'https://www.geonames.org/5332921/', // California
            'https://www.geonames.org/5350736/', // Fremont
        ],
        owner: provider.wallet.publicKey,
    })
    //console.log(listingSpec)
    const li = await lc.getListingInstructions(fetch, listingUrl, listingSpec, provider.wallet.publicKey, walletTokenPK)
    console.log(li)
    console.log(await lc.sendListingInstructions(li))
    
    /*const writer = new N3.Writer({
        prefixes: {
            'rdf': 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
            'schema': 'http://schema.org/',
            'catalog': 'http://rdf.atellix.com/schema/catalog/',
        }
    })
    store.forEach((q) => {
        writer.addQuad(q)
    })
    writer.end((error, result) => console.log(result))*/
    //const rsrc = builder.decodeResource(store, type, obj.id, {})
    //console.log(JSON.stringify(rsrc, null, 4))
}

console.log('Begin')
main().then(() => console.log('Success')).catch(error => {
    console.log(error)
})
