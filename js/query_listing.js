const { Buffer } = require('buffer')
const { v4: uuidv4, parse: uuidparse, stringify: uuidstr } = require('uuid')
const anchor = require('@project-serum/anchor')
const { PublicKey, SystemProgram } = require('@solana/web3.js')
const MD5 = require('md5.js')
const bs58 = require('bs58')
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

async function decodeURL(listingData, urlEntry) {
    //console.log('Load: ' + urlEntry.toString())
    let urlData = await catalogProgram.account.catalogUrl.fetch(urlEntry)
    if (urlData.urlExpandMode === 0) {             // None
        return urlData.url
    } else if (urlData.urlExpandMode === 1) {      // AppendUUID
        var url = urlData.url
        var uuid = uuidstr(listingData.uuid.toBuffer().toJSON().data)
        return url + uuid
    }
}

async function main() {
    var merchant = provider.wallet.publicKey
    var category = getHashBN('https://rdf.atellix.net/catalog/category/Stuff')
    var prefix = [0x27, 0xea, 0xf9, 0x5e, 0x28, 0x32, 0xf4, 0x49]
    var catdata = category.toBuffer().toJSON().data
    catdata.reverse() // Borsh uses little-endian integers
    prefix = prefix.concat(catdata)
    var query = await provider.connection.getProgramAccounts(catalogProgramPK, {
        filters: [
            { memcmp: { bytes: bs58.encode(prefix), offset: 0 } }
        ]
    })
    for (var i = 0; i < query.length; i++) {
        var act = query[i]
        console.log('Found: ' + act.pubkey.toString())
    }

/*    var listingId = '3c57b887-96c3-4263-b437-39420c7ea541'
    var listingBuf = Buffer.from(uuidparse(listingId))
    var listingEntry = await programAddress([merchant.toBuffer(), category.toBuffer(), listingBuf], catalogProgramPK)
    console.log(listingId)
    console.log(listingEntry.pubkey)
    var listingData = await catalogProgram.account.catalogEntry.fetch(new PublicKey(listingEntry.pubkey))
    console.log(listingData)
    console.log('Label: ' + decodeURIComponent((await decodeURL(listingData, listingData.labelUrl)).substring(5)))
    console.log('Address: ' + decodeURIComponent((await decodeURL(listingData, listingData.addressUrl)).substring(5)))
    console.log('URL: ' + await decodeURL(listingData, listingData.listingUrl)) */
}

console.log('Begin')
main().then(() => console.log('Success')).catch(error => {
    console.log(error)
})
