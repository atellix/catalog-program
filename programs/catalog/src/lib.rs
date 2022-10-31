use crate::program::Catalog;
use anchor_lang::prelude::*;
use solana_program::instruction::Instruction;
use solana_program::sysvar::instructions::{ID as IX_ID, load_instruction_at_checked};
use solana_program::ed25519_program::{ID as ED25519_ID};
use borsh::{ BorshSerialize, BorshDeserialize };
use std::convert::TryInto;
use md5;

declare_id!("EXWag8kRv8Tgk7k5N6cxmAUiSqEGdRBMVA6wBv18uXKe");

#[repr(u8)]
#[derive(PartialEq, Debug, Eq, Copy, Clone)] // TryFromPrimitive
pub enum URLExpandMode {
    None,           // 0 - Do not expand (full URL provided)
    AppendUUID,     // 1 - Convert the 'uuid' field to a lowercase UUID and then append the UUID to the URL
    UTF8UriEncoded, // 2 - URI-encoded UTF-8 string
}

#[derive(BorshSerialize, BorshDeserialize)]
pub struct CatalogParameters {
    pub uuid: u128,
    pub catalog: u64,
    pub category: u128,
    pub filter_by_1: u128,
    pub filter_by_2: u128,
    pub filter_by_3: u128,
    pub attributes: u8,
    pub latitude: [u8; 4],
    pub longitude: [u8; 4],
    pub owner: [u8; 32],
    pub listing_url: [u8; 32],
    pub label_url: [u8; 32],
    pub detail_url: [u8; 32],
}

// LEN: 16 + 8 + 16 + 16 + 16 + 16 + 1 + 4 + 4 + 32 + 32 + 32 + 32 = 225

#[program]
pub mod catalog {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> anchor_lang::Result<()> {
        let root = &mut ctx.accounts.root_data;
        root.catalog_count = 0;
        Ok(())
    }

    pub fn create_catalog(
        ctx: Context<CreateCatalog>,
    ) -> anchor_lang::Result<()> {
        let root = &mut ctx.accounts.root_data;
        let cid = &mut ctx.accounts.catalog_id;
        cid.catalog = root.next_catalog_id()?;
        msg!("Allocated Catalog ID: {}", cid.catalog);
        Ok(())
    }

    pub fn activate_catalog(
        ctx: Context<ActivateCatalog>,
        inp_catalog: u64,
    ) -> anchor_lang::Result<()> {
        let cinst = &mut ctx.accounts.catalog_inst;
        cinst.catalog = inp_catalog;
        cinst.catalog_owner = ctx.accounts.owner.key();
        msg!("Activated Catalog ID: {}", cinst.catalog);
        Ok(())
    }

    pub fn create_url(
        ctx: Context<CreateURL>,
        inp_url_expand_mode: u8,
        inp_url_hash: u128,
        inp_url_length: u32,
        inp_url: String,
    ) -> anchor_lang::Result<()> {
        let confirm_hash: u128 = u128::from_be_bytes(md5::compute(&inp_url).into());
        require!(confirm_hash == inp_url_hash, ErrorCode::InvalidURLHash); // Verifies hash used in the URL account
        require!(inp_url.len() == inp_url_length as usize, ErrorCode::InvalidURLLength);
        // TODO: validate expand mode
        let url_entry = &mut ctx.accounts.url_entry;
        url_entry.url_expand_mode = inp_url_expand_mode;
        url_entry.url = inp_url;
        Ok(())
    }

    pub fn create_listing(
        ctx: Context<CreateListing>,
        inp_catalog: u64,
        inp_uuid: u128,
    ) -> anchor_lang::Result<()> {
        let clock = Clock::get()?;
        let ix: Instruction = load_instruction_at_checked(0, &ctx.accounts.ix_sysvar)?;
        let (pk, req) = utils::verify_ed25519_ix(&ix, 225)?;
        let params = CatalogParameters::try_from_slice(&req).unwrap();
        require!(Pubkey::new_from_array(pk.try_into().unwrap()) == ctx.accounts.auth_key.key(), ErrorCode::InvalidParameters);
        let owner = Pubkey::new_from_array(params.owner);
        require!(inp_uuid == params.uuid, ErrorCode::InvalidParameters);
        require!(inp_catalog == params.catalog, ErrorCode::InvalidParameters);
        require!(ctx.accounts.owner.key() == owner, ErrorCode::InvalidParameters);
        let listing_entry = &mut ctx.accounts.listing;
        listing_entry.uuid = params.uuid;
        listing_entry.catalog = params.catalog;
        listing_entry.category = params.category;
        listing_entry.filter_by[0] = params.filter_by_1;
        listing_entry.filter_by[1] = params.filter_by_2;
        listing_entry.filter_by[2] = params.filter_by_3;
        listing_entry.attributes = params.attributes;
        listing_entry.latitude = i32::from_le_bytes(params.latitude);
        listing_entry.longitude = i32::from_le_bytes(params.longitude);
        listing_entry.owner = owner;
        listing_entry.label_url = Pubkey::new_from_array(params.label_url);
        listing_entry.listing_url = Pubkey::new_from_array(params.listing_url);
        listing_entry.detail_url = Pubkey::new_from_array(params.detail_url);
        listing_entry.update_count = 1;
        listing_entry.update_ts = clock.unix_timestamp;
        Ok(())
    }

