const { Buffer } = require('buffer')
const { v4: uuidv4, parse: uuidparse } = require('uuid')
const anchor = require('@coral-xyz/anchor')
const { Keypair, PublicKey, Transaction, Ed25519Program, SYSVAR_INSTRUCTIONS_PUBKEY, SystemProgram } = require('@solana/web3.js')
const { TOKEN_PROGRAM_ID } = require('@solana/spl-token')
const jsSHA = require('jssha')
const bs58 = require('bs58')
const BitSet = require('bitset')
const borsh = require('borsh')
const bufLayout = require('buffer-layout')
const base64js = require('base64-js')
//const fetch = require('node-fetch')
const N3 = require('N3')
const { namedNode, literal, quad } = N3.DataFactory

const { ListingClient, ObjectBuilder, abstractDefinitionMap, getBeginningOfDay, graphToJsonld } = require('@atellix/catalog')

const { programAddress, associatedTokenAddress, jsonFileRead, importSecretKey } = require('../../js/atellix-common')

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
    const baseUri = 'http://example.com/event/'
    const obj = {
        id: baseUri + '1',
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

    const objText = await graphToJsonld(store, baseUri)
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
    const li = await lc.getListingInstructions(listingUrl, listingSpec, provider.wallet.publicKey, walletTokenPK)
    console.log(li)
    console.log(await lc.sendListingInstructions(li))
}

console.log('Begin')
main().then(() => console.log('Success')).catch(error => {
    console.log(error)
})
