const { Buffer } = require('buffer')
const { PublicKey, SystemProgram } = require('@solana/web3.js')
const anchor = require('@project-serum/anchor')

const { programAddress, exportSecretKey, jsonFileRead, jsonFileWrite } = require('../../js/atellix-common')

const provider = anchor.AnchorProvider.env()
anchor.setProvider(provider)
const catalogProgram = anchor.workspace.Catalog
const catalogProgramPK = catalogProgram.programId

async function createCatalog(catalogData) {
    const rootData = await programAddress([catalogProgramPK.toBuffer()], catalogProgramPK)
    const catalogId = await programAddress([Buffer.from('owner', 'utf8'), catalogData['owner'].publicKey.toBuffer()], catalogProgramPK)
    console.log('Create Catalog:' + catalogId.pubkey)
    console.log(await catalogProgram.rpc.createCatalog(
        {
            'accounts': {
                rootData: new PublicKey(rootData.pubkey),
                catalogId: new PublicKey(catalogId.pubkey),
                owner: catalogData['owner'].publicKey,
                feePayer: catalogData['payer'],
                systemProgram: SystemProgram.programId,
            },
        },
    ))
    var cid = await catalogProgram.account.catalogIdentifier.fetch(new PublicKey(catalogId.pubkey))
    var catId = BigInt(cid.catalog.toString())
    var catBuf = Buffer.alloc(8)
    catBuf.writeBigUInt64BE(catId)
    const catalogInst = await programAddress([Buffer.from('catalog', 'utf8'), catBuf], catalogProgramPK)
    var tx = catalogProgram.transaction.activateCatalog(
        cid.catalog,
        {
            'accounts': {
                rootData: new PublicKey(rootData.pubkey),
                catalogId: new PublicKey(catalogId.pubkey),
                catalogInst: new PublicKey(catalogInst.pubkey),
                owner: catalogData['owner'].publicKey,
                feePayer: catalogData['payer'],
                systemProgram: SystemProgram.programId,
            },
        },
    )
    console.log('Activate Catalog:' + catalogInst.pubkey)
    console.log(await provider.sendAndConfirm(tx, [catalogData['owner']]))
}

async function main() {
    var catalogOwner = anchor.web3.Keypair.generate()
    var catalogs = [
        {
            'owner': catalogOwner,
            'payer': provider.wallet.publicKey,
        },
    ]
    for (var i = 0; i < catalogs.length; i++) {
        var cat1 = {
            'owner': catalogOwner.publicKey.toString(),
            'owner_secret': exportSecretKey(catalogOwner),
        }
        await createCatalog(catalogs[i])
        await jsonFileWrite('catalog-' + i + '.json', cat1)
    }
}

console.log('Begin')
main().then(() => console.log('Success')).catch(error => {
    console.log(error)
})
