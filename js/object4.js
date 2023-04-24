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
        funder: [
            {
                type: 'IPerson',
                givenName: 'Some',
                familyName: 'Body',
            },
            {
                type: 'IOrganization',
                name: 'BigCo',
            },
        ],
    }
    //console.log(obj)

    const store = new N3.Store()
    builder.buildResource(store, type, obj.id, obj, {})
    const jsobj = await graphToJsonld(store, baseUri)
    const jstxt = JSON.stringify(jsobj, null, 4)
    console.log(jstxt)
    
    const graph = await jsonldToGraph(jstxt)
    const mainId = builder.getUriForUUID(graph, obj.uuid)
    //console.log(mainId)
    if (mainId) {
        const jsres = builder.decodeResource(graph, mainId, {})
        console.log(jsres)
    }
}

console.log('Begin')
main().then(() => console.log('Success')).catch(error => {
    console.log(error)
})
