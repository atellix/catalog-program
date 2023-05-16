const { Buffer } = require('buffer')
const { v4: uuidv4, parse: uuidparse, stringify: uuidstr } = require('uuid')
const anchor = require('@coral-xyz/anchor')
const { PublicKey, SystemProgram } = require('@solana/web3.js')
const jsSHA = require('jssha')
const bs58 = require('bs58')
const BitSet = require('bitset')
//const { TOKEN_PROGRAM_ID } = require('@solana/spl-token')
//const { promisify } = require('util')
//const exec = promisify(require('child_process').exec)
//const fs = require('fs').promises

const { fetchJson, jsonldToGraph, ObjectBuilder, abstractDefinitionMap } = require('@atellix/catalog')

const { programAddress, jsonFileRead } = require('../../js/atellix-common')

const builder = new ObjectBuilder(abstractDefinitionMap)
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

async function decodeURL(listingData, urlEntry) {
    //console.log('Load: ' + urlEntry.toString())
    let urlData = await catalogProgram.account.catalogUrl.fetch(urlEntry)
    if (urlData.urlExpandMode === 0) {             // None
        return urlData.url
    } else if (urlData.urlExpandMode === 1) {      // AppendUUID
        var url = urlData.url
        var uuid = uuidstr(listingData.uuid.toBuffer().toJSON().data)
        return url + uuid
    } else if (urlData.urlExpandMode === 2) {      // UTF8UriEncoded
        var url = urlData.url
        var decoded = decodeURIComponent(url)
        return decoded
    }
}

function readAttributes(attrValue) {
    var hval = attrValue.toString(16)
    var attributes = [
        'InPerson',
        'LocalDelivery',
        'OnlineDownload',
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
    //var categoryUri = 'http://www.productontology.org/doc/Massage'
    var categoryUri = 'http://schema.org/Event'
    var category = getHashBN(categoryUri)
    var offset = 0
    var prefix = []

    // UUID Offset = 8
    // Catalog ID Offset = 24
    // Category Offset = 32
    // Filter By Offset = 48

    //offset = 24
    var catbuf = Buffer.alloc(8)
    catbuf.writeBigUInt64LE(BigInt(1))
    //prefix = prefix.concat(catbuf.toJSON().data)

    // Category filter
    offset = 32
    var catdata = category.toBuffer().toJSON().data
    catdata.reverse() // Borsh uses little-endian integers
    prefix = prefix.concat(catdata)

    //var start = [0x27, 0xea, 0xf9, 0x5e, 0x28, 0x32, 0xf4, 0x49]
    //prefix = prefix.concat(start)

    if (true) {
        var local = [
            //'https://www.geonames.org/6251999/', // Canada
            //'https://www.geonames.org/6252001/', // USA
            //'https://www.geonames.org/5332921/', // California
        ]
        for (var i = 0; i < local.length; i++) {
            var localHash = getHashBN(local[i])
            var localData = localHash.toBuffer().toJSON().data
            localData.reverse() // Borsh uses little-endian integers
            prefix = prefix.concat(localData)
        }
    }
    
    console.log("Offset: " + offset + " Prefix: " + bs58.encode(prefix))
    var query = await provider.connection.getProgramAccounts(catalogProgramPK, {
        filters: [
            { memcmp: { bytes: bs58.encode(prefix), offset: offset } }
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
        for (var j = 0; j < listingData.filterBy.length; j++) {
            var lc = listingData.filterBy[j]
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
            'label': await decodeURL(listingData, listingData.labelUrl),
            'detail': JSON.parse(await decodeURL(listingData, listingData.detailUrl)),
            'latitude': lat,
            'longitude': lon,
            'owner': listingData.owner.toString(),
            'attributes': readAttributes(listingData.attributes),
            'update_count': parseInt(listingData.updateCount.toString()),
            'update_ts': new Date(1000 * parseInt(listingData.updateTs.toString())),
        }
        //console.log(rec)
        const jr = await fetchJson(rec.url, null, 'GET')
        //console.log(jr)

        const jstxt = JSON.stringify(jr.data)
        //console.log(jstxt)
        const graph = await jsonldToGraph(jstxt)
        const mainId = builder.getUriForUUID(graph, jr.record_uuid)
        //console.log(mainId)
        if (mainId) {
            const jsres = builder.decodeResource(graph, mainId, {})
            console.log(rec, jsres)
        }
 
        /*console.log('UUID: ' + uuidstr(listingData.uuid.toBuffer().toJSON().data))
        console.log('Label: ' + decodeURIComponent((await decodeURL(listingData, listingData.labelUrl)).substring(5)))
        console.log('Address: ' + decodeURIComponent((await decodeURL(listingData, listingData.detailUrl)).substring(5)))
        console.log('URL: ' + await decodeURL(listingData, listingData.listingUrl))*/
    }
}

console.log('Begin')
main().then(() => console.log('Success')).catch(error => {
    console.log(error)
})
