const { Buffer } = require('buffer')
const { v4: uuidv4, parse: uuidparse, stringify: uuidstr } = require('uuid')
const anchor = require('@project-serum/anchor')
const { PublicKey, SystemProgram } = require('@solana/web3.js')
const MD5 = require('md5.js')
const bs58 = require('bs58')
const BitSet = require('bitset')
//const { TOKEN_PROGRAM_ID } = require('@solana/spl-token')
//const { promisify } = require('util')
//const exec = promisify(require('child_process').exec)
//const fs = require('fs').promises

const { programAddress, jsonFileRead } = require('../../js/atellix-common')

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

async function main() {
    var uriLookup = await jsonFileRead('uris.json')
    var categoryUri = 'http://www.productontology.org/doc/Massage'
    var category = getHashBN(categoryUri)
    var prefix = [0x27, 0xea, 0xf9, 0x5e, 0x28, 0x32, 0xf4, 0x49]
    var catdata = category.toBuffer().toJSON().data
    catdata.reverse() // Borsh uses little-endian integers
    prefix = prefix.concat(catdata)

    if (true) {
        var local = [
            //'https://www.geonames.org/6251999/', // Canada
            'https://www.geonames.org/6252001/', // USA
            'https://www.geonames.org/5332921/', // California
        ]
        for (var i = 0; i < local.length; i++) {
            var localHash = getHashBN(local[i])
            var localData = localHash.toBuffer().toJSON().data
            localData.reverse() // Borsh uses little-endian integers
            prefix = prefix.concat(localData)
        }
    }

    var query = await provider.connection.getProgramAccounts(catalogProgramPK, {
        filters: [
            { memcmp: { bytes: bs58.encode(prefix), offset: 0 } }
        ]
    })
    for (var i = 0; i < query.length; i++) {
        var act = query[i]
        console.log('Found: ' + act.pubkey.toString())

        //var listingId = '3c57b887-96c3-4263-b437-39420c7ea541'
        //var listingBuf = Buffer.from(uuidparse(listingId))
        var listingData = await catalogProgram.account.catalogEntry.fetch(new PublicKey(act.pubkey))
        //console.log(listingData)
        var lat = null
        var lon = null
        if (Math.abs(listingData.latitude) < 2000000000 && Math.abs(listingData.longitude) < 2000000000) {
            lat = listingData.latitude / (10 ** 7)
            lon = listingData.longitude / (10 ** 7)
        }
        var locality = []
        for (var j = 0; j < listingData.locality.length; j++) {
            var lc = listingData.locality[j]
            if (lc.toString() !== '0') {
                var bhash = bs58.encode(lc.toBuffer())
                if (typeof uriLookup[bhash] !== 'undefined') {
                    locality.push(uriLookup[bhash])
                }
            }
        }
        var rec = {
            'category': categoryUri,
            'locality': locality,
            'url': await decodeURL(listingData, listingData.listingUrl),
            'uuid': uuidstr(listingData.uuid.toBuffer().toJSON().data),
            'label': decodeURIComponent((await decodeURL(listingData, listingData.labelUrl)).substring(5)),
            'address': decodeURIComponent((await decodeURL(listingData, listingData.addressUrl)).substring(5)),
            'latitude': lat,
            'longitude': lon,
            'owner': listingData.owner.toString(),
            'attributes': readAttributes(listingData.attributes),
            'update_count': parseInt(listingData.updateCount.toString()),
            'update_ts': new Date(1000 * parseInt(listingData.updateTs.toString())),
        }
        console.log(rec)
        /*console.log('UUID: ' + uuidstr(listingData.uuid.toBuffer().toJSON().data))
        console.log('Label: ' + decodeURIComponent((await decodeURL(listingData, listingData.labelUrl)).substring(5)))
        console.log('Address: ' + decodeURIComponent((await decodeURL(listingData, listingData.addressUrl)).substring(5)))
        console.log('URL: ' + await decodeURL(listingData, listingData.listingUrl))*/
    }
}

console.log('Begin')
main().then(() => console.log('Success')).catch(error => {
    console.log(error)
})
