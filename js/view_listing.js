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
    var merchant = provider.wallet.publicKey
    var category = getHashBN('https://rdf.atellix.net/catalog/category/Stuff')
    var listingId = 'de460569-1712-40dc-8ef8-e9d0e4035e1b'
    var listingBuf = Buffer.from(uuidparse(listingId))
    var listingEntry = await programAddress([merchant.toBuffer(), category.toBuffer(), listingBuf], catalogProgramPK)
    console.log(listingId)
    console.log(listingEntry.pubkey)
    console.log(await catalogProgram.account.catalogEntry.fetch(new PublicKey(listingEntry.pubkey)))
}

console.log('Begin')
main().then(() => console.log('Success')).catch(error => {
    console.log(error)
})