    pub fn remove_listing(
        _ctx: Context<RemoveListing>,
    ) -> anchor_lang::Result<()> {
        Ok(())
    }
}

pub mod utils {
    use super::*;

    /// Verify Ed25519Program instruction fields
    pub fn verify_ed25519_ix(ix: &Instruction, msg_len: u16) -> anchor_lang::Result<(Vec<u8>, Vec<u8>)> {
        if  ix.program_id       != ED25519_ID                   ||  // The program id we expect
            ix.accounts.len()   != 0                                // With no context accounts
        {
            return Err(ErrorCode::SigVerificationFailed.into());    // Otherwise, we can already throw err
        }

        let r = check_ed25519_data(&ix.data, msg_len)?;            // If that's not the case, check data

        Ok(r)
    }

    /// Verify serialized Ed25519Program instruction data
    pub fn check_ed25519_data(data: &[u8], msg_len: u16) -> anchor_lang::Result<(Vec<u8>, Vec<u8>)> {
        // According to this layout used by the Ed25519Program
        // https://github.com/solana-labs/solana-web3.js/blob/master/src/ed25519-program.ts#L33

        // "Deserializing" byte slices

        let num_signatures                  = &[data[0]];        // Byte  0
        let padding                         = &[data[1]];        // Byte  1
        let signature_offset                = &data[2..=3];      // Bytes 2,3
        let signature_instruction_index     = &data[4..=5];      // Bytes 4,5
        let public_key_offset               = &data[6..=7];      // Bytes 6,7
        let public_key_instruction_index    = &data[8..=9];      // Bytes 8,9
        let message_data_offset             = &data[10..=11];    // Bytes 10,11
        let message_data_size               = &data[12..=13];    // Bytes 12,13
        let message_instruction_index       = &data[14..=15];    // Bytes 14,15

        let data_pubkey                     = &data[16..16+32];  // Bytes 16..16+32
        let _data_sig                       = &data[48..48+64];  // Bytes 48..48+64
        let data_msg                        = &data[112..];      // Bytes 112..end

        // Expected values

        let exp_public_key_offset:      u16 = 16; // 2*u8 + 7*u16
        let exp_signature_offset:       u16 = exp_public_key_offset + 32;
        let exp_message_data_offset:    u16 = exp_signature_offset + 64;
        let exp_num_signatures:          u8 = 1;
        let exp_message_data_size:      u16 = msg_len;

        // Header and Arg Checks

        // Header
        if  num_signatures                  != &exp_num_signatures.to_le_bytes()        ||
            padding                         != &[0]                                     ||
            signature_offset                != &exp_signature_offset.to_le_bytes()      ||
            signature_instruction_index     != &u16::MAX.to_le_bytes()                  ||
            public_key_offset               != &exp_public_key_offset.to_le_bytes()     ||
            public_key_instruction_index    != &u16::MAX.to_le_bytes()                  ||
            message_data_offset             != &exp_message_data_offset.to_le_bytes()   ||
            message_data_size               != &exp_message_data_size.to_le_bytes()     ||
            message_instruction_index       != &u16::MAX.to_le_bytes()  
        {
            return Err(ErrorCode::SigVerificationFailed.into());
        }

        Ok((data_pubkey.to_vec(), data_msg.to_vec()))
    }

    #[error_code]
    pub enum ErrorCode {
        #[msg("Signature verification failed")]
        SigVerificationFailed,
    }
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(init, seeds = [program_id.as_ref()], bump, payer = program_admin, space = 16)]
    pub root_data: Account<'info, RootData>,
    #[account(constraint = program.programdata_address().unwrap() == Some(program_data.key()))]
    pub program: Program<'info, Catalog>,
    #[account(constraint = program_data.upgrade_authority_address == Some(program_admin.key()))]
    pub program_data: Account<'info, ProgramData>,
    #[account(mut)]
    pub program_admin: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct CreateCatalog<'info> {
    #[account(mut, seeds = [program_id.as_ref()], bump)]
    pub root_data: Account<'info, RootData>,
    #[account(init, seeds = [b"owner", owner.key().as_ref()], bump, payer = fee_payer, space = 16)]
    pub catalog_id: Account<'info, CatalogIdentifier>,
    /// CHECK: ok
    pub owner: UncheckedAccount<'info>,
    #[account(mut)]
    pub fee_payer: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(inp_catalog: u64)]
