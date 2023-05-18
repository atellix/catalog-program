const { v4: uuidv4, parse: uuidparse } = require('uuid')
const anchor = require('@coral-xyz/anchor')
const { PublicKey } = require('@solana/web3.js')
const { ListingClient } = require('@atellix/catalog')
const N3 = require('n3')

const provider = anchor.AnchorProvider.env()
anchor.setProvider(provider)
const catalogProgram = anchor.workspace.Catalog
const catalogProgramPK = catalogProgram.programId

async function main() {
    console.log('Main')
    const apiBase = 'http://173.234.24.74:9500'
    const lc = new ListingClient(provider, catalogProgram, apiBase)
    await lc.syncMerchant()
}

console.log('Begin')
main().then(() => console.log('Success')).catch(error => {
    console.log(error)
})
