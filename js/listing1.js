const { Buffer } = require('buffer')
const { v4: uuidv4, parse: uuidparse } = require('uuid')
const anchor = require('@coral-xyz/anchor')
const { Keypair, PublicKey, Transaction, Ed25519Program, SYSVAR_INSTRUCTIONS_PUBKEY, SystemProgram } = require('@solana/web3.js')
const { TOKEN_PROGRAM_ID } = require('@solana/spl-token')
const jsSHA = require('jssha')
const bs58 = require('bs58')
const BitSet = require('bitset')
const borsh = require('borsh')
const bufLayout = require('buffer-layout')
const base64js = require('base64-js')
const fetch = require('node-fetch')
const N3 = require('N3')
const { namedNode, literal, quad } = N3.DataFactory

const { ListingClient } = require('@atellix/catalog')

const { programAddress, associatedTokenAddress, jsonFileRead, importSecretKey } = require('../../js/atellix-common')

const provider = anchor.AnchorProvider.env()
anchor.setProvider(provider)
const catalogProgram = anchor.workspace.Catalog
const catalogProgramPK = catalogProgram.programId

async function main() {
    console.log('Main')
    const feeMint = new PublicKey('USDVXgXZcQWycX4PAu2CZbGaSG1Ft5rNjo4ARpoqw7w')
    const walletToken = await associatedTokenAddress(provider.wallet.publicKey, feeMint)
    const walletTokenPK = new PublicKey(walletToken.pubkey)

    const lc = new ListingClient(provider, catalogProgram)
    const listingUrl = 'http://127.0.0.1:7501/api/catalog/listing'
    const listingSpec = lc.getListingSpec({
        catalog: 'commerce',
        base: 'http://173.234.24.74:9500/api/catalog/listing/',
        category: 'http://www.productontology.org/doc/Massage',
        label: 'MoodUp Wellness',
        detail: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Organization",
            "address": {
                "@type": "PostalAddress",
                "streetAddress": "40643 Grimmer Blvd.",
                "addressLocality": "Fremont",
                "addressRegion": "CA",
                "postalCode": "94538",
                "addressCountry": "USA",
            },
            "email": "some@body.com",
            "telephone": "+14519943344",
        }),
        attributes: [
            'InPerson',
        ],
        latitude: 37.535557,
        longitude: -121.9840115,
        locality: [
            'https://www.geonames.org/6252001/', // United States
            'https://www.geonames.org/5332921/', // California
            'https://www.geonames.org/5350736/', // Fremont
        ],
        owner: provider.wallet.publicKey,
    })
    //console.log(listingSpec)
    const li = await lc.getListingInstructions(fetch, listingUrl, listingSpec, provider.wallet.publicKey, walletTokenPK)
    console.log(li)
    console.log(await lc.sendListingInstructions(li))
}

console.log('Begin')
main().then(() => console.log('Success')).catch(error => {
    console.log(error)
})
