import os
import re
import math
from pathlib import Path
from typing import List, Dict, Tuple, Optional
from config import settings
from utils.logger import logger

class RAGService:
    """Document-Aware Engineering Assistant (RAG) Service.
    Indexes datasheets and technical references to ground Gemma 4 reasoning in authoritative specs.
    """

    def __init__(self, docs_dir: Optional[Path] = None) -> None:
        self.docs_dir = docs_dir or (settings.BASE_DIR / "data" / "docs")
        self.docs_dir.mkdir(parents=True, exist_ok=True)
        self.chunks: List[Dict[str, str]] = []
        self.index_documents()

    def index_documents(self) -> None:
        """Indexes all datasheets in the data/docs directory into searchable passages."""
        self.chunks = []
        doc_files = list(self.docs_dir.glob("*.txt")) + list(self.docs_dir.glob("*.md"))
        
        for file_path in doc_files:
            filename = file_path.name
            try:
                with open(file_path, "r", encoding="utf-8") as f:
                    text = f.read()

                # Chunk document by numbered sections or paragraphs
                sections = re.split(r'\n(?=[0-9]+\.\s|[A-Z0-9\s]{4,}:|\n)', text)
                for idx, sec in enumerate(sections):
                    cleaned = sec.strip()
                    if len(cleaned) < 30:
                        continue
                    
                    # Extract title line
                    first_line = cleaned.split('\n')[0].strip()
                    self.chunks.append({
                        "doc_id": filename,
                        "title": first_line,
                        "content": cleaned,
                        "tokens": self._tokenize(cleaned)
                    })
            except Exception as e:
                logger.error(f"Error reading doc file {filename}: {e}")

        logger.info(f"RAG Service indexed {len(self.chunks)} datasheet passages across {len(doc_files)} engineering documents.")

    def search_datasheets(self, query: str, top_k: int = 2) -> Tuple[str, List[Dict[str, str]]]:
        """Searches indexed datasheets for passages relevant to the user query.
        Returns a formatted context string for Gemma 4 prompt and list of citations.
        """
        if not self.chunks:
            self.index_documents()

        if not self.chunks:
            return "", []

        query_tokens = self._tokenize(query)
        if not query_tokens:
            return "", []

        scored_chunks: List[Tuple[float, Dict[str, str]]] = []
        for chunk in self.chunks:
            score = self._compute_score(query_tokens, chunk["tokens"])
            if score > 0.05:
                scored_chunks.append((score, chunk))

        # Sort descending by score
        scored_chunks.sort(key=lambda x: x[0], reverse=True)
        top_passages = scored_chunks[:top_k]

        if not top_passages:
            return "", []

        context_parts = []
        citations = []
        for score, chunk in top_passages:
            context_parts.append(
                f"--- EXCERPT FROM DATASHEET: {chunk['doc_id']} ({chunk['title']}) ---\n"
                f"{chunk['content']}\n"
            )
            citations.append({
                "doc_id": chunk["doc_id"],
                "title": chunk["title"],
                "score": round(score, 3)
            })

        formatted_context = (
            "AUTHORITATIVE ENGINEERING DATASHEET EXCERPTS (Grounded Reference):\n"
            + "\n".join(context_parts)
            + "\nINSTRUCTIONS: Answer the user's question accurately based on the above datasheet excerpts. Cite the datasheet name where appropriate."
        )

        return formatted_context, citations

    def get_document_list(self) -> List[Dict[str, str]]:
        """Returns list of all indexed datasheets."""
        doc_map = {}
        for chunk in self.chunks:
            doc_id = chunk["doc_id"]
            if doc_id not in doc_map:
                doc_map[doc_id] = {"doc_id": doc_id, "sections": 0}
            doc_map[doc_id]["sections"] += 1
        return list(doc_map.values())

    def _tokenize(self, text: str) -> List[str]:
        """Simple alphanumeric tokenizer for TF-IDF / similarity matching."""
        words = re.findall(r'\b[a-zA-Z0-9_]{2,}\b', text.lower())
        return words

    def _compute_score(self, query_tokens: List[str], doc_tokens: List[str]) -> float:
        """Computes keyword overlap score between query and document tokens."""
        if not doc_tokens:
            return 0.0

        q_set = set(query_tokens)
        doc_count = {}
        for t in doc_tokens:
            doc_count[t] = doc_count.get(t, 0) + 1

        matches = sum(doc_count.get(qt, 0) for qt in q_set)
        if matches == 0:
            return 0.0

        # Term frequency + jaccard overlap score
        overlap = len(q_set.intersection(set(doc_tokens))) / float(len(q_set))
        return (matches / math.sqrt(len(doc_tokens))) * overlap
