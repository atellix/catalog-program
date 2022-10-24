const anchor = require('@project-serum/anchor')
const { PublicKey, SystemProgram } = require('@solana/web3.js')
const { promisify } = require('util')
const exec = promisify(require('child_process').exec)
const fs = require('fs').promises

const { programAddress } = require('../../js/atellix-common')

const provider = anchor.AnchorProvider.env()
anchor.setProvider(provider)
const catalogProgram = anchor.workspace.Catalog
const catalogProgramPK = catalogProgram.programId

async function main() {
    var jsres = await exec('solana program show --output json ' + catalogProgramPK.toString())
    var res = JSON.parse(jsres.stdout)
    const programData = res.programdataAddress
    const rootData = await programAddress([catalogProgramPK.toBuffer()], catalogProgramPK)

    console.log(await catalogProgram.rpc.initialize(
        {
            'accounts': {
                program: catalogProgramPK,
                programAdmin: provider.wallet.publicKey,
                programData: new PublicKey(programData),
                rootData: new PublicKey(rootData.pubkey),
                systemProgram: SystemProgram.programId
            },
        },
    ))
}

console.log('Begin')
main().then(() => console.log('Success')).catch(error => {
    console.log(error)
})
