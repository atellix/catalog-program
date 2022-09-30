use md5;
use anchor_lang::prelude::*;

declare_id!("2gDsdGLeBihWuV8LENxXbRZf5EtGEPxobyxJNjdRV9uG");

#[repr(u8)]
#[derive(PartialEq, Debug, Eq, Copy, Clone)] // TryFromPrimitive
pub enum URLExpandMode {
    None,           // 0 - Do not expand (full URL provided)
    AppendUUID,     // 1 - Convert the 'uuid' field to a lowercase UUID and then append: '/[UUID]' to the URL
}

#[program]
pub mod catalog {
    use super::*;
    pub fn create_url(
        ctx: Context<CreateURL>,
        inp_url_expand_mode: u8,
        inp_url_hash: u128,
        inp_url: String,
    ) -> anchor_lang::Result<()> {
        let confirm_hash: u128 = u128::from_be_bytes(md5::compute(&inp_url).into());
        require!(confirm_hash == inp_url_hash, ErrorCode::InvalidURLHash);
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
        inp_locality_1: u128, // region
        inp_locality_2: u128, // service area (if different)
        inp_latitude: i32,
        inp_longitude: i32,
    ) -> anchor_lang::Result<()> {
        let listing_entry = &mut ctx.accounts.listing;
        listing_entry.uuid = inp_uuid;
        listing_entry.category = inp_category;
        listing_entry.locality[0] = inp_locality_1;
        listing_entry.locality[1] = inp_locality_2;
        listing_entry.latitude = inp_latitude;
        listing_entry.longitude = inp_longitude;
        listing_entry.merchant = ctx.accounts.merchant.key();
        listing_entry.label_url = ctx.accounts.label_url.key();
        listing_entry.listing_url = ctx.accounts.listing_url.key();
        listing_entry.address_url = ctx.accounts.address_url.key();
        Ok(())
    }
}

#[derive(Accounts)]
#[instruction(inp_category: u128, inp_uuid: u128)]
pub struct CreateListing<'info> {
    #[account(init, seeds = [merchant.key().as_ref(), inp_category.to_be_bytes().as_ref(), inp_uuid.to_be_bytes().as_ref()], bump, payer = admin, space = 208)]
    pub listing: Account<'info, CatalogEntry>,
    /// CHECK: ok
    pub merchant: UncheckedAccount<'info>,
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

#[derive(Accounts)]
#[instruction(inp_url_expand_mode: u8, inp_url_hash: u128)]
pub struct CreateURL<'info> {
    #[account(init, seeds = [inp_url_expand_mode.to_be_bytes().as_ref(), inp_url_hash.to_be_bytes().as_ref()], bump, payer = admin, space = 140)]
    pub url_entry: Account<'info, CatalogURL>,
    #[account(mut)]
    pub admin: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[account]
#[derive(Default)]
pub struct CatalogEntry {
    pub uuid: u128,
    pub category: u128,
    pub locality: [u128; 2], // typically: country/region/state, city/zipcode
    pub latitude: i32, // latitude * 10^7
    pub longitude: i32, // logitude * 10^7
    pub merchant: Pubkey,
    pub listing_url: Pubkey,
    pub label_url: Pubkey,
    pub address_url: Pubkey,
}
// Space = 8 + 16 + 16 + (16 * 2) + 4 + 4 + (32 * 4) = 208

#[account]
#[derive(Default)]
pub struct CatalogURL {
    pub url_expand_mode: u8,
    pub url: String, // Len 128
}
// Space = 8 + 132 = 140

#[error_code]
pub enum ErrorCode {
    #[msg("Invalid URL hash")]
    InvalidURLHash,
}
