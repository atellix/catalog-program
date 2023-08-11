use crate::program::Catalog;
use anchor_lang::prelude::*;
use anchor_spl::token::{ self, Transfer };
use solana_program::instruction::Instruction;
use solana_program::sysvar::instructions::{ID as IX_ID, load_instruction_at_checked};
use solana_program::ed25519_program::{ID as ED25519_ID};
use borsh::{ BorshSerialize, BorshDeserialize };
use num_enum::{ TryFromPrimitive };
use bytemuck::{ Pod, Zeroable };
use byte_slice_cast::{ AsByteSlice };
use std::convert::TryInto;
use std::result::Result as FnResult;
use sha3::{Shake128, digest::{Update, ExtendableOutput, XofReader}};

extern crate slab_alloc;
use slab_alloc::{ SlabPageAlloc, CritMapHeader, CritMap, AnyNode, LeafNode, SlabVec, SlabTreeError };

declare_id!("CTLGp9JpcXCJZPqdn2W73c74DTsCTS8EFEedd7enU8Mv");

pub const VERSION_MAJOR: u32 = 1;
pub const VERSION_MINOR: u32 = 0;
pub const VERSION_PATCH: u32 = 0;

pub const MAX_RBAC: u32 = 128;

#[repr(u16)]
#[derive(PartialEq, Debug, Eq, Copy, Clone)]
pub enum DT { // Data types
    UserRBACMap,                 // CritMap
    UserRBAC,                    // Slabvec
}

#[repr(u32)]
#[derive(PartialEq, Debug, Eq, Copy, Clone, TryFromPrimitive)]
pub enum Role {             // Role-based access control:
    NetworkAdmin,           // 0 - Can manage RBAC for other users
    CreateCatalog,          // 1 - This signer can create catalogs
    RemoveURL,              // 2 - This signer close URL data
}

#[derive(Copy, Clone)]
#[repr(packed)]
pub struct UserRBAC {
    pub role: Role,
    pub free: u32,
}
unsafe impl Zeroable for UserRBAC {}
unsafe impl Pod for UserRBAC {}

impl UserRBAC {
    pub fn role(&self) -> Role {
        self.role
    }

    pub fn free(&self) -> u32 {
        self.free
    }

    pub fn set_free(&mut self, new_free: u32) {
        self.free = new_free
    }

    fn next_index(pt: &mut SlabPageAlloc, data_type: DT) -> FnResult<u32, ProgramError> {
        let svec = pt.header_mut::<SlabVec>(index_datatype(data_type));
        let free_top = svec.free_top();
        if free_top == 0 { // Empty free list
            return Ok(svec.next_index());
        }
        let free_index = free_top.checked_sub(1).ok_or(error!(ErrorCode::Overflow))?;
        let index_act = pt.index::<UserRBAC>(index_datatype(data_type), free_index as usize);
        let index_ptr = index_act.free();
        pt.header_mut::<SlabVec>(index_datatype(data_type)).set_free_top(index_ptr);
        Ok(free_index)
    }

    fn free_index(pt: &mut SlabPageAlloc, data_type: DT, idx: u32) -> anchor_lang::Result<()> {
        let free_top = pt.header::<SlabVec>(index_datatype(data_type)).free_top();
        pt.index_mut::<UserRBAC>(index_datatype(data_type), idx as usize).set_free(free_top);
        let new_top = idx.checked_add(1).ok_or(error!(ErrorCode::Overflow))?;
        pt.header_mut::<SlabVec>(index_datatype(data_type)).set_free_top(new_top);
        Ok(())
    }
}

fn full_account_zero(account: &AccountInfo) -> bool {
    let data = account.try_borrow_data().unwrap();
    let (prefix, aligned, suffix) = unsafe { data.align_to::<u128>() };
    prefix.iter().all(|&x| x == 0) && suffix.iter().all(|&x| x == 0) && aligned.iter().all(|&x| x == 0)
}

#[inline]
fn index_datatype(data_type: DT) -> u16 {  // Maps only
    match data_type {
        DT::UserRBAC => DT::UserRBAC as u16,
        _ => { panic!("Invalid datatype") },
    }
}

