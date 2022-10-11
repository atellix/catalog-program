const anchor = require('@project-serum/anchor')
const MD5 = require('md5.js')
const bs58 = require('bs58')

const { jsonFileWrite } = require('../../js/atellix-common')

function getHashBN(val) {
    var bufHash = new MD5().update(val).digest()
    var hashData = bufHash.toJSON().data
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

