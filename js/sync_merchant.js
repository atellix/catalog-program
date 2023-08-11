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
    const baseUrl = 'https://cat-dev1.atellix.net'
    const authUrl = 'https://atx2.atellix.net'
    const apiKey = 'efe866bb31ce43c8b7aa386ae013c11f40114bdfa1f34dfe939351fdc6b1f7cc'
    const lc = new ListingClient(provider, catalogProgram, baseUrl, authUrl, apiKey)
    lc.accessToken = await lc.getToken()
    console.log(lc.accessToken)
    //await lc.syncListings(provider.wallet, provider.wallet, 'commerce')
}

console.log('Begin')
main().then(() => console.log('Success')).catch(error => {
    console.log(error)
})
