"""Repair a not-yet-consumed round 14 locator; never rewrite frozen or scored references."""
import importlib.util
from pathlib import Path

root=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location("scenario",root/"scripts/hardness-scenario.py")
scenario=importlib.util.module_from_spec(spec)
spec.loader.exec_module(scenario)
scenario.repair_unconsumed_reference(scenario.CAMPAIGN/"rounds/14")
