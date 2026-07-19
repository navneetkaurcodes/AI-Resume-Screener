import re

from app.data.skills import SKILLS


# -------------------------------
# Extract Email
# -------------------------------

def extract_email(text: str):

    pattern = r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}"

    match = re.search(pattern, text)

    return match.group(0) if match else None


# -------------------------------
# Extract Phone Number
# -------------------------------

def extract_phone(text: str):

    pattern = r"(?:\+?91[-\s]?)?[6-9]\d{4}[-\s]?\d{5}"

    match = re.search(pattern, text)

    if not match:
        return None

    digits = re.sub(r"\D", "", match.group(0))

    if len(digits) == 12 and digits.startswith("91"):
        digits = digits[2:]
    elif len(digits) > 10:
        digits = digits[-10:]

    return f"+91-{digits[:5]} {digits[5:]}"


# -------------------------------
# Extract Skills
# -------------------------------

def extract_skills(text: str):

    text_lower = text.lower()

    found_skills = []

    for skill in SKILLS:
        pattern = r"\b" + re.escape(skill.lower()) + r"\b"

        if re.search(pattern, text_lower):

            found_skills.append(skill)

    return sorted(list(set(found_skills)))

def extract_name(text: str):

    lines = text.split("\n")

    for line in lines:

        line = line.strip()

        if len(line) > 2 and len(line.split()) <= 4:

            return line

    return None

def extract_experience(text: str):

    pattern = r"(\d+(?:\.\d+)?)\+?\s*(?:years?|yrs?)"

    match = re.search(
        pattern,
        text,
        re.IGNORECASE
    )

    if match:

        return float(match.group(1))

    return 0


EDUCATION_HEADINGS = {
    "education", "academic background", "qualifications",
    "educational background", "academic qualifications",
}

EXPERIENCE_HEADINGS = {
    "experience", "professional experience", "work experience",
    "employment history", "career history",
}

OTHER_HEADINGS = {
    "skills", "technical skills", "key expertise", "projects",
    "certifications", "summary", "professional summary", "brief summary",
    "contact", "objective", "achievements",
}


def _get_section_block(text: str, headings: set):
    """
    Return the lines that sit under the first heading line (matched
    case-insensitively, exact line match) from `headings`, stopping at the
    next recognized heading (education/experience/other) or blank run.
    """

    lines = [line.strip() for line in text.split("\n")]

    stop_headings = EDUCATION_HEADINGS | EXPERIENCE_HEADINGS | OTHER_HEADINGS

    for i, line in enumerate(lines):

        if line.lower() in headings:

            block = []

            for next_line in lines[i + 1:]:

                if next_line.lower() in stop_headings:
                    break

                if next_line:
                    block.append(next_line)

            return block

    return []


# -------------------------------
# Extract Education
# -------------------------------

DEGREE_PATTERNS = [
    r"ph\.?d", r"m\.?tech", r"m\.?e\.?", r"mba", r"m\.?c\.?a\.?",
    r"m\.?sc", r"m\.?a\.?", r"master(?:'s)? of [a-z ]+",
    r"b\.?tech", r"b\.?e\.?", r"bca", r"b\.?c\.?a\.?", r"b\.?sc",
    r"b\.?a\.?", r"bachelor(?:'s)? of [a-z ]+", r"diploma",
]

INSTITUTION_KEYWORDS = r"(university|college|institute|school)"


def extract_education(text: str):

    block = _get_section_block(text, EDUCATION_HEADINGS)

    if not block:
        return None

    joined = " | ".join(block)
    joined_lower = joined.lower()

    degree = None

    for pattern in DEGREE_PATTERNS:

        match = re.search(r"\b" + pattern + r"\b", joined_lower)

        if match:
            line_with_degree = next(
                (l for l in block if re.search(r"\b" + pattern + r"\b", l.lower())),
                match.group(0)
            )
            degree = line_with_degree.split("|")[0].strip()
            break

    institution = None

    for line in block:

        if re.search(INSTITUTION_KEYWORDS, line.lower()) and line != degree:
            institution = line.split("|")[0].strip()
            break

    if not degree and not institution:
        return None

    return {
        "degree": degree,
        "institution": institution,
    }


# -------------------------------
# Extract Job Titles
# -------------------------------

JOB_TITLE_KEYWORDS = [
    "developer", "engineer", "manager", "analyst", "executive", "intern",
    "consultant", "designer", "coordinator", "specialist", "scientist",
    "architect", "administrator", "director", "officer", "lead",
]


def extract_job_titles(text: str):

    block = _get_section_block(text, EXPERIENCE_HEADINGS)

    if not block:
        return []

    titles = []

    for line in block:
        if line.startswith(("-", "*", "•", "(cid")):
            continue

        if len(line) > 90:
            continue

        candidate = line

        if " - " in candidate:
            candidate = candidate.split(" - ")[0].strip()
        candidate = re.sub(r"\s*\([^)]*\)\s*$", "", candidate).strip()

        has_keyword = any(
            re.search(r"\b" + kw + r"\b", candidate.lower())
            for kw in JOB_TITLE_KEYWORDS
        )

        if has_keyword and candidate and candidate not in titles:
            titles.append(candidate)

        if len(titles) >= 5:
            break

    return titles


def parse_resume(text: str):

    return {

        "candidate_name": extract_name(text),

        "email": extract_email(text),

        "phone": extract_phone(text),

        "skills": extract_skills(text),

        "experience_years": extract_experience(text),

        "education": extract_education(text),

        "job_titles": extract_job_titles(text)
    }