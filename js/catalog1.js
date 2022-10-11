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

async function createListing(listingData) {
    console.log('Create Listing: ')
    console.log(listingData)
    var listingUrl = await findOrCreateURLEntry(listingData['base'], 1)
    var addressUrl = await findOrCreateURLEntry('utf8:' + encodeURIComponent(listingData['address']), 0)
    var labelUrl = await findOrCreateURLEntry('utf8:' + encodeURIComponent(listingData['label']), 0)
    var latitude = listingData['latitude']
    var longitude = listingData['longitude']
    var category = getHashBN(listingData['category'])
    var locality1 = getHashBN(listingData['locality'][0])
    var locality2 = getHashBN(listingData['locality'][1])
    var locality3 = getHashBN(listingData['locality'][2])
    var listingId = uuidv4()
    var listingBuf = Buffer.from(uuidparse(listingId))
    var merchant = listingData['merchant']
    var listingEntry = await programAddress([merchant.toBuffer(), category.toBuffer(), listingBuf], catalogProgramPK)
    var listing = new PublicKey(listingEntry.pubkey)
    console.log('Listing UUID: ' + listingId)
    console.log('Create Listing: ' + listingEntry.pubkey)
    console.log(await catalogProgram.rpc.createListing(
        new anchor.BN(uuidparse(listingId)),
        category,
        locality1,
        locality2,
        locality3,
        new anchor.BN(latitude),
        new anchor.BN(longitude),
        {
            'accounts': {
                merchant: provider.wallet.publicKey,
                listing: listing,
                listingUrl: listingUrl,
                addressUrl: addressUrl,
                labelUrl: labelUrl,
                admin: provider.wallet.publicKey,
                systemProgram: SystemProgram.programId,
            },
        },
    ))
    return listing
}

async function main() {
    var base = 'http://173.234.24.74:9500/api/catalog/'
    var listings = [
        {
            'base': base,
            'category': 'http://www.productontology.org/doc/Massage',
            'label': 'MoodUp Wellness',
            'address': '39039 Paseo Padre Pkwy, Fremont, CA 94538',
            'latitude': '375536041',
            'longitude': '-1219825439',
            'locality': [
                'https://www.geonames.org/6252001/', // United States
                'https://www.geonames.org/5332921/', // California
                'https://www.geonames.org/5350736/', // Fremont
            ],
            'merchant': provider.wallet.publicKey,
        },
        {
            'base': base,
            'category': 'http://www.productontology.org/doc/Massage',
            'label': 'Andalusia Day Spa',
            'address': '40643 Grimmer Blvd, Fremont, CA 94538',
            'latitude': '375355570',
            'longitude': '-1219840115',
            'locality': [
                'https://www.geonames.org/6252001/', // United States
                'https://www.geonames.org/5332921/', // California
                'https://www.geonames.org/5350736/', // Fremont
            ],
            'merchant': provider.wallet.publicKey,
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
