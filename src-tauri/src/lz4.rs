/// LZ4 block decompression matching the game's custom format.
/// The game uses raw LZ4 block format (not framed), so we need a custom decompressor.

pub fn lz4_block_decompress(src: &[u8], dst_size: usize) -> Result<Vec<u8>, String> {
    let mut dst = vec![0u8; dst_size];
    let mut sp: usize = 0;
    let mut dp: usize = 0;
    let sn = src.len();

    while sp < sn && dp < dst_size {
        let tok = src[sp];
        sp += 1;

        // Literal length
        let mut lit = ((tok >> 4) & 0x0F) as usize;
        let ml_base = (tok & 0x0F) as usize;

        if lit == 15 {
            while sp < sn && src[sp] == 255 {
                lit += 255;
                sp += 1;
            }
            if sp >= sn {
                break;
            }
            lit += src[sp] as usize;
            sp += 1;
        }

        // Copy literals
        let end = (sp + lit).min(sn);
        let cnt = (end - sp).min(dst_size - dp);
        dst[dp..dp + cnt].copy_from_slice(&src[sp..sp + cnt]);
        dp += cnt;
        sp += cnt;

        if sp >= sn || dp >= dst_size {
            break;
        }

        // Match offset
        if sp + 2 > sn {
            break;
        }
        let mo = src[sp] as usize | ((src[sp + 1] as usize) << 8);
        sp += 2;

        if mo == 0 || mo > dp {
            break;
        }

        // Match length
        let mut mlen = ml_base + 4;
        if ml_base == 15 {
            while sp < sn && src[sp] == 255 {
                mlen += 255;
                sp += 1;
            }
            if sp < sn {
                mlen += src[sp] as usize;
                sp += 1;
            }
        }

        // Copy match (byte-by-byte for overlapping)
        for _ in 0..mlen {
            if dp >= dst_size {
                break;
            }
            dst[dp] = dst[dp - mo];
            dp += 1;
        }
    }

    Ok(dst)
}

/// Decompress a cat blob: first 4 bytes = uncompressed size,
/// optionally bytes 4-8 = compressed length.
pub fn decompress_cat(blob: &[u8]) -> Result<Vec<u8>, String> {
    if blob.len() < 4 {
        return Err("blob too small".to_string());
    }

    let uncomp = u32::from_le_bytes([blob[0], blob[1], blob[2], blob[3]]) as usize;

    // Try 8-byte header first (uncompressed_size + compressed_length)
    if blob.len() >= 8 {
        let cl = u32::from_le_bytes([blob[4], blob[5], blob[6], blob[7]]) as usize;
        if cl > 0 && cl <= blob.len() - 8 {
            if let Ok(result) = lz4_block_decompress(&blob[8..8 + cl], uncomp) {
                return Ok(result);
            }
        }
    }

    // Fallback: 4-byte header only
    lz4_block_decompress(&blob[4..], uncomp)
}
