const jsSHA = require('jssha')
const bs58 = require('bs58')

async function main() {
    const shaObj = new jsSHA("SHAKE128", "TEXT", { encoding: "UTF8" })
    console.log(process.argv[2])
    shaObj.update(process.argv[2])
    const hash = shaObj.getHash("UINT8ARRAY", { outputLen: 128})
    console.log(bs58.encode(hash))
}

main().then(() => process.exit(0)).catch(error => {
    console.log(error)
})