#[inline]
fn map_len(data_type: DT) -> u32 {
    match data_type {
        DT::UserRBAC => MAX_RBAC,
        _ => 0,
    }
}

#[inline]
fn map_datatype(data_type: DT) -> u16 {  // Maps only
    match data_type {
        DT::UserRBAC => DT::UserRBACMap as u16,
        _ => { panic!("Invalid datatype") },
    }
}

#[inline]
fn map_get(pt: &mut SlabPageAlloc, data_type: DT, key: u128) -> Option<LeafNode> {
    let cm = CritMap { slab: pt, type_id: map_datatype(data_type), capacity: map_len(data_type) };
    let res = cm.get_key(key);
    match res {
        None => None,
        Some(res) => Some(res.clone()),
    }
}

#[inline]
fn map_insert(pt: &mut SlabPageAlloc, data_type: DT, node: &LeafNode) -> FnResult<(), SlabTreeError> {
    let mut cm = CritMap { slab: pt, type_id: map_datatype(data_type), capacity: map_len(data_type) };
    let res = cm.insert_leaf(node);
    match res {
        Err(SlabTreeError::OutOfSpace) => {
            //msg!("Atellix: Out of space...");
            return Err(SlabTreeError::OutOfSpace)
        },
        _  => Ok(())
    }
}

#[inline]
fn map_remove(pt: &mut SlabPageAlloc, data_type: DT, key: u128) -> FnResult<(), SlabTreeError> {
    let mut cm = CritMap { slab: pt, type_id: map_datatype(data_type), capacity: map_len(data_type) };
    cm.remove_by_key(key).ok_or(SlabTreeError::NotFound)?;
    Ok(())
}

fn has_role(acc_auth: &AccountInfo, role: Role, key: &Pubkey) -> anchor_lang::Result<()> {
    let auth_data: &mut [u8] = &mut acc_auth.try_borrow_mut_data()?;
    let rd = SlabPageAlloc::new(auth_data);
    let authhash: u128 = CritMap::bytes_hash([[role as u32].as_byte_slice(), key.as_ref()].concat().as_slice());
    let authrec = map_get(rd, DT::UserRBAC, authhash);
    if ! authrec.is_some() {
        return Err(ErrorCode::AccessDenied.into());
    }
    if authrec.unwrap().owner() != *key {
        msg!("User key does not match signer");
        return Err(ErrorCode::AccessDenied.into());
    }
    let urec = rd.index::<UserRBAC>(DT::UserRBAC as u16, authrec.unwrap().slot() as usize);
    if urec.role() != role {
        msg!("Role does not match");
        return Err(ErrorCode::AccessDenied.into());
    }
    Ok(())
}

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
    pub fee_account: [u8; 32],
    pub fee_tokens: u64,
}

// LEN: 16 + 8 + 16 + 16 + 16 + 16 + 1 + 4 + 4 + 32 + 32 + 32 + 32 + 32 + 8 = 265

#[program]
pub mod catalog {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> anchor_lang::Result<()> {
        let rt = &mut ctx.accounts.root_data;
        rt.catalog_count = 0;
        rt.root_authority = ctx.accounts.auth_data.key();

        let auth_data: &mut[u8] = &mut ctx.accounts.auth_data.try_borrow_mut_data()?;
        let rd = SlabPageAlloc::new(auth_data);
        rd.setup_page_table();
        rd.allocate::<CritMapHeader, AnyNode>(DT::UserRBACMap as u16, MAX_RBAC as usize).expect("Failed to allocate");
        rd.allocate::<SlabVec, UserRBAC>(DT::UserRBAC as u16, MAX_RBAC as usize).expect("Failed to allocate");

        Ok(())
    }

