"""EEG visualization prep: thin wrapper over the shared electrophysiology core."""

from __future__ import annotations

from jobs import ephys


def run(context) -> object:
    return ephys.visualize(context, "eeg_visualization_prep", "eeg")
