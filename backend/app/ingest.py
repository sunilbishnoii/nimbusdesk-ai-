"""Document ingestion: load -> split by heading -> sentence-aware overlapping chunks."""
import re
from dataclasses import dataclass
from pathlib import Path
from . import config


@dataclass
class Chunk:
    id: int
    source: str
    heading: str
    text: str

    @property
    def index_text(self) -> str:
        return f"{self.heading}. {self.text}"


_SENT = re.compile(r"(?<=[.!?])\s+")


def split_sections(md: str):
    """Yield (heading, body) pairs from a markdown document."""
    heading, buf, out = "", [], []
    for line in md.splitlines():
        m = re.match(r"^(#{1,3})\s+(.*)", line)
        if m:
            if buf and "".join(buf).strip():
                out.append((heading, " ".join(buf).strip()))
            heading, buf = m.group(2).strip(), []
        else:
            buf.append(line.strip())
    if buf and "".join(buf).strip():
        out.append((heading, " ".join(buf).strip()))
    return out


def chunk_text(body: str, size: int = config.CHUNK_WORDS, overlap: int = config.CHUNK_OVERLAP):
    sents = [s for s in _SENT.split(body) if s]
    chunks, cur, cur_w = [], [], 0
    for s in sents:
        w = len(s.split())
        if cur and cur_w + w > size:
            chunks.append(" ".join(cur))
            keep, kw = [], 0                      # carry trailing sentences as overlap
            for prev in reversed(cur):
                pw = len(prev.split())
                if kw + pw > overlap:
                    break
                keep.insert(0, prev); kw += pw
            cur, cur_w = keep, kw
        cur.append(s); cur_w += w
    if cur:
        chunks.append(" ".join(cur))
    return chunks


def build_chunks(kb_dir: Path = config.KB_DIR):
    chunks = []
    for path in sorted(Path(kb_dir).glob("*.md")) + sorted(Path(kb_dir).glob("*.txt")):
        for heading, body in split_sections(path.read_text(encoding="utf-8")):
            for piece in chunk_text(body):
                chunks.append(Chunk(len(chunks), path.name, heading, piece))
    return chunks
