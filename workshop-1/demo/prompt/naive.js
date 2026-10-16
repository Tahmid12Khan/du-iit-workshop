import re

# Mobile: 01[3-9] + 8 digits (11 digits total locally)
BD_MOBILE_RE = re.compile(r"^(?:\+?880|0)1[3-9]\d{8}$")

def is_valid_bd_phone(number: str) -> bool:
    """Return True if `number` is a valid Bangladeshi mobile number."""
    cleaned = re.sub(r"[\s\-()]", "", number)
    return bool(BD_MOBILE_RE.match(cleaned))


if __name__ == "__main__":
    tests = {
        "01712345678": True,
        "+8801712345678": True,
        "880 1712-345678": True,
        "(+880) 1912345678": True,
        "01212345678": False,   # operator digit 2 is invalid
        "0171234567": False,    # too short
        "+14155552671": False,  # not Bangladeshi
    }
    for num, expected in tests.items():
        assert is_valid_bd_phone(num) == expected, num
    print("All tests passed.")
