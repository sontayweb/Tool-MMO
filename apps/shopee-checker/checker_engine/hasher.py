import hashlib

def hash_shopee_password(plaintext: str) -> str:
    """
    Hash Shopee password format:
    Step 1: MD5(plaintext)
    Step 2: SHA256(MD5_hex)
    
    Example:
    'Thuthuanqr73' -> MD5 -> 'a95a1c5604b178067fa6965f1020978f' 
                   -> SHA256 -> 'c086507a4d4aac2385fc96e70e1dc33a7b21e65b33bfe9e0fb80cff68c129c81'
    """
    if not plaintext:
        return ""
    md5_hash = hashlib.md5(plaintext.encode("utf-8")).hexdigest()
    sha256_hash = hashlib.sha256(md5_hash.encode("utf-8")).hexdigest()
    return sha256_hash
