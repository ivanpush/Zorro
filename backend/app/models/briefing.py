"""Briefing agent output model."""

from pydantic import BaseModel, Field


class BriefingOutput(BaseModel):
    """Context extracted by Briefing agent."""

    summary: str = Field(max_length=500)
    main_claims: list[str] = Field(min_length=1, max_length=10)
    stated_scope: str | None = None
    stated_limitations: list[str] = Field(default_factory=list)
    methodology_summary: str | None = None
    domain_keywords: list[str] = Field(default_factory=list, max_length=20)

    def format_for_prompt(self) -> str:
        parts = [
            f"Summary: {self.summary}",
            f"Main claims: {'; '.join(self.main_claims)}",
        ]
        if self.stated_scope:
            parts.append(f"Stated scope: {self.stated_scope}")
        if self.stated_limitations:
            parts.append(f"Limitations: {'; '.join(self.stated_limitations)}")
        if self.methodology_summary:
            parts.append(f"Methodology: {self.methodology_summary}")
        return "\n".join(parts)
