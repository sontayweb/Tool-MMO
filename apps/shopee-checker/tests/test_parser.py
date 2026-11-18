import pytest
from checker_engine.account_parser import parse_text_content, parse_single_line

def test_parse_tab_delimited():
    line = "Khaphanyq51\tyenvya315956@hotmail.com"
    res = parse_single_line(line)
    assert res is not None
    assert res["email"] == "yenvya315956@hotmail.com"
    assert res["password"] == "Khaphanyq51"

def test_parse_multi_columns_excel():
    line = "xic3p9jukv\tKhaphanyq51\t84996540628\tyenvya315956@hotmail.com\tyenvypsu625"
    res = parse_single_line(line)
    assert res is not None
    assert res["username"] == "xic3p9jukv"
    assert res["password"] == "Khaphanyq51"
    assert res["email"] == "yenvya315956@hotmail.com"

def test_parse_pipe_5_columns():
    line = "xic3p9jukv|Khaphanyq51|84996540628|yenvya315956@hotmail.com|yenvypsu625"
    res = parse_single_line(line)
    assert res is not None
    assert res["username"] == "xic3p9jukv"
    assert res["password"] == "Khaphanyq51"
    assert res["phone"] == "84996540628"
    assert res["email"] == "yenvya315956@hotmail.com"
    assert res["recovery_email"] == "yenvypsu625"

def test_deduplication():
    content = """Khaphanyq51\tyenvya315956@hotmail.com
Pass2\tYENVYA315956@HOTMAIL.COM
Pass3\tother@hotmail.com"""
    results = parse_text_content(content)
    assert len(results) == 2
    assert results[0]["email"] == "yenvya315956@hotmail.com"
    assert results[1]["email"] == "other@hotmail.com"