    pub fn store_metadata(ctx: Context<UpdateMetadata>,
        inp_program_name: String,
        inp_developer_name: String,
        inp_developer_url: String,
        inp_source_url: String,
        inp_verify_url: String,
    ) -> anchor_lang::Result<()> {
        let md = &mut ctx.accounts.program_info;
        md.semvar_major = VERSION_MAJOR;
        md.semvar_minor = VERSION_MINOR;
        md.semvar_patch = VERSION_PATCH;
        md.program = ctx.accounts.program.key();
        md.program_name = inp_program_name;
        md.developer_name = inp_developer_name;
        md.developer_url = inp_developer_url;
        md.source_url = inp_source_url;
        md.verify_url = inp_verify_url;
        msg!("Program: {}", ctx.accounts.program.key.to_string());
        msg!("Program Name: {}", md.program_name.as_str());
        msg!("Version: {}.{}.{}", VERSION_MAJOR.to_string(), VERSION_MINOR.to_string(), VERSION_PATCH.to_string());
        msg!("Developer Name: {}", md.developer_name.as_str());
        msg!("Developer URL: {}", md.developer_url.as_str());
        msg!("Source URL: {}", md.source_url.as_str());
        msg!("Verify URL: {}", md.verify_url.as_str());
        Ok(())
    }

    pub fn grant(ctx: Context<UpdateRBAC>,
        _inp_root_nonce: u8,
        inp_role: u32,
    ) -> anchor_lang::Result<()> {
        let acc_rbac = &ctx.accounts.rbac_user.to_account_info();
        let acc_admn = &ctx.accounts.program_admin.to_account_info();
        let acc_auth = &ctx.accounts.auth_data.to_account_info();

        // Check for NetworkAdmin authority
        let admin_role = has_role(&acc_auth, Role::NetworkAdmin, acc_admn.key);
        let mut program_owner: bool = false;
        if admin_role.is_err() {
            let acc_pdat = &ctx.accounts.program_data;
            require!(acc_pdat.upgrade_authority_address.unwrap() == *acc_admn.key, ErrorCode::AccessDenied);
            program_owner = true;
        }

        // Verify specified role
        let role_item = Role::try_from_primitive(inp_role);
        if role_item.is_err() {
            msg!("Invalid role: {}", inp_role.to_string());
            return Err(ErrorCode::InvalidParameters.into());
        }
        let role = role_item.unwrap();
        if role == Role::NetworkAdmin && ! program_owner {
            msg!("Reserved for program owner");
            return Err(ErrorCode::AccessDenied.into());
        }

        // Verify not assigning roles to self
        if *acc_admn.key == *acc_rbac.key {
            msg!("Cannot grant roles to self");
            return Err(ErrorCode::AccessDenied.into());
        }

        let auth_data: &mut[u8] = &mut acc_auth.try_borrow_mut_data()?;
        let rd = SlabPageAlloc::new(auth_data);
        let authhash: u128 = CritMap::bytes_hash([[role as u32].as_byte_slice(), acc_rbac.key.as_ref()].concat().as_slice());

        // Check if record exists
        let authrec = map_get(rd, DT::UserRBAC, authhash);
        if authrec.is_some() {
            msg!("Atellix: Role already active");
        } else {
            // Add new record
            let new_item = map_insert(rd, DT::UserRBAC, &LeafNode::new(authhash, 0, acc_rbac.key));
            if new_item.is_err() {
                msg!("Unable to insert role");
                return Err(ErrorCode::InternalError.into());
            }
            let rbac_idx = UserRBAC::next_index(rd, DT::UserRBAC)?;
            let mut cm = CritMap { slab: rd, type_id: map_datatype(DT::UserRBAC), capacity: map_len(DT::UserRBAC) };
            cm.get_key_mut(authhash).unwrap().set_slot(rbac_idx);
            *rd.index_mut(DT::UserRBAC as u16, rbac_idx as usize) = UserRBAC { role: role, free: 0 };
            msg!("Atellix: Role granted");
        }
        Ok(())
    }

