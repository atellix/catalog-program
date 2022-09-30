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
        msg!("URL Expand Mode: {}", inp_url_expand_mode.to_string());
        msg!("URL: {}", inp_url.as_str());
        msg!("URL Input Hash: {}", inp_url_hash.to_string());
        let confirm_hash: u128 = u128::from_be_bytes(md5::compute(&inp_url).into());
        msg!("URL Calculated Hash: {}", confirm_hash.to_string());
        require!(confirm_hash == inp_url_hash, ErrorCode::InvalidURLHash);
        // TODO: validate expand mode
        let url_entry = &mut ctx.accounts.url_entry;
        url_entry.url_expand_mode = inp_url_expand_mode;
        url_entry.url = inp_url;
        Ok(())
    }

    pub fn create_listing(
        ctx: Context<CreateListing>,
        inp_category: u128,
        inp_uuid: u128,
    ) -> anchor_lang::Result<()> {
        msg!("Category: {}", inp_category.to_string());
        msg!("UUID: {}", inp_uuid.to_string());
        Ok(())
    }
}

#[derive(Accounts)]
#[instruction(inp_category: u128, inp_uuid: u128)]
pub struct CreateListing<'info> {
    #[account(init, seeds = [merchant.key().as_ref(), inp_category.to_be_bytes().as_ref(), inp_uuid.to_be_bytes().as_ref()], bump, payer = admin, space = 104)]
    pub entry: Account<'info, CatalogEntry>,
    /// CHECK: ok
    pub merchant: UncheckedAccount<'info>,
    /// CHECK: ok
    pub url_entry: UncheckedAccount<'info>,
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
    pub merchant: Pubkey,
    pub url: Pubkey,
}
// Space = 8 + 16 + 16 + 32 + 32 = 104

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
