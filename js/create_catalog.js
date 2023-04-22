const { Buffer } = require('buffer')
const { PublicKey, SystemProgram } = require('@solana/web3.js')
const anchor = require('@coral-xyz/anchor')

const { programAddress, importSecretKey, exportSecretKey, jsonFileRead, jsonFileWrite } = require('../../js/atellix-common')

const provider = anchor.AnchorProvider.env()
anchor.setProvider(provider)
const catalogProgram = anchor.workspace.Catalog
const catalogProgramPK = catalogProgram.programId

async function createCatalog(catalogData) {
    const rootData = await programAddress([catalogProgramPK.toBuffer()], catalogProgramPK)
    const rootAccount = await catalogProgram.account.rootData.fetch(new PublicKey(rootData.pubkey))
    console.log('Create Catalog: ' + catalogData['id'].toString())

    const catId = BigInt(catalogData['id'].toString())
    var catBuf = Buffer.alloc(8)
    catBuf.writeBigUInt64BE(catId)
    const catalog = await programAddress([Buffer.from('catalog', 'utf8'), catBuf], catalogProgramPK)
    const tx = catalogProgram.transaction.createCatalog(
        catalogData['id'],
        {
            'accounts': {
                rootData: new PublicKey(rootData.pubkey),
                authData: rootAccount.rootAuthority,
                authUser: catalogData['admin'].publicKey,
                catalog: new PublicKey(catalog.pubkey),
                catalogSigner: catalogData['signer'],
                catalogManager: catalogData['manager'],
                feePayer: catalogData['payer'],
                systemProgram: SystemProgram.programId,
            },
        },
    )
    console.log('Activate Catalog:' + catalog.pubkey)
    console.log(await provider.sendAndConfirm(tx, [catalogData['admin']]))
    return catalog.pubkey
}

async function main() {
    const catAdmin = await jsonFileRead('catalog_admin.json')
    const admin = importSecretKey(catAdmin.catalogAdmin)
    const manager = anchor.web3.Keypair.generate()
    const signer = anchor.web3.Keypair.generate()
    const catalogs = [
        {
            'signer': signer.publicKey,
            'manager': manager.publicKey,
            'payer': provider.wallet.publicKey,
            'admin': admin,
        },
    ]
    for (var i = 0; i < catalogs.length; i++) {
        var catalog = catalogs[i]
        catalog['id'] = new anchor.BN(i)
        cat = {}
        cat['id'] = catalog['id'].toString()
        cat['signer'] = signer.publicKey.toString()
        cat['signer_secret'] = exportSecretKey(signer)
        cat['manager'] = manager.publicKey.toString()
        cat['manager_secret'] = exportSecretKey(manager)
        cat['catalog'] = await createCatalog(catalogs[i])
        await jsonFileWrite('catalog_' + i + '.json', cat)
    }
}

console.log('Begin')
main().then(() => console.log('Success')).catch(error => {
    console.log(error)
})
