"""Base abstract parser class for document parsing"""

from abc import ABC, abstractmethod
from pathlib import Path

from ..models.document import DocObj


class BaseParser(ABC):
    """Abstract base class for document parsers"""

    @abstractmethod
    async def parse(self, file_path: Path, title_override: str | None = None) -> DocObj:
        """
        Parse a document file into a DocObj.

        Args:
            file_path: Path to the document file
            title_override: Optional title to use instead of extracting from document

        Returns:
            DocObj: The immutable, indexed representation of the document

        Raises:
            ValueError: If file format is not supported
            FileNotFoundError: If file does not exist
            Exception: For parsing errors
        """
        pass