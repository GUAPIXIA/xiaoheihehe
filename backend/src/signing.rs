use hmac::{Hmac, Mac};
use sha2::Sha256;

const ALPHABET: &[u8] = b"AB45STUVWZEFGJ6CH01D237IXYPQRKLMN89";

fn substitute(input: &str, length: usize) -> Vec<u8> {
    input
        .bytes()
        .map(|b| ALPHABET[b as usize % length])
        .collect()
}

// Protocol constants and test vectors are documented in docs/01-接口表.md.
// Express the byte mixing as multiplication in GF(2^8) rather than nested transforms.
fn multiply(mut byte: u8, mut factor: u8) -> u8 {
    let mut output = 0;
    while factor != 0 {
        if factor & 1 != 0 {
            output ^= byte;
        }
        byte = (byte << 1) ^ if byte & 0x80 != 0 { 0x1b } else { 0 };
        factor >>= 1;
    }
    output
}

pub fn signature(path: &str, timestamp: u64, nonce: &str) -> String {
    let canonical = format!(
        "/{}/",
        path.split('/')
            .filter(|s| !s.is_empty())
            .collect::<Vec<_>>()
            .join("/")
    );
    let parts = [
        substitute(&timestamp.to_string(), 33),
        substitute(&canonical, 35),
        substitute(nonce, 35),
    ];
    let mut mixed = Vec::with_capacity(20);
    'outer: for i in 0..parts.iter().map(Vec::len).max().unwrap_or(0) {
        for part in &parts {
            if let Some(byte) = part.get(i) {
                mixed.push(*byte);
            }
            if mixed.len() == 20 {
                break 'outer;
            }
        }
    }
    let digest = format!("{:x}", md5::compute(mixed));
    let tail = &digest.as_bytes()[26..];
    // Products in this field use XOR addition: 6 * 3 * 2 = 20, then 20 ^ 6 ^ 3 = 17.
    let factors = [17, 20, 6, 3];
    let sum: u32 = (0..4)
        .map(|row| {
            (0..4).fold(0u8, |acc, col| {
                acc ^ multiply(tail[col], factors[(col + 4 - row) % 4])
            }) as u32
        })
        .sum::<u32>()
        + tail[4] as u32
        + tail[5] as u32;
    format!(
        "{}{:02}",
        String::from_utf8(substitute(&digest[..5], 31)).unwrap(),
        sum % 100
    )
}

pub fn comment_signature(timestamp: u64, nonce: &str) -> String {
    let key = "Z7mFG4tQp9Ws2LxB8H";
    let mut mac = Hmac::<Sha256>::new_from_slice(key.as_bytes()).expect("valid HMAC key");
    mac.update(format!("{key}{nonce}{timestamp}:{nonce}").as_bytes());
    format!("15:{}", hex::encode(mac.finalize().into_bytes()))
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn captured_signature_vectors() {
        assert_eq!(
            signature(
                "/bbs/app/feeds",
                1780887796,
                "77A06EB1B1EE4C0F6AC5BB1B7A1F0B1A"
            ),
            "WU7P260"
        );
        assert_eq!(
            signature(
                "/bbs/app/api/link/post",
                1780888011,
                "56D46802FCA89EE3B8D9CC54ACB7CD82"
            ),
            "DU10W93"
        );
    }
}
