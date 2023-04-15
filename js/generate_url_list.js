const anchor = require('@project-serum/anchor')
const jsSHA = require('jssha')
const bs58 = require('bs58')

const { jsonFileWrite } = require('../../js/atellix-common')

function getHashBN(val) {
    var shaObj = new jsSHA("SHAKE128", "TEXT", { encoding: "UTF8" })
    var hashData = shaObj.update(val).getHash("UINT8ARRAY", { outputLen: 128})
    return new anchor.BN(hashData)
}

var uris = [
    ['https://www.geonames.org/6252001/', 'United States'],
    ['https://www.geonames.org/5332921/', 'California'],
    ['https://www.geonames.org/5350736/', 'Fremont'],
    ['http://www.productontology.org/doc/Massage', 'Massage'],
]

var res = {}
for (var i = 0; i < uris.length; i++) {
    var uri = uris[i][0]
    var hash = getHashBN(uri)
    var bhash = bs58.encode(hash.toBuffer())
    res[bhash] = {
        'uri': uri,
        'label': uris[i][1],
    }
}
console.log(res)
jsonFileWrite('uris.json', res)

