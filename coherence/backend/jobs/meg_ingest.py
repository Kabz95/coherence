"""MEG ingest: thin wrapper over the shared electrophysiology core.

MEG is handled as imported recordings (Blueprint Ch. 16.3) via MNE-Python's
native readers (.fif, .ds). Reference pipeline: MNE-BIDS-Pipeline.
"""

from __future__ import annotations

from jobs import ephys


def run(context) -> object:
    return ephys.ingest(context, "meg_ingest", "meg")
