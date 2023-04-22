const { Buffer } = require('buffer')
const { v4: uuidv4, parse: uuidparse } = require('uuid')
const anchor = require('@coral-xyz/anchor')
const { PublicKey, SystemProgram } = require('@solana/web3.js')
const MD5 = require('md5.js')
//const { TOKEN_PROGRAM_ID } = require('@solana/spl-token')
//const { promisify } = require('util')
//const exec = promisify(require('child_process').exec)
//const fs = require('fs').promises

const { programAddress, jsonFileRead, importSecretKey } = require('../../js/atellix-common')

const provider = anchor.AnchorProvider.env()
anchor.setProvider(provider)
const catalogProgram = anchor.workspace.Catalog
const catalogProgramPK = catalogProgram.programId

async function main() {
    const rootData = await programAddress([catalogProgramPK.toBuffer()], catalogProgramPK)
    const rootAccount = await catalogProgram.account.rootData.fetch(new PublicKey(rootData.pubkey))
    //console.log('Catalog Program: ' + catalogProgramPK.toString())

    var listing = process.argv[2]
    const lstData = await catalogProgram.account.catalogEntry.fetch(new PublicKey(listing))
    const catData = await jsonFileRead('catalog_' + lstData.catalog.toString() + '.json')
    var kp = importSecretKey(catData.manager_secret)

    console.log('Remove Listing: ' + listing)
    console.log(await catalogProgram.rpc.removeListing(
        {
            'accounts': {
                rootData: new PublicKey(rootData.pubkey),
                authData: rootAccount.rootAuthority,
                authUser: kp.publicKey,
                catalog: new PublicKey(catData.catalog),
                listing: new PublicKey(listing),
                feeRecipient: provider.wallet.publicKey,
                systemProgram: SystemProgram.programId,
            },
            'signers': [kp],
        },
    ))
}

console.log('Begin')
main().then(() => console.log('Success')).catch(error => {
    console.log(error)
})
