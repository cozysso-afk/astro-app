# Astrocartography calculation audit V6

## Scope

V6 adds independent numeric regression coverage for the `astrocartography_v1.py` world-line engine used by 별빛의 운명 지역·국가운.

The audit covers:

- geocentric apparent right ascension and declination for all ten supported bodies;
- Greenwich apparent sidereal time;
- MC and IC line longitudes;
- selected ASC and DC world-line coordinates in both hemispheres;
- antimeridian segment safety;
- the complete 10 planets × 4 angles = 40-line contract.

## External sources

### NASA/JPL Horizons

https://ssd.jpl.nasa.gov/horizons/manual.html

One-shot collection used observer ephemerides with:

- Earth geocenter: `CENTER='500@399'`
- `QUANTITIES='2'`: apparent right ascension and declination
- angular output in degrees

Horizons observer apparent RA/DEC includes the observational corrections appropriate for an apparent sky position and uses the true equator/equinox of date for the apparent coordinate pair.

The two frozen epochs are:

- J2000: `2000-01-01T12:00:00Z`
- 2024 LiChun reference: `2024-02-04T08:26:53Z`

### U.S. Naval Observatory — Astronomical Applications

https://aa.usno.navy.mil/data/siderealtime

https://aa.usno.navy.mil/data/api

The one-shot probe queried the USNO sidereal-time service for Greenwich apparent sidereal time (GAST). USNO documents GAST and local apparent sidereal time and notes that latitude is not used in the sidereal-time calculation.

Frozen GAST values:

- J2000: `18.697138167 h`
- 2024-02-04 08:26:53 UT1: `17.382085833 h`

The runtime Swiss Ephemeris values differed from these by less than `0.001 arcsecond` in the probe.

## External-equatorial probe result

Across both epochs and all ten bodies:

- maximum RA difference between JPL and the runtime Swiss equatorial position was about `0.994 arcsecond` (Moon, 2024 LiChun);
- maximum DEC difference was below `0.4 arcsecond`;
- most values were below `0.3 arcsecond`.

The permanent gate therefore allows `1.5 arcseconds` independently for RA and DEC.

## World-line geometry

For apparent right ascension `RA`, declination `δ`, and Greenwich apparent sidereal angle `GAST`:

- `MC longitude = normalize180(RA - GAST)`
- `IC longitude = normalize180(MC + 180°)`
- the astronomical horizon satisfies `cos(H) = -tan(latitude) * tan(δ)`
- rising/ASC uses the negative hour angle solution;
- setting/DC uses the positive hour angle solution;
- `longitude = normalize180(RA + H - GAST)`

The test freezes MC/IC results for all ten bodies at both epochs and selected ASC/DC points for Sun, Moon, and Jupiter across northern, equatorial, and southern latitudes. The expected line coordinates are calculated only during the one-shot external collection and stored as constants; normal CI performs no external network requests.

## Tolerances

- apparent RA: `<= 1.5 arcseconds`
- apparent DEC: `<= 1.5 arcseconds`
- GAST: `<= 1.5 arcseconds`
- MC/IC longitude: `<= 0.0005°` (~1.8 arcseconds)
- selected ASC/DC longitude: `<= 0.002°` (~7.2 arcseconds), allowing for the stronger declination sensitivity of horizon geometry at higher latitudes plus the runtime map's 4-decimal longitude rounding.

These tolerances are much smaller than visual map-pixel resolution and are intended to catch coordinate-frame or sign regressions rather than cosmetic rendering differences.

## CI behavior

`tests/test_astrocartography_external_gold_v6.py` is included in the existing required check:

`Western + Saju + Thai gold regression`

The required job name is intentionally unchanged so the `Protect main` ruleset continues to enforce it without reconfiguration.