    pub fn revoke(ctx: Context<UpdateRBAC>,
        _inp_root_nonce: u8,
        inp_role: u32,
    ) -> anchor_lang::Result<()> {
        let acc_admn = &ctx.accounts.program_admin.to_account_info(); // Program owner or network admin
        let acc_auth = &ctx.accounts.auth_data.to_account_info();
        let acc_rbac = &ctx.accounts.rbac_user.to_account_info();

        // Check for NetworkAdmin authority
        let admin_role = has_role(&acc_auth, Role::NetworkAdmin, acc_admn.key);
        let mut program_owner: bool = false;
        if admin_role.is_err() {
            let acc_pdat = &ctx.accounts.program_data;
            require!(acc_pdat.upgrade_authority_address.unwrap() == *acc_admn.key, ErrorCode::AccessDenied);
            program_owner = true;
        }

        // Verify specified role
        let role_item = Role::try_from_primitive(inp_role);
        if role_item.is_err() {
            msg!("Invalid role: {}", inp_role.to_string());
            return Err(ErrorCode::InvalidParameters.into());
        }
        let role = role_item.unwrap();
        if role == Role::NetworkAdmin && ! program_owner {
            msg!("Reserved for program owner");
            return Err(ErrorCode::AccessDenied.into());
        }

        let auth_data: &mut[u8] = &mut acc_auth.try_borrow_mut_data()?;
        let rd = SlabPageAlloc::new(auth_data);
        let authhash: u128 = CritMap::bytes_hash([[role as u32].as_byte_slice(), acc_rbac.key.as_ref()].concat().as_slice());

        // Check if record exists
        let authrec = map_get(rd, DT::UserRBAC, authhash);
        if authrec.is_some() {
            map_remove(rd, DT::UserRBAC, authhash).or(Err(error!(ErrorCode::InternalError)))?;
            UserRBAC::free_index(rd, DT::UserRBAC, authrec.unwrap().slot())?;
            msg!("Atellix: Role revoked");
        } else {
            msg!("Atellix: Role not found");
        }
        Ok(())
    }

    pub fn create_catalog(
        ctx: Context<CreateCatalog>,
        inp_catalog: u64,
    ) -> anchor_lang::Result<()> {
        let acc_auth = &ctx.accounts.auth_data.to_account_info();
        let acc_user = &ctx.accounts.auth_user.to_account_info();
        let admin_role = has_role(&acc_auth, Role::CreateCatalog, acc_user.key);
        if admin_role.is_err() {
            msg!("No create catalog role");
            return Err(ErrorCode::AccessDenied.into());
        }

        let root_data = &mut ctx.accounts.root_data;
        root_data.add_catalog()?;
        let cinst = &mut ctx.accounts.catalog;
        cinst.catalog_id = inp_catalog;
        cinst.catalog_counter = 0;
        cinst.signer = ctx.accounts.catalog_signer.key();
        cinst.manager = ctx.accounts.catalog_manager.key();
        msg!("Atellix: Created Catalog ID: {}", cinst.catalog_id);
        Ok(())
    }

    pub fn create_url(
        ctx: Context<CreateURL>,
        inp_url_expand_mode: u8,
        inp_url_hash: u128,
        inp_url_length: u32,
        inp_url: String,
    ) -> anchor_lang::Result<()> {
        let mut hasher = Shake128::default();
        hasher.update(inp_url.as_bytes());
        let mut reader = hasher.finalize_xof();
        let mut hash_result = [0u8; 16];
        reader.read(&mut hash_result);
        let confirm_hash: u128 = u128::from_be_bytes(hash_result);
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
    ) -> anchor_lang::Result<()> {
        let clock = Clock::get()?;
        let catalog = &mut ctx.accounts.catalog;
        let ix: Instruction = load_instruction_at_checked(0, &ctx.accounts.ix_sysvar)?;
        let (pk, req) = utils::verify_ed25519_ix(&ix, 265)?;
        let params = CatalogParameters::try_from_slice(&req).unwrap();
        require!(Pubkey::new_from_array(pk.try_into().unwrap()) == catalog.signer, ErrorCode::InvalidParameters);
        let owner = Pubkey::new_from_array(params.owner);
        require!(catalog.catalog_id == params.catalog, ErrorCode::InvalidParameters);
        require!(inp_uuid == params.uuid, ErrorCode::InvalidParameters);
        require!(ctx.accounts.owner.key() == owner, ErrorCode::InvalidParameters);
        require!(ctx.accounts.fee_account.key().to_bytes() == params.fee_account, ErrorCode::InvalidParameters);
        if params.fee_tokens > 0 {
            let cpi_accounts = Transfer {
                from: ctx.accounts.fee_source.to_account_info(),
                to: ctx.accounts.fee_account.to_account_info(),
                authority: ctx.accounts.fee_payer.to_account_info(),
            };
            let cpi_program = ctx.accounts.token_program.to_account_info();
            let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
            token::transfer(cpi_ctx, params.fee_tokens)?;
        }
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
        listing_entry.listing_idx = catalog.catalog_counter;
        listing_entry.listing_url = Pubkey::new_from_array(params.listing_url);
        listing_entry.detail_url = Pubkey::new_from_array(params.detail_url);
        listing_entry.label_url = Pubkey::new_from_array(params.label_url);
        listing_entry.update_count = 0;
        listing_entry.update_ts = clock.unix_timestamp;
        catalog.catalog_counter = catalog.catalog_counter.checked_add(1).ok_or(error!(ErrorCode::Overflow))?;
        Ok(())
    }

