use md5;
use anchor_lang::prelude::*;

declare_id!("6PoXCocdzNvCzKHRibFuxVdfYkWHSw99uGk8QCWTAPsr");

#[repr(u8)]
#[derive(PartialEq, Debug, Eq, Copy, Clone)] // TryFromPrimitive
pub enum URLExpandMode {
    None,           // 0 - Do not expand (full URL provided)
    AppendUUID,     // 1 - Convert the 'uuid' field to a lowercase UUID and then append the UUID to the URL
}

#[program]
pub mod catalog {
    use super::*;
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
        inp_uuid: u128,
        inp_category: u128,
        inp_locality_1: u128, // country
        inp_locality_2: u128, // region
        inp_locality_3: u128, // local area
        inp_attributes: u8,   // attribute flags
        inp_latitude: i32,
        inp_longitude: i32,
    ) -> anchor_lang::Result<()> {
        let clock = Clock::get()?;
        let listing_entry = &mut ctx.accounts.listing;
        listing_entry.uuid = inp_uuid;
        listing_entry.category = inp_category;
        listing_entry.locality[0] = inp_locality_1;
        listing_entry.locality[1] = inp_locality_2;
        listing_entry.locality[2] = inp_locality_3;
        listing_entry.attributes = inp_attributes;
        listing_entry.latitude = inp_latitude;
        listing_entry.longitude = inp_longitude;
        listing_entry.owner = ctx.accounts.owner.key();
        listing_entry.label_url = ctx.accounts.label_url.key();
        listing_entry.listing_url = ctx.accounts.listing_url.key();
        listing_entry.address_url = ctx.accounts.address_url.key();
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

#[derive(Accounts)]
#[instruction(inp_uuid: u128, inp_category: u128)]
pub struct CreateListing<'info> {
    #[account(init, seeds = [owner.key().as_ref(), inp_category.to_be_bytes().as_ref(), inp_uuid.to_be_bytes().as_ref()], bump, payer = admin, space = 241)]
    pub listing: Account<'info, CatalogEntry>,
    /// CHECK: ok
    pub owner: UncheckedAccount<'info>,
    /// CHECK: ok
    pub listing_url: UncheckedAccount<'info>,
    /// CHECK: ok
    pub label_url: UncheckedAccount<'info>,
    /// CHECK: ok
    pub address_url: UncheckedAccount<'info>,
    #[account(mut)]
    pub admin: Signer<'info>,
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
pub struct CatalogEntry {
    pub category: u128,
    pub locality: [u128; 3],    // typically: country, region/state, city
    pub uuid: u128,
    pub attributes: u8,         // attribute flags as bitset
    pub latitude: i32, // latitude * 10^7
    pub longitude: i32, // logitude * 10^7
    pub update_ts: i64,
    pub update_count: u64,
    pub owner: Pubkey,
    pub listing_url: Pubkey,
    pub label_url: Pubkey,
    pub address_url: Pubkey,
}
// Space = 8 + 16 + (16 * 3) + 16 + 1 + 4 + 4 + 8 + 8 + (32 * 4) = 241

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
}
