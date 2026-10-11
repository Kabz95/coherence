"""EEG preparation: thin wrapper over the shared electrophysiology core."""

from __future__ import annotations

from jobs import ephys


def run(context) -> object:
    return ephys.prep(context, "eeg_prep", "eeg")
