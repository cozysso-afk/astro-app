from __future__ import annotations

"""Canonical local civil-time resolution for relationship calculations.

An explicit IANA zone is authoritative.  Fixed offsets remain a backward-
compatible fallback only when no zone identifier is supplied.  The resolver
never applies both sources to the same local datetime.
"""

from dataclasses import dataclass
from datetime import date, datetime, time, timedelta, timezone, tzinfo
import math
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError


class TimezoneResolutionError(ValueError):
    pass


class NonexistentLocalTimeError(TimezoneResolutionError):
    pass


@dataclass(frozen=True)
class ResolvedLocalDateTime:
    local: datetime
    utc: datetime
    timezone_source: str
    resolved_utc_offset_hours: float
    timezone_id: str | None
    fold: int
    local_time_status: str
    policy: str

    @property
    def tzinfo(self) -> tzinfo:
        assert self.local.tzinfo is not None
        return self.local.tzinfo

    def provenance(self) -> dict:
        return {
            "birth_timezone_id": self.timezone_id,
            "source": self.timezone_source,
            "resolved_utc_offset_hours": self.resolved_utc_offset_hours,
            "fold": self.fold,
            "local_time_status": self.local_time_status,
            "policy": self.policy,
        }


def _roundtrips(candidate: datetime, naive: datetime, zone: ZoneInfo) -> bool:
    return candidate.astimezone(timezone.utc).astimezone(zone).replace(tzinfo=None) == naive


def _fixed_offset(value: float | None, default: float) -> tuple[float, str]:
    source = "legacy_default" if value is None else "fixed_offset"
    offset = float(default if value is None else value)
    if not math.isfinite(offset) or not -14.0 <= offset <= 14.0:
        raise TimezoneResolutionError("utc_offset_hours must be finite and between -14 and 14")
    return offset, source


def resolve_local_datetime(
    local_date: date,
    local_time: time,
    *,
    timezone_id: str | None = None,
    utc_offset_hours: float | None = None,
    fold: int | None = None,
    legacy_default_offset_hours: float = 9.0,
) -> ResolvedLocalDateTime:
    """Resolve a wall-clock datetime once, with explicit DST edge policies.

    Ambiguous input defaults deterministically to fold=0 (the earlier UTC-offset
    occurrence) unless fold is supplied.  Nonexistent wall times fail closed.
    An invalid explicit IANA identifier also fails closed; it never silently
    falls back to a fixed offset.
    """
    if fold not in (None, 0, 1):
        raise TimezoneResolutionError("timezone_fold must be 0 or 1")
    naive = datetime.combine(local_date, local_time.replace(tzinfo=None))
    zone_name = (timezone_id or "").strip() or None
    if zone_name is None:
        offset, source = _fixed_offset(utc_offset_hours, legacy_default_offset_hours)
        local = naive.replace(tzinfo=timezone(timedelta(hours=offset)))
        return ResolvedLocalDateTime(
            local=local,
            utc=local.astimezone(timezone.utc),
            timezone_source=source,
            resolved_utc_offset_hours=offset,
            timezone_id=None,
            fold=0,
            local_time_status="unambiguous",
            policy="fixed_offset_exactly_once",
        )

    try:
        zone = ZoneInfo(zone_name)
    except ZoneInfoNotFoundError as exc:
        raise TimezoneResolutionError(f"unknown IANA timezone_id: {zone_name}") from exc

    candidates = [naive.replace(tzinfo=zone, fold=value) for value in (0, 1)]
    valid = [_roundtrips(candidate, naive, zone) for candidate in candidates]
    if not any(valid):
        raise NonexistentLocalTimeError(
            f"nonexistent local time in {zone_name}: {naive.isoformat(timespec='seconds')}"
        )

    ambiguous = all(valid) and candidates[0].utcoffset() != candidates[1].utcoffset()
    if ambiguous:
        selected_fold = 0 if fold is None else fold
        status = "ambiguous"
        policy = "explicit_fold" if fold is not None else "deterministic_fold_0"
    else:
        selected_fold = 0
        status = "unambiguous"
        policy = "iana_historical_offset"
    local = candidates[selected_fold]
    offset_delta = local.utcoffset()
    if offset_delta is None:
        raise TimezoneResolutionError(f"timezone offset unavailable for {zone_name}")
    return ResolvedLocalDateTime(
        local=local,
        utc=local.astimezone(timezone.utc),
        timezone_source="iana",
        resolved_utc_offset_hours=offset_delta.total_seconds() / 3600.0,
        timezone_id=zone_name,
        fold=selected_fold,
        local_time_status=status,
        policy=policy,
    )


def resolve_profile_birth_datetime(profile: dict, *, noon_proxy: bool = False) -> ResolvedLocalDateTime:
    birth_time = profile.get("birth_time")
    if birth_time is None:
        if not noon_proxy:
            raise TimezoneResolutionError("birth_time unavailable")
        birth_time = time(12, 0)
    return resolve_local_datetime(
        profile["birth_date"],
        birth_time,
        timezone_id=profile.get("timezone_id"),
        utc_offset_hours=profile.get("utc_offset_hours"),
        fold=profile.get("timezone_fold"),
    )


def timezone_for_profile(profile: dict, *, noon_proxy: bool = False) -> tzinfo:
    return resolve_profile_birth_datetime(profile, noon_proxy=noon_proxy).tzinfo
