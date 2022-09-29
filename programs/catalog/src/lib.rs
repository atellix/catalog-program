use anchor_lang::prelude::*;

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

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
    ) -> ProgramResult {
        msg!("URL Expand Mode: {}", inp_url_expand_mode.as_str());
        msg!("URL Hash: {}", inp_url_hash.as_str());
        msg!("URL: {}", inp_url.as_str());
        Ok(())
    }

    pub fn create_listing(
        ctx: Context<CreateListing>,
        inp_category: u128,
    ) -> ProgramResult {
        msg!("Category: {}", inp_category.as_str());
        Ok(())
    }
}

#[derive(Accounts)]
#[instruction(inp_category: u128, inp_uuid: u128)
pub struct CreateListing {
    #[account(init, seeds = [merchant.key().as_ref(), inp_category.to_le_bytes().as_ref()], bump, payer = admin, space = 104)]
    pub entry: Account<'info, CatalogEntry>,
    /// CHECK: ok
    pub merchant: UncheckedAccount<'info>,
    /// CHECK: ok
    pub url: UncheckedAccount<'info>,
    pub admin: Signer<'info>,
}

#[derive(Accounts)]
#[instruction(inp_url_expand_mode: u8, inp_url_hash: u128)]
pub struct CreateURL {
    #[account(init, seeds = [inp_url_expand_mode.to_le_bytes().as_ref(), inp_url_hash.to_le_bytes().as_ref()], bump, payer = admin, space = 140)]
    pub url: Account<'info, CatalogURL>,
    pub admin: Signer<'info>,
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
    #[msg("Access denied")]
    AccessDenied,
}
