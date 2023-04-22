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
    const feeMint = new PublicKey('USDVXgXZcQWycX4PAu2CZbGaSG1Ft5rNjo4ARpoqw7w')
    const type = 'IEvent'
    const baseUri = 'http://example.com/event/'
    const obj = {
        id: baseUri + '1',
        uuid: uuidv4(),
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
    const jsobj = await graphToJsonld(store, baseUri)

    /*const jstxt = JSON.stringify(jsobj)
    const graph = await jsonldToGraph(jstxt)
    const mainId = builder.getUriForUUID(graph, obj.uuid)
    console.log(mainId)
    const mainType = builder.getType(graph, mainId)
    if (mainId) {
        const jsres = builder.decodeResource(graph, mainType, mainId, {})
        console.log(jsres)
    }*/
    
    const walletToken = await associatedTokenAddress(provider.wallet.publicKey, feeMint)
    const walletTokenPK = new PublicKey(walletToken.pubkey)

    const lc = new ListingClient(provider, catalogProgram)
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
    const listingUrl = 'http://127.0.0.1:7501/api/catalog/listing'
    const li = await lc.getListingInstructions(listingUrl, listingSpec, provider.wallet.publicKey, walletTokenPK)
    console.log(li)
    const apiBase = 'http://173.234.24.74:9500'
    console.log('Store Record')
    console.log(await lc.storeRecord(apiBase, user, obj.uuid, jsobj))
    console.log('Store Listing')
    console.log(await lc.storeListing(apiBase, user, obj.uuid, li.catalog, li.uuid))
    console.log(await lc.sendListingInstructions(li))
}

console.log('Begin')
main().then(() => console.log('Success')).catch(error => {
    console.log(error)
})
