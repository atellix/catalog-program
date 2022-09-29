import * as anchor from '@project-serum/anchor';
import { Program } from '@project-serum/anchor';
import { Catalog } from '../target/types/catalog';

describe('catalog', () => {

  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.Provider.env());

  const program = anchor.workspace.Catalog as Program<Catalog>;

  it('Is initialized!', async () => {
    // Add your test here.
    const tx = await program.rpc.initialize({});
    console.log("Your transaction signature", tx);
  });
});
