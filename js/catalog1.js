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

async function findOrCreateURLEntry(url, expand = 0) {
    console.log('Find or Create URL Entry: ' + url)
    var urlEntry = await getURLEntry(url, expand)
    let account = await provider.connection.getAccountInfo(urlEntry)
    if (!account) {
        var hashInt = getHashBN(url)
        console.log('Creating URL Entry: ' + urlEntry)
        console.log(await catalogProgram.rpc.createUrl(
            expand, // URL Mode
            hashInt,
            url,
            {
                'accounts': {
                    urlEntry: urlEntry,
                    admin: provider.wallet.publicKey,
                    systemProgram: SystemProgram.programId,
                },
            },
        ))
    }
    return urlEntry
}

async function main() {
    //console.log('Catalog Program: ' + catalogProgramPK.toString())
    if (true) {
        var listingUrl = await findOrCreateURLEntry('https://rdf.atellix.net/catalog/listing/1#', 1)
        var addressUrl = await findOrCreateURLEntry('utf8:4455%20Paradise%20Rd%2C%20Las%20Vegas%2C%20NV%2089169', 0)
        var labelUrl = await findOrCreateURLEntry('utf8:Hard%20Rock%20Hotel%20%26%20Casino%20Las%20Vegas', 0)
        var category = getHashBN('https://rdf.atellix.net/catalog/category/Stuff')
        var locality1 = getHashBN('https://www.geonames.org/6252001/') // United States
        var locality2 = getHashBN('https://www.geonames.org/5509151/') // Nevada
        var locality3 = getHashBN('https://www.geonames.org/5506956/') // Las Vegas
        var listingId = uuidv4()
        var listingBuf = Buffer.from(uuidparse(listingId))
        var merchant = provider.wallet.publicKey
        var listingEntry = await programAddress([merchant.toBuffer(), category.toBuffer(), listingBuf], catalogProgramPK)
        console.log('Listing UUID: ' + listingId)
        console.log('Create Listing: ' + listingEntry.pubkey)
        console.log(await catalogProgram.rpc.createListing(
            new anchor.BN(uuidparse(listingId)),
            category,
            locality1,
            locality2,
            locality3,
            new anchor.BN('361102529'),
            new anchor.BN('-1151554332'),
            {
                'accounts': {
                    merchant: provider.wallet.publicKey,
                    listing: new PublicKey(listingEntry.pubkey),
                    listingUrl: listingUrl,
                    addressUrl: addressUrl,
                    labelUrl: labelUrl,
                    admin: provider.wallet.publicKey,
                    systemProgram: SystemProgram.programId,
                },
            },
        ))
    }
}

console.log('Begin')
main().then(() => console.log('Success')).catch(error => {
    console.log(error)
})
