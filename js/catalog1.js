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
    
    var url1 = 'https://rdf.atellix.net/catalog/listing/'
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
        var listingId = uuidv4()
        var listingBuf = Buffer.from(uuidparse(listingId))
        var listingEntry = await programAddress([merchant.toBuffer(), category.toBuffer(), listingBuf], catalogProgramPK)
        console.log(listingId)
        console.log(await catalogProgram.rpc.createListing(
            category,
            new anchor.BN(uuidparse(listingId)),
            {
                'accounts': {
                    merchant: provider.wallet.publicKey,
                    entry: new PublicKey(listingEntry.pubkey),
                    urlEntry: urlEntry,
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
