const { v4: uuidv4, parse: uuidparse } = require('uuid')
const anchor = require('@coral-xyz/anchor')
const { PublicKey } = require('@solana/web3.js')
const { ListingClient, ObjectBuilder, abstractDefinitionMap, getBeginningOfDay, graphToJsonld, jsonldToGraph, getUriForUUID, associatedTokenAddress } = require('@atellix/catalog')
const N3 = require('n3')

const builder = new ObjectBuilder(abstractDefinitionMap)

const provider = anchor.AnchorProvider.env()
anchor.setProvider(provider)
const catalogProgram = anchor.workspace.Catalog
const catalogProgramPK = catalogProgram.programId

async function main() {
    console.log('Main')
    const user = 'a6d8fbbb-e746-4576-8bda-0ca23e0312c3'
    const type = 'IEvent'
    const baseUri = 'http://rdf.solana.com/event/'
    const obj = {
        id: baseUri + 'breakpoint-2023',
        uuid: uuidv4(),
        type: 'IEvent',
        name: 'Breakpoint',
        url: 'https://solana.com/breakpoint',
        description: 'New city. New vibes. A campus for the Solana community.',
        duration: '5 Days',
        startDate: new Date('2023-10-30T00:00:00Z'),
        endDate: new Date('2023-11-03T00:00:00Z'),
        eventSchedule: { url: 'https://solana.com/breakpoint/faq' },
        image: [ { url: 'https://solana.com/_next/image?url=%2F_next%2Fstatic%2Fmedia%2Fconference.6401d4a0.jpg&w=1080&q=75' } ],
        isAccessibleForFree: false,
        keywords: ['solana', 'blockchain', 'cryptocurrency', 'crypto'],
        location: [ {
            'address': {
                'name': 'TAETS Arts and Event Park',
                'addressCountry': 'Netherlands',
                'addressLocality': 'Amsterdam',
                'streetAddress': 'Middenweg 62 Hembrugterrein, 1505RK, Zaandam',
            }
        } ],
        organizer: [ {
            type: 'IOrganization',
            name: 'Solana Foundation',
            url: 'https://solana.org/',
            email: 'breakpoint@solana.org',
            contactPoint: [
                { name: 'Travel', url: 'https://solana.com/breakpoint/travel' },
                { name: 'Press-related inquiries', email: 'press@solana.org' },
            ],
            sameAs: [
                { 'id': 'https://www.youtube.com/SolanaFndn' },
                { 'id': 'https://twitter.com/solana' },
                { 'id': 'https://discord.com/invite/kBbATFA7PW' },
                { 'id': 'https://www.reddit.com/r/solana' },
                { 'id': 'https://github.com/solana-labs' },
                { 'id': 'https://t.me/solana' },
            ],
        } ],
    }
    console.log(obj)
    //const jstxt = JSON.stringify(obj, null, 2)
    //console.log(jstxt)

    const store = new N3.Store()
    builder.buildResource(store, type, obj.id, obj, {})
    const jsobj = await graphToJsonld(store, baseUri)
    //const jstxt = JSON.stringify(jsobj, null, 4)
    //console.log(jstxt)
    
    /*const graph = await jsonldToGraph(jstxt)
    const mainId = builder.getUriForUUID(graph, obj.uuid)
    //console.log(mainId)
    if (mainId) {
        const jsres = builder.decodeResource(graph, mainId, {})
        //console.log(jsres)
    }*/

    const apiBase = 'http://173.234.24.74:9500'
    const lc = new ListingClient(provider, catalogProgram, apiBase)
    const listingSpec = lc.getListingSpec({
        catalog: 'commerce',
        base: 'http://173.234.24.74:9500/api/catalog/listing/',
        category: 'http://rdf.atellix.net/1.0/catalog/event/conference',
        label: obj.name,
        detail: JSON.stringify({
            "@context": "http://schema.org",
            "@type": "Event",
        }),
        attributes: [
            'InPerson',
        ],
        locality: [
            'http://rdf.atellix.net/1.0/geo/2750405/NL/Netherlands', // Netherlands
        ],
        owner: provider.wallet.publicKey,
    })

    const li = await lc.getListingInstructions(listingSpec, provider.wallet.publicKey)
    console.log(await lc.storeRecordAndListing(user, obj.uuid, jsobj, li.catalog, li.uuid))
    console.log(await lc.sendListingInstructions(li))
}

console.log('Begin')
main().then(() => console.log('Success')).catch(error => {
    console.log(error)
})
