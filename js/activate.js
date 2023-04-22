const anchor = require('@coral-xyz/anchor')
const { PublicKey, SystemProgram } = require('@solana/web3.js')
const { promisify } = require('util')
const exec = promisify(require('child_process').exec)
const fs = require('fs').promises

const { programAddress, exportSecretKey, jsonFileWrite } = require('../../js/atellix-common')

const provider = anchor.AnchorProvider.env()
anchor.setProvider(provider)
const catalogProgram = anchor.workspace.Catalog
const catalogProgramPK = catalogProgram.programId

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
}

async function main() {
    var jsres = await exec('solana program show --output json ' + catalogProgramPK.toString())
    var res = JSON.parse(jsres.stdout)
    const programData = res.programdataAddress
    const rootData = await programAddress([catalogProgramPK.toBuffer()], catalogProgramPK)

    const authBytes = 130 + (16384 * 2)
    const authRent = await provider.connection.getMinimumBalanceForRentExemption(authBytes)
    const authData = anchor.web3.Keypair.generate()
    const authDataPK = authData.publicKey

    const catalogAdmin = anchor.web3.Keypair.generate()
    const catalogAdminPK = catalogAdmin.publicKey

    console.log('Create RBAC Account')
    const tx = new anchor.web3.Transaction()
    tx.add(
        anchor.web3.SystemProgram.createAccount({
            fromPubkey: provider.wallet.publicKey,
            newAccountPubkey: authData.publicKey,
            space: authBytes,
            lamports: authRent,
            programId: catalogProgramPK,
        })
    )
    console.log(await provider.sendAndConfirm(tx, [authData]))
    await sleep(3000)
    console.log('Initialize')
    console.log(await catalogProgram.rpc.initialize(
        {
            'accounts': {
                program: catalogProgramPK,
                programAdmin: provider.wallet.publicKey,
                programData: new PublicKey(programData),
                rootData: new PublicKey(rootData.pubkey),
                authData: authDataPK,
                systemProgram: SystemProgram.programId
            },
        },
    ))
    await sleep(3000)
    console.log('Grant: Network Admin')
    console.log(await catalogProgram.rpc.grant(
        rootData.nonce,
        0, // NetworkAdmin
        {
            accounts: {
                program: catalogProgramPK,
                programAdmin: provider.wallet.publicKey,
                programData: new PublicKey(programData),
                rootData: new PublicKey(rootData.pubkey),
                authData: authDataPK,
                rbacUser: catalogAdminPK,
            },
        }
    ))
    console.log('Grant: CreateCatalog')
    console.log(await catalogProgram.rpc.grant(
        rootData.nonce,
        1, // CreateCatalog
        {
            accounts: {
                program: catalogProgramPK,
                programAdmin: provider.wallet.publicKey,
                programData: new PublicKey(programData),
                rootData: new PublicKey(rootData.pubkey),
                authData: authDataPK,
                rbacUser: catalogAdminPK,
            },
        }
    ))
    await jsonFileWrite('catalog_admin.json', {
        'authData': authDataPK.toString(),
        'catalogAdmin': exportSecretKey(catalogAdmin),
    })
}

console.log('Begin')
main().then(() => console.log('Success')).catch(error => {
    console.log(error)
})
