#!/usr/bin/env python3

import json
import uuid
import borsh
import base64
import krock32
import asyncio
from borsh import types
from solders.keypair import Keypair
from solders.pubkey import Pubkey
from flask import Flask, request, jsonify
from Crypto.Hash import SHAKE128

LISTING_SCHEMA = borsh.schema({
    'uuid': types.u128,
    'catalog': types.u64,
    'category': types.u128,
    'filter_by_1': types.u128,
    'filter_by_2': types.u128,
    'filter_by_3': types.u128,
    'attributes': types.u8,
    'latitude': types.fixed_array(types.u8, 4),
    'longitude': types.fixed_array(types.u8, 4),
    'owner': types.fixed_array(types.u8, 32),
    'listing_url': types.fixed_array(types.u8, 32),
    'label_url': types.fixed_array(types.u8, 32),
    'detail_url': types.fixed_array(types.u8, 32),
    'fee_account': types.fixed_array(types.u8, 32),
    'fee_tokens': types.u64,
})

CATALOGS = {
    'commerce': 0,
}

decoder = krock32.Decoder(strict=False, checksum=False)
decoder.update('pgf97nnw60g60jhyc40ga14qjage1vj8qd4pwpnn4b74gygttn3s0cm6j80abk6fmmq9ctf0s19sv48m1ftynwcargf4yczgdrj5700')
KEYPAIR = Keypair.from_bytes(decoder.finalize())
PROGRAM = Pubkey.from_string('FQs77rQ5vFvKGXa4UaJa6HU2UATFt5awLk6Xx6M7isFj')

app = Flask(__name__)

def to_byte_array(b64_string):
    byte_string = base64.b64decode(b64_string)
    return [int(b) for b in byte_string]

def to_text_account(text_string, fill_mode=0):
    shake = SHAKE128.new()
    shake.update(text_string.encode('utf8'))
    shake_hash = shake.read(16)
    seeds = [bytes([fill_mode]), shake_hash]
    pda = Pubkey.find_program_address(seeds, PROGRAM)
    #print(text_string)
    #print(str(pda[0]))
    return [int(b) for b in bytes(pda[0])]

@app.route("/api/catalog/listing", methods=['POST'])
def catalog_listing():
    inp = request.json
    if not isinstance(inp, dict):
        abort(500)
    listing_uuid = uuid.uuid4()
    listing_data = {
        'uuid': listing_uuid.int,
        'catalog': CATALOGS[inp['catalog']],
        'category': int(inp['category']),
        'filter_by_1': int(inp['filter_by_1']),
        'filter_by_2': int(inp['filter_by_2']),
        'filter_by_3': int(inp['filter_by_3']),
        'attributes': inp['attributes'],
        'latitude': to_byte_array(inp['latitude']),
        'longitude': to_byte_array(inp['longitude']),
        'owner': to_byte_array(inp['owner']),
        'listing_url': to_text_account(inp['listing_url'][0], inp['listing_url'][1]),
        'label_url': to_text_account(inp['label_url'][0], inp['label_url'][1]),
        'detail_url': to_text_account(inp['detail_url'][0], inp['detail_url'][1]),
        'fee_account': to_byte_array(inp['fee_account']),
        'fee_tokens': 0,
    }
    serialized_bytes = borsh.serialize(LISTING_SCHEMA, listing_data)
    res = {}
    res['result'] = 'ok'
    res['uuid'] = str(listing_uuid)
    res['catalog'] = str(CATALOGS[inp['catalog']])
    res['pubkey'] = str(KEYPAIR.pubkey())
    res['sig'] = str(KEYPAIR.sign_message(serialized_bytes))
    res['message'] = base64.b64encode(serialized_bytes).decode('utf8')
    #print(res)
    return jsonify(res)

