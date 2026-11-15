from vlm import MockVLM, build_prompt, parse_symptoms, symptoms_to_query

CONDS = ["laceration", "SANS"]


def test_parses_json_wrapped_in_text():
    raw = 'Sure! ```json\n{"condition":"laceration","confidence":0.9,"location":"hand","description":"cut","severity":"high"}\n```'
    s = parse_symptoms(raw, CONDS)
    assert s["valid"] and s["condition"] == "laceration" and s["severity"] == "high"


def test_rejects_garbage_and_unknown_condition():
    assert not parse_symptoms("no json here", CONDS)["valid"]
    assert not parse_symptoms('{"condition":"made_up","confidence":1}', CONDS)["valid"]
    assert not parse_symptoms('{"condition":"SANS","confidence":"high"}', CONDS)["valid"]
    assert not parse_symptoms("{broken", CONDS)["valid"]


def test_confidence_clamped():
    assert parse_symptoms('{"condition":"SANS","confidence":7}', CONDS)["confidence"] == 1.0


def test_mock_roundtrip_and_query():
    s = parse_symptoms(MockVLM(CONDS)(None, build_prompt(CONDS)), CONDS)
    assert s["valid"] and "laceration" in symptoms_to_query(s)
