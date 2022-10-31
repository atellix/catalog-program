const { Buffer } = require('buffer')
const { v4: uuidv4, parse: uuidparse } = require('uuid')
const anchor = require('@project-serum/anchor')
const { Keypair, PublicKey, Transaction, Ed25519Program, SystemProgram } = require('@solana/web3.js')
const MD5 = require('md5.js')
const BitSet = require('bitset')
const borsh = require('borsh')
//const { TOKEN_PROGRAM_ID } = require('@solana/spl-token')
//const { promisify } = require('util')
//const exec = promisify(require('child_process').exec)
//const fs = require('fs').promises

const { programAddress } = require('../../js/atellix-common')

const provider = anchor.AnchorProvider.env()
anchor.setProvider(provider)
const catalogProgram = anchor.workspace.Catalog
const catalogProgramPK = catalogProgram.programId
const catalogParamSchema = new Map([[Object, {
    kind: 'struct',
    fields: [
        ['uuid', 'u128'],
        ['catalog', 'u64'],
        ['category', 'u128'],
        ['filter_by_1', 'u128'],
        ['filter_by_2', 'u128'],
        ['filter_by_3', 'u128'],
        ['attributes', 'u8'],
        ['latitude', [4]],
        ['longitude', [4]],
        ['owner', [32]],
        ['listing_url', [32]],
        ['label_url', [32]],
        ['detail_url', [32]],
    ]
}]])

function getHashBN(val) {
    var bufHash = new MD5().update(val).digest()
    var hashData = bufHash.toJSON().data
    return new anchor.BN(hashData)
}

async function getURLEntry(url, expandMode = 0) {
    var bufExpand = Buffer.alloc(1)
    bufExpand.writeUInt8(expandMode)
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
        'CommerceEngine',
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
        'CommerceEngine',
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

async function createListing(listingData) {
    console.log('Create Listing: ')
    console.log(listingData)
    var listingUrl = await findOrCreateURLEntry(listingData['base'], 1)
    var addressUrl = await findOrCreateURLEntry(encodeURIComponent(listingData['address']), 2)
    var labelUrl = await findOrCreateURLEntry(encodeURIComponent(listingData['label']), 2)
    var latitude = listingData['latitude']
    var longitude = listingData['longitude']
    var category = getHashBN(listingData['category'])
    var locality1 = getHashBN(listingData['locality'][0])
    var locality2 = getHashBN(listingData['locality'][1])
    var locality3 = getHashBN(listingData['locality'][2])
    var listingId = uuidv4()
    var listingBuf = Buffer.from(uuidparse(listingId))
    var catalogId = BigInt(0)
    var owner = listingData['owner']
    //var listingEntry = await programAddress([owner.toBuffer(), category.toBuffer(), listingBuf], catalogProgramPK)
    var catalogBuf = Buffer.alloc(8)
    catalogBuf.writeBigUInt64BE(catalogId)
    var attributes = {}
    if (typeof listingData['attributes'] !== 'undefined') {
        for (var i = 0; i < listingData['attributes'].length; i++) {
            var attr = listingData['attributes'][i]
            attributes[attr] = true
        }
    }
    var listingEntry = await programAddress([catalogBuf, listingBuf], catalogProgramPK)
    var listing = new PublicKey(listingEntry.pubkey)
    console.log('Listing UUID: ' + listingId)
    console.log('Create Listing: ' + listingEntry.pubkey)
    var lparams = new Object({
        uuid: new anchor.BN(uuidparse(listingId)),
        catalog: new anchor.BN(catalogId),
        category: category,
        filter_by_1: locality1,
        filter_by_2: locality2,
        filter_by_3: locality3,
        attributes: writeAttributes(attributes),
        latitude: (new anchor.BN(latitude)).toBuffer().toJSON().data,
        longitude: (new anchor.BN(latitude)).toBuffer().toJSON().data,
        owner: provider.wallet.publicKey.toBuffer().toJSON().data,
        listing_url: listingUrl.toBuffer().toJSON().data,
        label_url: labelUrl.toBuffer().toJSON().data,
        detail_url: addressUrl.toBuffer().toJSON().data,
    })
    //console.log(lparams)
    const buffer = borsh.serialize(catalogParamSchema, lparams)
    //console.log(buffer)
    var tx = new Transaction()
    var kp = Keypair.generate()
    tx.add(Ed25519Program.createInstructionWithPrivateKey({
        message: buffer,
        privateKey: kp.secretKey,
    }))
    console.log(await provider.sendAndConfirm(tx))
    /*console.log(await catalogProgram.rpc.createListing(
        new anchor.BN(catalogId),
        new anchor.BN(uuidparse(listingId)),
        category,
        locality1,
        locality2,
        locality3,
        writeAttributes(attributes),
        new anchor.BN(latitude),
        new anchor.BN(longitude),
        {
            'accounts': {
                owner: provider.wallet.publicKey,
                listing: listing,
                listingUrl: listingUrl,
                detailUrl: addressUrl,
                labelUrl: labelUrl,
                admin: provider.wallet.publicKey,
                systemProgram: SystemProgram.programId,
            },
        },
    ))
    return listing*/
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
            'attributes': [
                'CommerceEngine',
                'Organization',
                'InPerson',
            ],
            'locality': [
                'https://www.geonames.org/6252001/', // United States
                'https://www.geonames.org/5332921/', // California
                'https://www.geonames.org/5350736/', // Fremont
            ],
            'owner': provider.wallet.publicKey,
        },
        {
            'base': base,
            'category': 'http://www.productontology.org/doc/Massage',
            'label': 'Andalusia Day Spa',
            'address': '40643 Grimmer Blvd, Fremont, CA 94538',
            'attributes': [
                'CommerceEngine',
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