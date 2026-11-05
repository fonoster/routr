# perf/history

The first six benchmark reports published at https://routr.io/benchmarks, from November 4
and 5, 2026, kept here before the site was cleared. They were runs made while the harness
and the configs were being calibrated, so they don't follow one config and aren't
comparable with each other or with later runs. Each `report.json` is the file perfkit wrote,
copied byte for byte from `benchmarks/runs/<run id>/report.json` on the `gh-pages` branch.

All ran on DigitalOcean in nyc3, a `c-8` UUT and a `c-16` load generator.

| Run | Routr | Config | Results |
| --- | --- | --- | --- |
| `20261104T100812Z-ef05473` | 2.31.7 | smoke | EdgePort + Echo: 75 messages/s. 3-minute soak failed (79 MB/h). |
| `20261104T103650Z-257adf4` | 2.31.8 | smoke | EdgePort + Echo: at least 200 messages/s (the ramp's end). 3-minute soak failed (116 MB/h). |
| `20261104T103654Z-257adf4` | 2.31.8 | full, EdgePort only | EdgePort + Echo: 1,575 messages/s. Soak not run. |
| `20261104T144158Z-369849c` | 2.32.0 | calibration | Java EdgePort: 1,500 messages/s. Go EdgePort: 2,000 messages/s. 10-minute soak failed (33 MB/h). |
| `20261104T173648Z-2f3d8dc` | 2.32.1 | calibration | Java EdgePort: 1,700 messages/s. Go EdgePort: 6,000 messages/s. 1-hour soak aborted (perfkit couldn't analyze its results). |
| `20261105T022512Z-2f3d8dc` | 2.32.1 | full, soak only | 6-hour soak at 1 call/s passed: 0.58 MB/h, 21,600 calls. |

The capacity ramps in `perf/perfkit.yaml` were calibrated by run `20261104T173648Z-2f3d8dc`.
A soak shorter than an hour is too short to rule a leak in or out.

To view a report as a page, pass it to `perfkit render --report <file> --out <dir>`, with the
perfkit tag pinned in `.github/workflows/benchmarks.yaml`.