pub struct ActivateCatalog<'info> {
    #[account(seeds = [b"owner", owner.key().as_ref()], bump)]
    pub catalog_id: Account<'info, CatalogIdentifier>,
    #[account(init, seeds = [b"catalog", inp_catalog.to_be_bytes().as_ref()], bump, payer = fee_payer, space = 113)]
    pub catalog_inst: Account<'info, CatalogInstance>,
    /// CHECK: ok
    #[account(constraint = catalog_id.catalog == inp_catalog)]
    pub owner: Signer<'info>,
    #[account(mut)]
    pub fee_payer: Signer<'info>,
    ///// CHECK: ok
    //pub net_auth: UncheckedAccount<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(inp_catalog: u64, inp_uuid: u128)]
pub struct CreateListing<'info> {
    #[account(init, seeds = [inp_catalog.to_be_bytes().as_ref(), inp_uuid.to_be_bytes().as_ref()], bump, payer = fee_payer, space = 249)]
    pub listing: Account<'info, CatalogEntry>,
    /// CHECK: ok
    pub auth_key: UncheckedAccount<'info>,
    pub owner: Signer<'info>,
    #[account(address = IX_ID)]
    pub ix_sysvar: AccountInfo<'info>,
    #[account(mut)]
    pub fee_payer: Signer<'info>,
    pub system_program: Program<'info, System>,
}

// TODO: RBAC
#[derive(Accounts)]
pub struct RemoveListing<'info> {
    #[account(mut, close = fee_recipient)]
    pub listing: Account<'info, CatalogEntry>,
    #[account(mut)]
    pub fee_recipient: Signer<'info>,
    pub admin: Signer<'info>,
}

#[derive(Accounts)]
#[instruction(inp_url_expand_mode: u8, inp_url_hash: u128, inp_url_length: u32)]
pub struct CreateURL<'info> {
    #[account(init, seeds = [inp_url_expand_mode.to_be_bytes().as_ref(), inp_url_hash.to_be_bytes().as_ref()], bump, payer = admin, space = 13 + inp_url_length as usize)]
    pub url_entry: Account<'info, CatalogUrl>,
    #[account(mut)]
    pub admin: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[account]
#[derive(Default)]
pub struct RootData {
    pub catalog_count: u64,
    //pub root_authority: Pubkey,
}
// Size: 8 + 8 = 16

impl RootData {
    pub fn next_catalog_id(&mut self) -> anchor_lang::Result<u64> {
        let x: u64 = self.catalog_count;
        self.catalog_count = self.catalog_count.checked_add(1).ok_or(error!(ErrorCode::Overflow))?;
        return Ok(x);
    }
}

#[account]
#[derive(Default)]
pub struct CatalogIdentifier {
    pub catalog: u64,
}
// Space = 8 + 8 = 16

#[account]
#[derive(Default)]
pub struct CatalogInstance {
    pub catalog: u64,
    pub catalog_owner: Pubkey,
    pub catalog_url: Pubkey,
    pub auth_type: u8,
    pub net_auth: Pubkey,
}
// Space = 8 + 8 + 32 + 32 + 1 + 32 = 113

#[account]
#[derive(Default)]
pub struct CatalogEntry {
    pub uuid: u128,
    pub catalog: u64,
    pub category: u128,
    pub filter_by: [u128; 3],   // typically: country, region/state, city
    pub attributes: u8,         // attribute flags as bitset
    pub latitude: i32,          // latitude * 10^7
    pub longitude: i32,         // logitude * 10^7
    pub update_ts: i64,
    pub update_count: u64,
    pub owner: Pubkey,
    pub listing_url: Pubkey,
    pub label_url: Pubkey,
    pub detail_url: Pubkey,
}
// Space = 8 + 16 + 8 + 16 + (16 * 3) + 1 + 4 + 4 + 8 + 8 + (32 * 4) = 249

#[account]
#[derive(Default)]
pub struct CatalogUrl {
    pub url_expand_mode: u8,
    pub url: String,
}
// Space = 8 + 1 + (len) + 4 = 13 + (len)

#[error_code]
pub enum ErrorCode {
    #[msg("Invalid URL hash")]
    InvalidURLHash,
    #[msg("Invalid URL length")]
    InvalidURLLength,
    #[msg("Invalid parameters")]
    InvalidParameters,
    #[msg("Overflow")]
    Overflow,
}
