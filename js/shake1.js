const jsSHA = require('jssha')

async function main() {
    const shaObj = new jsSHA("SHAKE128", "TEXT", { encoding: "UTF8" })
    shaObj.update("test")
    const hash = shaObj.getHash("HEX", { outputLen: 128})
    console.log(hash)
}

main().then(() => process.exit(0)).catch(error => {
    console.log(error)
})
