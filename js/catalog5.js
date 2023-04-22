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

//const { promisify } = require('util')
//const exec = promisify(require('child_process').exec)
//const fs = require('fs').promises

const { programAddress, associatedTokenAddress, jsonFileRead, importSecretKey } = require('../../js/atellix-common')

const provider = anchor.AnchorProvider.env()
anchor.setProvider(provider)
const catalogProgram = anchor.workspace.Catalog
const catalogProgramPK = catalogProgram.programId

function getHashBN(val) {
    var shaObj = new jsSHA("SHAKE128", "TEXT", { encoding: "UTF8" })
    var hashData = shaObj.update(val).getHash("UINT8ARRAY", { outputLen: 128})
    return new anchor.BN(hashData)
}

async function getURLEntry(url, expandMode = 0) {
    var bufExpand = Buffer.alloc(1)
    bufExpand.writeUInt8(expandMode)
    var shaObj = new jsSHA("SHAKE128", "TEXT", { encoding: "UTF8" })
    var hashData = shaObj.update(url).getHash("UINT8ARRAY", { outputLen: 128})
    var bufHash = Buffer.from(hashData)
    var urlEntry = await programAddress([bufExpand, bufHash], catalogProgramPK)
    return new PublicKey(urlEntry.pubkey)
}

async function findOrCreateURLEntry(url, expand = 0) {
    console.log('Find or Create URL Entry: ' + url)
    var urlEntry = await getURLEntry(url, expand)
    console.log(urlEntry.toString())
    let account = await provider.connection.getAccountInfo(urlEntry)
    if (!account) {
        var hashInt = getHashBN(url)
        console.log('Creating URL Entry: ' + urlEntry)
        console.log(await catalogProgram.rpc.createUrl(
            expand, // URL Mode
            hashInt,
            url.length,
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

function writeAttributes(attrs) {
    var attributes = [
        'Atellix',
        'EmploymentRelated',
        'Event',
        'InPerson',
        'LocalDelivery',
        'OnlineDownload',
        'Organization',
        'Person',
    ]
    var bset = BitSet()
    for (var i = 0; i < attributes.length; i++) {
        if (attrs[attributes[i]]) {
            bset.set(i, 1)
        } else {
            bset.set(i, 0)
        }
    }
    var value = parseInt(bset.toString(16), 16)
    return value
}

function readAttributes(attrValue) {
    var hval = attrValue.toString(16)
    var attributes = [
        'Atellix',
        'EmploymentRelated',
        'Event',
        'InPerson',
        'LocalDelivery',
        'OnlineDownload',
        'Organization',
        'Person',
    ]
    var bset = BitSet('0x' + hval)
    var attrs = {}
    for (var i = 0; i < attributes.length; i++) {
        if (bset.get(i)) {
            attrs[attributes[i]] = true
        }
    }
    return attrs
}

function fetchSignedListing(listingData) {
    const url = 'http://127.0.0.1:7501/api/catalog/listing'
    const options = {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(listingData),
    }
    return new Promise((resolve, reject) => {
        fetch(url, options)
            .then(response => {
                return response.json()
            })
            .then(json => {
                resolve(json)
            })
            .catch(error => {
                reject(error)
            })
    })
}

async function createListing(listingData) {
    console.log('Create Listing: ')
    console.log(listingData)

    const owner = listingData['owner']
    const listingUrl = await findOrCreateURLEntry(listingData['base'], 1)
    const detailUrl = await findOrCreateURLEntry(encodeURIComponent(listingData['detail']), 2)
    const labelUrl = await findOrCreateURLEntry(encodeURIComponent(listingData['label']), 2)
    const latitude = listingData['latitude']
    const longitude = listingData['longitude']
    const category = getHashBN(listingData['category'])
    const locality1 = getHashBN(listingData['locality'][0])
    const locality2 = getHashBN(listingData['locality'][1])
    const locality3 = getHashBN(listingData['locality'][2])

    var attributes = {}
    if (typeof listingData['attributes'] !== 'undefined') {
        for (var i = 0; i < listingData['attributes'].length; i++) {
            var attr = listingData['attributes'][i]
            attributes[attr] = true
        }
    }
    var buf1 = Buffer.alloc(4)
    var buf2 = Buffer.alloc(4)
    bufLayout.s32().encode(latitude, buf1)
    bufLayout.s32().encode(longitude, buf2)

    const feeMint = new PublicKey('USDVXgXZcQWycX4PAu2CZbGaSG1Ft5rNjo4ARpoqw7w')
    const feeAccountPK = new PublicKey('6sGyBbpzTBaJ5U1kxmdhA9wpfxjcVQ5mymUJcWFCqwSt')
    const walletToken = await associatedTokenAddress(provider.wallet.publicKey, feeMint)
    const walletTokenPK = new PublicKey(walletToken.pubkey)

    var lparams = new Object({
        catalog: listingData.catalog,
        category: category.toString(),
        filter_by_1: locality1.toString(),
        filter_by_2: locality2.toString(),
        filter_by_3: locality3.toString(),
        attributes: writeAttributes(attributes),
        latitude: base64js.fromByteArray(buf1.toJSON().data),
        longitude: base64js.fromByteArray(buf2.toJSON().data),
        owner: base64js.fromByteArray(owner.toBuffer().toJSON().data),
        listing_url: [listingData['base'], 1],
        label_url: [encodeURIComponent(listingData['label']), 2],
        detail_url: [encodeURIComponent(listingData['detail']), 2],
        fee_account: base64js.fromByteArray(feeAccountPK.toBuffer().toJSON().data),
    })
    console.log(lparams)
    const signedResult = await fetchSignedListing(lparams)
    console.log(signedResult)

    //const buffer = borsh.serialize(catalogParamSchema, lparams)
    //console.log(buffer.length)
    const listingId = signedResult.uuid
    const listingBuf = Buffer.from(uuidparse(listingId))
    const catalogId = BigInt(signedResult.catalog)
    const catalogBuf = Buffer.alloc(8)
    catalogBuf.writeBigUInt64BE(catalogId)
    const catalog = await programAddress([Buffer.from('catalog', 'utf8'), catalogBuf], catalogProgramPK)
    const catalogPK = new PublicKey(catalog.pubkey)
    const listingEntry = await programAddress([catalogBuf, listingBuf], catalogProgramPK)
    const listingPK = new PublicKey(listingEntry.pubkey)

    console.log('Listing UUID: ' + listingId)
    console.log('Create Listing: ' + listingEntry.pubkey)

    //const catData = await jsonFileRead('catalog_' + listingData['catalog'] + '.json')
    //var kp = importSecretKey(catData.signer_secret)
    /*tx.add(Ed25519Program.createInstructionWithPrivateKey({
        message: buffer,
        privateKey: kp.secretKey,
    }))*/

    const signerPK = new PublicKey(signedResult.pubkey)
    var tx = new Transaction()
    tx.add(Ed25519Program.createInstructionWithPublicKey({
        message: base64js.toByteArray(signedResult.message),
        publicKey: signerPK.toBytes(),
        signature: bs58.decode(signedResult.sig),
    }))
    tx.add(catalogProgram.instruction.createListing(
        new anchor.BN(uuidparse(listingId)),
        {
            'accounts': {
                owner: provider.wallet.publicKey,
                catalog: catalogPK,
                listing: listingPK,
                feePayer: provider.wallet.publicKey,
                feeSource: walletTokenPK,
                feeAccount: feeAccountPK,
                ixSysvar: SYSVAR_INSTRUCTIONS_PUBKEY,
                systemProgram: SystemProgram.programId,
                tokenProgram: TOKEN_PROGRAM_ID,
            },
        },
    ))
    console.log(await provider.sendAndConfirm(tx))
    return listingPK
}

async function main() {
    const base = 'http://173.234.24.74:9500/api/catalog/'
    const listings = [
        /*{
            'base': base,
            'category': 'http://www.productontology.org/doc/Massage',
            'label': 'MoodUp Wellness',
            'detail': JSON.stringify({'address': '39039 Paseo Padre Pkwy, Fremont, CA 94538'}),
            'latitude': '375536041',
            'longitude': '-1219825439',
            'attributes': [
                'Atellix',
                'Organization',
                'InPerson',
            ],
            'locality': [
                'https://www.geonames.org/6252001/', // United States
                'https://www.geonames.org/5332921/', // California
                'https://www.geonames.org/5350736/', // Fremont
            ],
            'owner': provider.wallet.publicKey,
        },*/
        {
            'catalog': 'commerce',
            'base': base,
            'category': 'http://www.productontology.org/doc/Massage',
            'label': 'Andalusia Day Spa',
            'detail': JSON.stringify({
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
            'attributes': [
                'Atellix',
                'InPerson',
                'Organization',
            ],
            'latitude': '375355570',
            'longitude': '-1219840115',
            'locality': [
                'https://www.geonames.org/6252001/', // United States
                'https://www.geonames.org/5332921/', // California
                'https://www.geonames.org/5350736/', // Fremont
            ],
            'owner': provider.wallet.publicKey,
        },
    ]
    for (var i = 0; i < listings.length; i++) {
        await createListing(listings[i])
    }
}

console.log('Begin')
main().then(() => console.log('Success')).catch(error => {
    console.log(error)
})