    // TODO: update_listing
    // TODO: publish_update
    // TODO: close_url

    // All checks performed at account level
    pub fn remove_listing(
        ctx: Context<RemoveListing>,
    ) -> anchor_lang::Result<()> {
        emit!(RemoveListingEvent {
            user: ctx.accounts.auth_user.key(),
            catalog: ctx.accounts.catalog.catalog_id,
            listing: ctx.accounts.listing.key(),
            listing_idx: ctx.accounts.listing.listing_idx,
        });
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
            msg!("Error 2");
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
    #[account(init, seeds = [program_id.as_ref()], bump, payer = program_admin, space = 48)]
    pub root_data: Account<'info, RootData>,
    /// CHECK: ok
    #[account(mut, constraint = full_account_zero(&auth_data))]
    pub auth_data: UncheckedAccount<'info>,
    #[account(constraint = program.programdata_address().unwrap() == Some(program_data.key()))]
    pub program: Program<'info, Catalog>,
    #[account(constraint = program_data.upgrade_authority_address == Some(program_admin.key()))]
    pub program_data: Account<'info, ProgramData>,
    #[account(mut)]
    pub program_admin: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdateMetadata<'info> {
    #[account(constraint = program.programdata_address().unwrap() == Some(program_data.key()))]
    pub program: Program<'info, Catalog>,
    #[account(constraint = program_data.upgrade_authority_address == Some(program_admin.key()))]
    pub program_data: Account<'info, ProgramData>,
    #[account(mut)]
    pub program_admin: Signer<'info>,
    #[account(init_if_needed, seeds = [program_id.as_ref(), b"metadata"], bump, payer = program_admin, space = 584)]
    pub program_info: Account<'info, ProgramMetadata>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(_inp_root_nonce: u8)]
pub struct UpdateRBAC<'info> {
    #[account(seeds = [program_id.as_ref()], bump = _inp_root_nonce)]
    pub root_data: Account<'info, RootData>,
    /// CHECK: ok
    #[account(mut, constraint = root_data.root_authority == auth_data.key())]
    pub auth_data: UncheckedAccount<'info>,
    #[account(constraint = program.programdata_address().unwrap() == Some(program_data.key()))]
    pub program: Program<'info, Catalog>,
    pub program_data: Account<'info, ProgramData>,
    #[account(mut)]
    pub program_admin: Signer<'info>,
    /// CHECK: ok
    pub rbac_user: AccountInfo<'info>,
}

#[derive(Accounts)]
#[instruction(inp_catalog: u64)]
pub struct CreateCatalog<'info> {
    #[account(mut, seeds = [program_id.as_ref()], bump)]
    pub root_data: Account<'info, RootData>,
    /// CHECK: ok
    #[account(constraint = root_data.root_authority == auth_data.key())]
    pub auth_data: UncheckedAccount<'info>,
    pub auth_user: Signer<'info>,
    #[account(init, seeds = [b"catalog", inp_catalog.to_be_bytes().as_ref()], bump, payer = fee_payer, space = 88)]
    pub catalog: Account<'info, CatalogInstance>,
    /// CHECK: ok
    pub catalog_signer: UncheckedAccount<'info>,
    /// CHECK: ok
    pub catalog_manager: UncheckedAccount<'info>,
    #[account(mut)]
    pub fee_payer: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(inp_uuid: u128)]
