const { Buffer } = require('buffer')
const { v4: uuidv4, parse: uuidparse } = require('uuid')
const anchor = require('@project-serum/anchor')
const { PublicKey, SystemProgram } = require('@solana/web3.js')
const MD5 = require('md5.js')
//const { TOKEN_PROGRAM_ID } = require('@solana/spl-token')
//const { promisify } = require('util')
//const exec = promisify(require('child_process').exec)
//const fs = require('fs').promises

const { programAddress } = require('../../js/atellix-common')

const provider = anchor.AnchorProvider.env()
anchor.setProvider(provider)
const catalogProgram = anchor.workspace.Catalog
const catalogProgramPK = catalogProgram.programId

function getHashBN(val) {
    var bufHash = new MD5().update(val).digest()
    var hashData = bufHash.toJSON().data
    return new anchor.BN(hashData)
}

async function getURLEntry(url, expand = 0) {
    var bufExpand = Buffer.alloc(1)
    bufExpand.writeUInt8(expand)
    var bufHash = new MD5().update(url).digest()
    var urlEntry = await programAddress([bufExpand, bufHash], catalogProgramPK)
    return new PublicKey(urlEntry.pubkey)
}

async function main() {
    console.log('Catalog Program: ' + catalogProgramPK.toString())
    
    var url1 = 'https://rdf.atellix.net/catalog/listing/#1/'
    var urlMode = 1
    var urlEntry = await getURLEntry(url1, urlMode)
    var hashInt = getHashBN(url1)

    if (false) {
        console.log(await catalogProgram.rpc.createUrl(
            urlMode, // URL Mode
            hashInt,
            url1,
            {
                'accounts': {
                    urlEntry: urlEntry,
                    admin: provider.wallet.publicKey,
                    systemProgram: SystemProgram.programId,
                },
            },
        ))
    }

    if (true) {
        var merchant = provider.wallet.publicKey
        var category = getHashBN('https://rdf.atellix.net/catalog/category/Stuff')
        var locality1 = getHashBN('https://www.geonames.org/5165418/') // Ohio
        var locality2 = getHashBN('https://www.geonames.org/4520760/') // Oxford
        var locality3 = getHashBN('https://rdf.atellix.net/locality/country/us/zipcode/45056')
        var locality4 = getHashBN('https://rdf.atellix.net/locality/country/us/address/508%20Edgehill%20Dr.%0AOxford%2C%20OH%2045056')
        //var listingId = uuidv4()
        var listingId = 'de460569-1712-40dc-8ef8-e9d0e4035e1b'
        var listingBuf = Buffer.from(uuidparse(listingId))
        var listingEntry = await programAddress([merchant.toBuffer(), category.toBuffer(), listingBuf], catalogProgramPK)
        //console.log(listingId)
        console.log(listingId)
        console.log(listingEntry.pubkey)
        /*console.log(await catalogProgram.rpc.createListing(
            category,
            new anchor.BN(uuidparse(listingId)),
            locality1,
            locality2,
            locality3,
            locality4,
            new anchor.BN('395016838'),
            new anchor.BN('-847512854'),
            {
                'accounts': {
                    merchant: provider.wallet.publicKey,
                    entry: new PublicKey(listingEntry.pubkey),
                    urlEntry: urlEntry,
                    admin: provider.wallet.publicKey,
                    systemProgram: SystemProgram.programId,
                },
            },
        ))*/
    }
}

console.log('Begin')
main().then(() => console.log('Success')).catch(error => {
    console.log(error)
})
