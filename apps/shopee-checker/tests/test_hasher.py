import pytest
from checker_engine.hasher import hash_shopee_password

def test_hash_shopee_password_exact_match():
    plain = "Thuthuanqr73"
    expected = "c086507a4d4aac2385fc96e70e1dc33a7b21e65b33bfe9e0fb80cff68c129c81"
    result = hash_shopee_password(plain)
    assert result == expected

def test_hash_empty_string():
    assert hash_shopee_password("") == ""