pub struct CreateListing<'info> {
    #[account(mut)]
    pub catalog: Account<'info, CatalogInstance>,
    #[account(init, seeds = [catalog.catalog_id.to_be_bytes().as_ref(), inp_uuid.to_be_bytes().as_ref()], bump, payer = fee_payer, space = 257)]
    pub listing: Account<'info, CatalogEntry>,
    pub owner: Signer<'info>,
    /// CHECK: ok
    #[account(address = IX_ID)]
    pub ix_sysvar: AccountInfo<'info>,
    #[account(mut)]
    pub fee_payer: Signer<'info>,
    /// CHECK: ok
    #[account(mut)]
    pub fee_source: AccountInfo<'info>,
    /// CHECK: ok
    #[account(mut)]
    pub fee_account: AccountInfo<'info>,
    pub system_program: Program<'info, System>,
    /// CHECK: ok
    #[account(address = token::ID)]
    pub token_program: UncheckedAccount<'info>,
}

#[derive(Accounts)]
pub struct RemoveListing<'info> {
    #[account(constraint = catalog.catalog_id == listing.catalog)]
    pub catalog: Account<'info, CatalogInstance>,
    #[account(mut, close = fee_recipient)]
    pub listing: Account<'info, CatalogEntry>,
    #[account(mut)]
    pub fee_recipient: Signer<'info>,
    #[account(constraint = catalog.manager == auth_user.key() || listing.owner == auth_user.key())]
    pub auth_user: Signer<'info>,
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
    pub root_authority: Pubkey,
}
// Size: 8 + 8 + 32 = 48

impl RootData {
    pub fn add_catalog(&mut self) -> anchor_lang::Result<()> {
        self.catalog_count = self.catalog_count.checked_add(1).ok_or(error!(ErrorCode::Overflow))?;
        Ok(())
    }

    pub fn root_authority(&self) -> Pubkey {
        self.root_authority
    }

    pub fn set_root_authority(&mut self, new_authority: Pubkey) {
        self.root_authority = new_authority
    }
}

#[account]
#[derive(Default)]
pub struct CatalogInstance {
    pub catalog_id: u64,
    pub catalog_counter: u64,
    pub signer: Pubkey, // Signer for creating and updating listings
    pub manager: Pubkey, // Signer for removing
}
// Space = 8 + 8 + 8 + 32 + 32 = 88

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
    pub listing_idx: u64,
    pub listing_url: Pubkey,
    pub label_url: Pubkey,
    pub detail_url: Pubkey,
}
// Space = 8 + 16 + 8 + 16 + (16 * 3) + 1 + 4 + 4 + 8 + 8 + 8 + (32 * 4) = 257

#[account]
#[derive(Default)]
pub struct CatalogUrl {
    pub url_expand_mode: u8,
    pub url: String,
}
// Space = 8 + 1 + (len) + 4 = 13 + (len)

#[account]
#[derive(Default)]
pub struct ProgramMetadata {
    pub semvar_major: u32,
    pub semvar_minor: u32,
    pub semvar_patch: u32,
    pub program: Pubkey,
    pub program_name: String,   // Max len 60
    pub developer_name: String, // Max len 60
    pub developer_url: String,  // Max len 124
    pub source_url: String,     // Max len 124
    pub verify_url: String,     // Max len 124
}
// 8 + (4 * 3) + (4 * 5) + (64 * 2) + (128 * 3) + 32
// Data length (with discrim): 584 bytes

#[event]
pub struct RemoveListingEvent {
    pub user: Pubkey,
    pub catalog: u64,
    pub listing: Pubkey,
    pub listing_idx: u64,
}

#[error_code]
pub enum ErrorCode {
    #[msg("Access denied")]
    AccessDenied,
    #[msg("Invalid URL hash")]
    InvalidURLHash,
    #[msg("Invalid URL length")]
    InvalidURLLength,
    #[msg("Invalid parameters")]
    InvalidParameters,
    #[msg("Internal error")]
    InternalError,
    #[msg("Overflow")]
    Overflow,
}
