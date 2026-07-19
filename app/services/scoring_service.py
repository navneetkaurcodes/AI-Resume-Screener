from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity


# -------------------------------------------------------
# 1. TF-IDF Similarity
# -------------------------------------------------------

def calculate_tfidf_score(job_text: str, resume_text: str) -> float:
    """
    Compare job description with resume using TF-IDF.
    Returns similarity percentage.
    """

    if not job_text or not resume_text:
        return 0.0

    documents = [job_text, resume_text]

    vectorizer = TfidfVectorizer(
        stop_words="english",
        ngram_range=(1, 2),
        max_features=5000
    )

    try:
        tfidf_matrix = vectorizer.fit_transform(documents)
    except ValueError:
        return 0.0

    similarity = cosine_similarity(
        tfidf_matrix[0:1],
        tfidf_matrix[1:2]
    )[0][0]

    return round(similarity * 100, 2)


# -------------------------------------------------------
# 2. Required Skill Match
# -------------------------------------------------------

def calculate_skill_match(required_skills, candidate_skills):

    if not required_skills:
        return 0, [], []
    
    candidate_skills = candidate_skills or []

    required = {
        skill.strip().lower()
        for skill in required_skills
        if skill and skill.strip()
    }

    candidate = {
        skill.strip().lower()
        for skill in candidate_skills
        if skill and skill.strip()
    }

    if not required:
        return 0, [], []

    matched = required.intersection(candidate)

    missing = required.difference(candidate)

    percentage = round(
        (len(matched) / len(required)) * 100,
        2
    )

    return (percentage,sorted(matched),sorted(missing))


# -------------------------------------------------------
# 3. Experience Match
# -------------------------------------------------------

def calculate_experience_match(
    required_experience,
    candidate_experience
):

    if required_experience is None:
        return 100
    
    if candidate_experience is None:
        candidate_experience = 0

    if required_experience <= 0:
        return 100

    if candidate_experience >= required_experience:
        return 100

    score = (
        candidate_experience / required_experience
    ) * 100

    return round(score, 2)


# -------------------------------------------------------
# 4. Final Score
# -------------------------------------------------------

def calculate_final_score(
    tfidf_score,
    skill_score,
    experience_score
):
    """
    Weight Distribution

    TF-IDF       -> 50%
    Skills       -> 35%
    Experience   -> 15%
    """
    TFIDF_WEIGHT = 0.50
    SKILL_WEIGHT = 0.35
    EXPERIENCE_WEIGHT = 0.15

    final = (
    tfidf_score * TFIDF_WEIGHT
    + skill_score * SKILL_WEIGHT
    + experience_score * EXPERIENCE_WEIGHT
)

    return round(final, 2)