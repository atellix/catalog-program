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

async function main() {
    //console.log('Catalog Program: ' + catalogProgramPK.toString())

    var listing = process.argv[2]
    console.log('Remove Listing: ' + listing)
    console.log(await catalogProgram.rpc.removeListing(
        {
            'accounts': {
                listing: new PublicKey(listing),
                feeRecipient: provider.wallet.publicKey,
                admin: provider.wallet.publicKey,
                systemProgram: SystemProgram.programId,
            },
        },
    ))
}

console.log('Begin')
main().then(() => console.log('Success')).catch(error => {
    console.log(error)
})
