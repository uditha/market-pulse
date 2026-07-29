"""Keep Market news focused on finance / economy / banking / markets."""

from __future__ import annotations

import re
from typing import Any

FINANCE_TERMS = [
    r"\bbank(?:ing|s)?\b",
    r"\bfinance\b",
    r"\bfinancial\b",
    r"\beconom(?:y|ic|ics|ies)\b",
    r"\binflation\b",
    r"\bdeflation\b",
    r"\brupee\b",
    r"\bdollar\b",
    r"\bforex\b",
    r"\bfx\b",
    r"\bbond(?:s)?\b",
    r"\btreasur(?:y|ies)\b",
    r"\bt-?bills?\b",
    r"\bequit(?:y|ies)\b",
    r"\bstock(?:s)?\b",
    r"\bshare(?:s)?\b",
    r"\bcse\b",
    r"\bmarket(?:s)?\b",
    r"\binterest\s+rates?\b",
    r"\bpolicy\s+rates?\b",
    r"\bcentral\s+bank\b",
    r"\bcbsl\b",
    r"\bmonetary\b",
    r"\bfiscal\b",
    r"\bbudget\b",
    r"\btax(?:es|ation)?\b",
    r"\bvat\b",
    r"\bdebt\b",
    r"\bimf\b",
    r"\bgdp\b",
    r"\bexport(?:s|ers)?\b",
    r"\bimport(?:s|ers)?\b",
    r"\btrade\b",
    r"\bremittance(?:s)?\b",
    r"\brevenue\b",
    r"\bprofit(?:s|able|ability)?\b",
    r"\bearnings\b",
    r"\bebitda\b",
    r"\bipo\b",
    r"\binvest(?:ment|or|ors|ing)?\b",
    r"\bloan(?:s)?\b",
    r"\bcredit\b",
    r"\bdeposit(?:s)?\b",
    r"\bliquidity\b",
    r"\bawpr\b",
    r"\bplc\b",
    r"\bcorporate\b",
    r"\bconglomerate\b",
    r"\binsuran(?:ce|er)\b",
    r"\bleasing\b",
    r"\bmicrofinance\b",
    r"\bfintech\b",
    r"\bcrypto\b",
    r"\bsecurities\b",
    r"\bregulator\b",
    r"\bsec\b",
    r"\btariff(?:s)?\b",
    r"\bfuel\b",
    r"\boil\s+price\b",
    r"\belectricity\b",
    r"\benergy\b",
    r"\btourism\b",
    r"\bapparel\b",
    r"\btea\b",
    r"\brubber\b",
    r"\bport\b",
    r"\blogistics\b",
    r"\bstartup\b",
    r"\brs\.?\s*\d",
    r"\bbillion\b",
    r"\bmillion\b",
    r"\bquarter(?:ly)?\b",
    r"\bfy\d{2}",
    r"\bdividends?\b",
    r"\bvaluation\b",
    r"\bmerger\b",
    r"\bacquisition\b",
    r"\bbailout\b",
    r"\brestructur(?:e|ing)\b",
    r"\bsovereign\b",
    r"\breserves?\b",
    r"\bbooster\b",  # rare but ok
]

REJECT_TERMS = [
    r"\bcricket\b",
    r"\bfootball\b",
    r"\brugby\b",
    r"\bhockey\b",
    r"\bworld\s+cup\b",
    r"\bchampionship\b",
    r"\bpoints?\s+table\b",
    r"\btournament\b",
    r"\bolympic\b",
    r"\bpickleball\b",
    r"\bsports?\s+hub\b",
    r"\bmovie\b",
    r"\bfilm\b",
    r"\bcinema\b",
    r"\bcelebrity\b",
    r"\bactor\b",
    r"\bactress\b",
    r"\bwedding\b",
    r"\bmurder\b",
    r"\bkilled\b",
    r"\brape\b",
    r"\bdrug\s+possession\b",
    r"\bbail\b",
    r"\bmagistrate\b",
    r"\bbribery\b",
    r"\bjudges?\b",
    r"\bjudicial\b",
    r"\bcourt\s+case\b",
    r"\bkavadi\b",
    r"\btemple\b",
    r"\bfestival\b",
    r"\bhoroscope\b",
    r"\brecipe\b",
    r"\bcooking\b",
    r"\bfashion\b",
    r"\bnetflix\b",
    r"\bscammers?\b",
]

_FINANCE_RE = re.compile("|".join(FINANCE_TERMS), re.I)
_REJECT_RE = re.compile("|".join(REJECT_TERMS), re.I)


def _blob(article: dict[str, Any]) -> str:
    parts = [
        article.get("title") or "",
        article.get("summary") or "",
        article.get("url") or "",
    ]
    return " ".join(parts)


def is_finance_news(article: dict[str, Any]) -> bool:
    """Return True if the story belongs on a finance desk snapshot."""
    text = _blob(article)
    if not text.strip():
        return False
    if _REJECT_RE.search(text):
        return False
    # All outlets: require an explicit finance / economy / markets signal.
    return bool(_FINANCE_RE.search(text))


def filter_finance(articles: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return [a for a in articles if is_finance_news(a)]
